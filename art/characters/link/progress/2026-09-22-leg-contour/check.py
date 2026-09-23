"""Portable contour preservation/surface check; reuse the existing GLB reader and source contract."""
import copy
import hashlib
import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


profile = module('checked_contour_field', HERE/'field.py')
prior = module('contour_check_helpers', HERE.parent/'2026-09-21-boot-tip/check.py')
prior.HERE, prior.SOURCE = HERE, profile.SOURCE_SHA


def desired(p):
    q, j = profile.field((p[0], -p[2], p[1]))
    return (q[0], q[2], -q[1]), j


def main(candidate, expected_sha, output, native=False):
    assert candidate.resolve() != output.resolve() and not output.exists(), 'Preserve candidate and prior reports'
    raw, doc, binary = prior.load(candidate, expected_sha)
    old, prefix, source_bytes = prior.preserved_source(doc, binary)
    assert len(doc['accessors']) == len(old['accessors'])+3
    assert len(doc['bufferViews']) == len(old['bufferViews'])+3
    assert doc['accessors'][:len(old['accessors'])] == old['accessors']
    assert doc['bufferViews'][:len(old['bufferViews'])] == old['bufferViews']
    restored = copy.deepcopy(doc)
    restored['buffers'], restored['accessors'], restored['bufferViews'] = old['buffers'], old['accessors'], old['bufferViews']
    allowed = []
    for mi, (a, b) in enumerate(zip(old['meshes'], restored['meshes'])):
        for pi, (x, y) in enumerate(zip(a['primitives'], b['primitives'])):
            for key in ('POSITION', 'NORMAL', 'TANGENT'):
                if x['attributes'].get(key) != y['attributes'].get(key):
                    allowed.append([mi, pi, key])
                    y['attributes'][key] = x['attributes'][key]
    assert allowed == [[2, 0, k] for k in ('POSITION', 'NORMAL', 'TANGENT')]
    assert restored == old, 'Unexpected semantic JSON change'
    attrs, after = old['meshes'][2]['primitives'][0]['attributes'], doc['meshes'][2]['primitives'][0]['attributes']
    arrays = {k: (prior.rows(old, prefix, attrs[k]), prior.rows(doc, binary, after[k]))
              for k in ('POSITION', 'NORMAL', 'TANGENT')}
    (p, pb), (q, qb) = arrays['POSITION']
    (n, nb), (nn, nnb) = arrays['NORMAL']
    (t, tb), (tt, ttb) = arrays['TANGENT']
    assert len(p) == len(q) == 82133
    active, changed = [], []
    errors = {'position_float32_m': 0, 'normal': 0, 'tangent': 0, 'orthogonality': 0, 'squared_unit': 0}
    minimum_a = 1
    for i, (a, b) in enumerate(zip(p, q)):
        want, jac = desired(a)
        assert b == struct.unpack('<fff', struct.pack('<fff', *want))
        assert pb[i][4:] == qb[i][4:], 'Height or depth changed'
        assert all(math.isfinite(v) for row in (b, nn[i], tt[i]) for v in row)
        errors['position_float32_m'] = max(errors['position_float32_m'], math.dist(b, want))
        if pb[i] != qb[i]:
            changed.append(i)
        if a == want:
            assert pb[i] == qb[i] and nb[i] == nnb[i] and tb[i] == ttb[i], 'Identity row changed'
            continue
        active.append(i)
        assert .15 < a[1] < .325 and abs(a[0]) < .22
        scale, _, shear, _ = jac
        assert scale > 0
        minimum_a = min(minimum_a, scale)
        normal = prior.unit((n[i][0]/scale, n[i][1]-shear*n[i][0]/scale, n[i][2]))
        pushed = (scale*t[i][0]+shear*t[i][1], t[i][1], t[i][2])
        tangent = prior.unit(tuple(v-prior.dot(pushed, normal)*nv for v, nv in zip(pushed, normal)))
        errors['normal'] = max(errors['normal'], math.dist(nn[i], normal))
        errors['tangent'] = max(errors['tangent'], math.dist(tt[i][:3], tangent))
        errors['orthogonality'] = max(errors['orthogonality'], abs(prior.dot(nn[i], tt[i])))
        errors['squared_unit'] = max(errors['squared_unit'], abs(prior.dot(nn[i], nn[i])-1), abs(prior.dot(tt[i][:3], tt[i][:3])-1))
        assert tt[i][3] == t[i][3], 'Tangent handedness changed'
    assert len(active) == 5703
    assert max(errors[k] for k in ('normal', 'tangent', 'orthogonality')) < 1e-7
    assert errors['squared_unit'] < 2e-7
    selected = set(active)
    ids, _ = prior.rows(old, prefix, old['meshes'][2]['primitives'][0]['indices'])
    ids = [i[0] for i in ids]
    min_cosine, faces = 1, 0
    for i in range(0, len(ids), 3):
        tri = ids[i:i+3]
        if not selected.intersection(tri):
            continue
        a, b, c = tri
        before = prior.cross(prior.sub(p[b], p[a]), prior.sub(p[c], p[a]))
        after_face = prior.cross(prior.sub(q[b], q[a]), prior.sub(q[c], q[a]))
        if prior.dot(before, before) < 1e-24:
            continue
        cosine = prior.dot(prior.unit(before), prior.unit(after_face))
        assert cosine > 0, 'Affected triangle flipped'
        min_cosine, faces = min(min_cosine, cosine), faces+1
    joints, _ = prior.rows(old, prefix, attrs['JOINTS_0'])
    weights, _ = prior.rows(old, prefix, attrs['WEIGHTS_0'])
    joint_names = [old['nodes'][i]['name'] for i in old['skins'][0]['joints']]
    toes = [i for i in range(len(p)) if any(joint_names[j].startswith('toe') and w > 0 for j, w in zip(joints[i], weights[i]))]
    assert len(toes) == 2970 and all(pb[i] == qb[i] and nb[i] == nnb[i] and tb[i] == ttb[i] for i in toes)
    sole = {}
    for side, expected_count in (('L', 269), ('R', 268)):
        family = [i for i in range(len(p)) if sum(w for j, w in zip(joints[i], weights[i]) if joint_names[j] in ('ankle'+side, 'toe'+side)) > .5]
        bottom = min(p[i][1] for i in family)
        low = [i for i in family if p[i][1] <= bottom+.012]
        assert len(low) == expected_count and all(pb[i] == qb[i] and nb[i] == nnb[i] and tb[i] == ttb[i] for i in low)
        sole[side] = {'vertices': len(low), 'rest_bounds': prior.bounds([p[i] for i in low]), 'position_normal_tangent_exact': True}
    negative = {}
    for label in ('protected_metadata', 'original_binary_prefix'):
        bad_doc, bad_binary = copy.deepcopy(doc), binary
        if label == 'protected_metadata':
            bad_doc['animations'][0]['name'] += '-negative-control'
        else:
            bad_binary = bytes([binary[0] ^ 1])+binary[1:]
        try:
            prior.preserved_source(bad_doc, bad_binary)
        except AssertionError:
            negative[label] = True
        else:
            raise AssertionError('Negative control accepted: '+label)
    correspondence = None
    if native:
        exporter = module('checked_contour_exporter', HERE/'export.py')
        native_raw = (HERE/'native-rows.json').read_bytes()
        receipt = json.loads((HERE/'candidate.json').read_text())
        assert receipt['sha256'] == expected_sha and hashlib.sha256(native_raw).hexdigest() == receipt['native_rows_sha256']
        rows = json.loads(native_raw)
        points = [(p[i], desired(p[i])[0]) for i in active]
        _, correspondence = exporter.adapter.native_aliases(points, rows)
        for label, key in (('source_100um', 'before'), ('deformation_100um', 'after')):
            broken = copy.deepcopy(rows)
            broken[0][key][0] += .0001
            try:
                exporter.adapter.native_aliases(points, broken)
            except AssertionError:
                negative[label] = True
            else:
                raise AssertionError('Native negative accepted: '+label)
        assert (HERE/'native-rows.json').read_bytes() == native_raw
    assert candidate.read_bytes() == raw
    report = {'pass': True, 'candidate_sha256': expected_sha, 'source_sha256': profile.SOURCE_SHA,
              'source_bytes': source_bytes, 'candidate_bytes': len(raw), 'appended_bytes': len(raw)-source_bytes,
              'original_binary_prefix_bytes_exact': len(prefix), 'original_accessors_preserved': len(old['accessors']),
              'semantic_json_allowed_changes': allowed, 'authoring_field_vertices': len(active),
              'float32_position_rows_changed': len(changed), 'identity_position_normal_tangent_rows_exact': len(p)-len(active),
              'errors': errors, 'minimum_jacobian_determinant': minimum_a,
              'field_self_check': profile.self_check(), 'affected_triangles': faces, 'minimum_face_normal_cosine': min_cosine,
              'toe_weighted_vertices_exact': len(toes), 'sole': sole,
              'native_correspondence': correspondence, 'negative_controls_rejected': negative,
              'scope': 'Raw preservation, deformation, normals/tangents and source/native correspondence when requested. Posed calf/cuff self-contact and actual-player replay remain separate.'}
    output.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    assert len(sys.argv) in (4, 5), 'check.py CANDIDATE.glb EXPECTED_SHA256 REPORT.json [--native]'
    assert len(sys.argv) == 4 or sys.argv[4] == '--native'
    main(Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), len(sys.argv) == 5)
