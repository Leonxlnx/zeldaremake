"""CPU-only independent preservation, surface and native-correspondence audit."""
import copy
import hashlib
import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = '89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b'
CANDIDATE = '4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850'
NATIVE = '80a2a811f9a9ebd1b2d8a0a96339e0d1386135a9d81bc349a452c1c6769c4474'


def load(path, expected):
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected
    assert struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
    size, kind = struct.unpack_from('<I4s', raw, 12)
    assert kind == b'JSON'
    doc = json.loads(raw[20:20+size])
    bin_size, kind = struct.unpack_from('<I4s', raw, 20+size)
    assert kind == b'BIN\0' and bin_size == len(raw)-28-size
    binary = raw[28+size:28+size+doc['buffers'][0]['byteLength']]
    return raw, doc, binary


def rows(doc, binary, index):
    a = doc['accessors'][index]
    assert 'sparse' not in a
    count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    fmt = '<'+{5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]*count
    width = struct.calcsize(fmt)
    view = doc['bufferViews'][a['bufferView']]
    start = view.get('byteOffset', 0)+a.get('byteOffset', 0)
    chunks = [binary[start+i*view.get('byteStride', width):start+i*view.get('byteStride', width)+width]
              for i in range(a['count'])]
    return [struct.unpack(fmt, r) for r in chunks], chunks


def smooth(x, a, b):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)


def desired(p):
    x, h, f = p
    return x, h, f-.1*smooth(f, .09, .15)*(1-smooth(h, .10, .16))*(f-.09)


def derivative(p):
    _, h, f = p
    tf, th = max(0, min(1, (f-.09)/.06)), max(0, min(1, (h-.10)/.06))
    a, b = tf*tf*(3-2*tf), th*th*(3-2*th)
    da = 6*tf*(1-tf)/.06 if .09 < f < .15 else 0
    db = 6*th*(1-th)/.06 if .10 < h < .16 else 0
    return 1-.1*(a+(f-.09)*da)*(1-b), .1*(f-.09)*a*db


def unit(v):
    size = math.sqrt(sum(x*x for x in v))
    assert size > 0
    return tuple(x/size for x in v)


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def cross(a, b):
    return a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def bounds(points):
    return {name: [op(p[k] for p in points) for k in range(3)] for name, op in [('min', min), ('max', max)]}


def preserved_source(doc, binary):
    """Recover the original metadata/spans already embedded in the appended candidate."""
    contract = json.loads((HERE/'source-preservation.json').read_text())
    assert contract['source_sha256'] == SOURCE
    original = copy.deepcopy(doc)
    original['buffers'] = contract['buffers']
    original['accessors'] = original['accessors'][:contract['accessor_count']]
    original['bufferViews'] = original['bufferViews'][:contract['buffer_view_count']]
    original['meshes'][2]['primitives'][0]['attributes'].update(contract['body_attributes'])
    encoded = json.dumps(original, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    assert hashlib.sha256(encoded).hexdigest() == contract['canonical_json_sha256'], 'Original metadata changed'
    prefix = binary[:contract['original_binary_bytes']]
    assert hashlib.sha256(prefix).hexdigest() == contract['original_binary_sha256'], 'Original BIN prefix changed'
    return original, prefix, contract['source_bytes']


def main(source, candidate, output):
    assert output.resolve() != candidate.resolve()
    assert source is None or output.resolve() != source.resolve()
    new_raw, new_doc, new_binary = load(candidate, CANDIDATE)
    if source is None:
        doc, binary, source_bytes = preserved_source(new_doc, new_binary)
    else:
        raw, doc, binary = load(source, SOURCE)
        source_bytes = len(raw)
    assert new_binary[:len(binary)] == binary
    assert new_doc['accessors'][:len(doc['accessors'])] == doc['accessors']
    assert new_doc['bufferViews'][:len(doc['bufferViews'])] == doc['bufferViews']
    restored = copy.deepcopy(new_doc)
    restored['buffers'] = doc['buffers']
    restored['accessors'] = restored['accessors'][:len(doc['accessors'])]
    restored['bufferViews'] = restored['bufferViews'][:len(doc['bufferViews'])]
    allowed = []
    for mi, (am, bm) in enumerate(zip(doc['meshes'], restored['meshes'])):
        for pi, (ap, bp) in enumerate(zip(am['primitives'], bm['primitives'])):
            for kind in ['POSITION', 'NORMAL', 'TANGENT']:
                if ap['attributes'].get(kind) != bp['attributes'].get(kind):
                    allowed.append([mi, pi, kind])
                    bp['attributes'][kind] = ap['attributes'][kind]
    assert allowed == [[2, 0, 'POSITION'], [2, 0, 'NORMAL'], [2, 0, 'TANGENT']]
    assert restored == doc, 'Unexpected semantic JSON modification'
    assert len(new_doc['accessors']) == len(doc['accessors'])+3
    assert len(new_doc['bufferViews']) == len(doc['bufferViews'])+3
    # Identical original accessor/view metadata and the complete BIN prefix prove
    # every original raw span, including sparse data and unused geometry arrays.
    attrs = doc['meshes'][2]['primitives'][0]['attributes']
    after_attrs = new_doc['meshes'][2]['primitives'][0]['attributes']
    p, pbytes = rows(doc, binary, attrs['POSITION'])
    q, qbytes = rows(new_doc, new_binary, after_attrs['POSITION'])
    n, nbytes = rows(doc, binary, attrs['NORMAL'])
    nn, nnbytes = rows(new_doc, new_binary, after_attrs['NORMAL'])
    t, tbytes = rows(doc, binary, attrs['TANGENT'])
    tt, ttbytes = rows(new_doc, new_binary, after_attrs['TANGENT'])
    assert len(p) == len(q) == 82133
    active, changed = [], []
    max_position_error = max_normal_error = max_tangent_error = max_orthogonality = 0
    max_unit_error = max_jacobian_error = 0
    min_derivative = 1
    for i, (old, new) in enumerate(zip(p, q)):
        intended = desired(old)
        assert all(math.isfinite(v) for row in [new, nn[i], tt[i]] for v in row)
        assert old[:2] == new[:2]
        assert new == struct.unpack('<fff', struct.pack('<fff', *intended))
        max_position_error = max(max_position_error, math.dist(new, intended))
        if pbytes[i] != qbytes[i]:
            changed.append(i)
        if old == intended:
            assert pbytes[i] == qbytes[i] and nbytes[i] == nnbytes[i] and tbytes[i] == ttbytes[i]
            continue
        active.append(i)
        assert old[2] > .09 and old[1] < .16 and new[2] <= old[2]
        df, dh = derivative(old)
        min_derivative = min(min_derivative, df)
        expected_n = unit((n[i][0], n[i][1]-dh*n[i][2]/df, n[i][2]/df))
        pushed_t = (t[i][0], t[i][1], dh*t[i][1]+df*t[i][2])
        expected_t = unit(tuple(v-dot(pushed_t, expected_n)*nv for v, nv in zip(pushed_t, expected_n)))
        max_normal_error = max(max_normal_error, math.dist(nn[i], expected_n))
        max_tangent_error = max(max_tangent_error, math.dist(tt[i][:3], expected_t))
        max_orthogonality = max(max_orthogonality, abs(dot(nn[i], tt[i])))
        max_unit_error = max(max_unit_error, abs(dot(nn[i], nn[i])-1), abs(dot(tt[i][:3], tt[i][:3])-1))
        assert t[i][3] == tt[i][3]
        for axis, expected in [(1, dh), (2, df)]:
            minus, plus = list(old), list(old)
            minus[axis] -= 1e-6
            plus[axis] += 1e-6
            finite = (desired(plus)[2]-desired(minus)[2])/2e-6
            max_jacobian_error = max(max_jacobian_error, abs(finite-expected))
    assert len(active) == 1664
    assert min_derivative >= .83125
    assert max_jacobian_error < 1e-7
    assert max_normal_error < 1e-7 and max_tangent_error < 1e-7
    assert max_orthogonality < 1e-7 and max_unit_error < 2e-7
    ids, _ = rows(doc, binary, doc['meshes'][2]['primitives'][0]['indices'])
    ids = [r[0] for r in ids]
    selected = set(active)
    min_face_cosine, faces = 1, 0
    for j in range(0, len(ids), 3):
        tri = ids[j:j+3]
        if not selected.intersection(tri):
            continue
        a, b, c = tri
        before = cross(sub(p[b], p[a]), sub(p[c], p[a]))
        after = cross(sub(q[b], q[a]), sub(q[c], q[a]))
        if dot(before, before) < 1e-24:
            continue
        cosine = dot(unit(before), unit(after))
        assert cosine > 0, 'Triangle face flipped'
        min_face_cosine = min(min_face_cosine, cosine)
        faces += 1
    sole = {}
    for side, sign in [('L', 1), ('R', -1)]:
        idx = [i for i, r in enumerate(p) if sign*r[0] > 0 and r[1] < .065]
        before, after = bounds([p[i] for i in idx]), bounds([q[i] for i in idx])
        assert before['min'] == after['min']
        assert before['max'][:2] == after['max'][:2]
        sole[side] = {'vertices_below_65mm': len(idx), 'before': before, 'after': after,
                      'length_before_m': before['max'][2]-before['min'][2],
                      'length_after_m': after['max'][2]-after['min'][2],
                      'max_retraction_m': max(p[i][2]-q[i][2] for i in idx)}
    correspondence, negative = None, {}
    if source is not None:
        spec = importlib.util.spec_from_file_location('preview_checked', HERE/'preview.py')
        preview = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(preview)
        native_raw = (HERE/'boots-native.json').read_bytes()
        assert hashlib.sha256(native_raw).hexdigest() == NATIVE
        native = json.loads(native_raw)
        points = [(p[i], desired(p[i])) for i in active]
        _, correspondence = preview.native_aliases(points, native)
        for name, key in [('wrong_source_100um', 'before'), ('wrong_deformation_100um', 'after')]:
            broken = copy.deepcopy(native)
            broken[0][key][0] += .0001
            try:
                preview.native_aliases(points, broken)
            except AssertionError as error:
                negative[name] = {'rejected': True, 'reason': str(error)}
            else:
                raise AssertionError('Negative control was accepted: '+name)
        for name, args in [('wrong_source_hash', (candidate, HERE/'must-not-be-created.glb')),
                           ('overwrite_candidate', (source, candidate)),
                           ('overwrite_source', (source, source))]:
            try:
                preview.export(*args)
            except AssertionError:
                negative[name] = {'rejected': True}
            else:
                raise AssertionError('Export safeguard accepted: '+name)
        assert source.read_bytes() == raw
        assert (HERE/'boots-native.json').read_bytes() == native_raw
    assert candidate.read_bytes() == new_raw
    report = {'source_sha256': SOURCE, 'candidate_sha256': CANDIDATE, 'source_bytes': source_bytes,
              'mode': 'candidate-only preservation contract' if source is None else 'historical source and native correspondence',
              'native_correspondence_checked': source is not None,
              'candidate_bytes': len(new_raw), 'appended_bytes': len(new_raw)-source_bytes,
              'original_binary_prefix_preserved_bytes': len(binary), 'semantic_json_allowed_changes': allowed,
              'all_original_accessors_byte_identical': len(doc['accessors']),
              'authoring_field_vertices': len(active), 'float32_position_rows_changed': len(changed),
              'untouched_position_normal_tangent_rows_exact': len(p)-len(active),
              'all_lateral_and_height_coordinates_exact': True,
              'maximum_position_float32_error_m': max_position_error,
              'minimum_forward_jacobian': min_derivative, 'maximum_finite_jacobian_error': max_jacobian_error,
              'maximum_normal_error': max_normal_error, 'maximum_tangent_error': max_tangent_error,
              'maximum_normal_tangent_dot': max_orthogonality, 'maximum_squared_unit_error': max_unit_error,
              'nondegenerate_affected_triangles': faces, 'minimum_face_normal_cosine': min_face_cosine,
              'sole_rest_bounds': sole, 'native_correspondence': correspondence,
              'negative_controls': negative,
              'status': 'PASS preservation and deformation; '+('native correspondence not rerun; ' if source is None else '')+'runtime pitched-sole replay is a separate check'}
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'check.py SOURCE.glb CANDIDATE.glb REPORT.json OR check.py --candidate-only CANDIDATE.glb REPORT.json'
    if sys.argv[1] == '--candidate-only':
        main(None, Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        main(*(Path(p) for p in sys.argv[1:]))
