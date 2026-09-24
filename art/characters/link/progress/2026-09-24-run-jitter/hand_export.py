"""Append reviewed hand35 geometry to an explicitly pinned local run candidate.

python hand_export.py SOURCE.glb EXPECTED_SHA256 CANDIDATE.glb
Reuses the boot writer; never replaces the source or public model.
"""
import copy, hashlib, importlib.util, inspect, json, math, re, tempfile
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
BASE_SHA = '46dcbcc36490ee5c86f6d9eb28d58d1743f60cfab02bb0c899b8388b6eda3de0'


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


reader = module('hand35_reader', HERE.parent/'2026-09-21-boot-tip/check.py')
adapter = module('hand35_writer', HERE.parent/'2026-09-21-boot-tip/preview.py')


def native(p):
    return p[0], -p[2], p[1]


def gltf(p):
    return p[0], p[2], -p[1]


def unit(v):
    v = np.asarray(v, dtype=float)
    assert np.isfinite(v).all() and np.linalg.norm(v) > 0
    return tuple(v/np.linalg.norm(v))


def normal(n, jacobian):
    return unit(np.linalg.solve(np.asarray(jacobian).T, n))


def push(t, jacobian):
    return tuple(np.asarray(jacobian) @ t)


def prepared_plan():
    profile = module('hand35_export_profile', HERE.parent/'2026-09-23-hand-curl/prepare.py')
    profile.SOURCE, profile.ANGLE_DEG, profile.HERE = BASE_SHA, 35, HERE
    code = inspect.getsource(profile.prepare)
    old = "asset = HERE.parents[4]/'public/models/link/link-runtime.glb'"
    assert code.count(old) == 1
    code = code.replace(old, "asset = HERE/'baseline-46.glb'")
    exec(compile(code, str(HERE/'hand_export.py')+' [pinned preparation]', 'exec'), vars(profile))
    plan = profile.prepare()
    assert plan == json.loads((HERE/'hand35-plan.json').read_text()), 'Native preparation differs'
    return plan


def morph_values(doc, binary, index):
    """Decode existing VEC3 morphs, including sparse zero-based targets."""
    import struct
    accessor = doc['accessors'][index]
    assert accessor['type'] == 'VEC3' and accessor['componentType'] == 5126
    base_doc = copy.deepcopy(doc)
    base_doc['accessors'][index].pop('sparse', None)
    values = list(reader.rows(base_doc, binary, index)[0]) if 'bufferView' in accessor else [(0., 0., 0.)]*accessor['count']
    if 'sparse' in accessor:
        sparse = accessor['sparse']
        v = doc['bufferViews'][sparse['indices']['bufferView']]
        offset = v.get('byteOffset', 0)+sparse['indices'].get('byteOffset', 0)
        fmt = {5121: 'B', 5123: 'H', 5125: 'I'}[sparse['indices']['componentType']]
        indices = struct.unpack_from('<'+str(sparse['count'])+fmt, binary, offset)
        v = doc['bufferViews'][sparse['values']['bufferView']]
        offset = v.get('byteOffset', 0)+sparse['values'].get('byteOffset', 0)
        assert len(set(indices)) == len(indices) and all(0 <= i < len(values) for i in indices)
        for j, i in enumerate(indices):
            values[i] = struct.unpack_from('<3f', binary, offset+j*12)
    return values


def export(source, expected, target):
    source, target = Path(source).resolve(), Path(target).resolve()
    assert re.fullmatch('[0-9a-f]{64}', expected)
    assert source != target and target.parent == HERE and target.suffix == '.glb'
    assert not target.exists() and not target.with_suffix('.json').exists(), 'Preserve existing evidence'
    raw, doc, binary = reader.load(source, expected)
    _, baseline, baseline_binary = reader.load(HERE/'baseline-46.glb', BASE_SHA)
    assert binary[:len(baseline_binary)] == baseline_binary, 'Input must retain the untouched 46d binary prefix'
    assert all(doc[k] == baseline[k] for k in ('meshes', 'nodes', 'skins')), 'Run input changed the base geometry or rig'
    plan = prepared_plan()
    selected = {row['index']: row for row in plan['rows']}
    assert len(selected) == 1548 and not selected.keys() & set(plan['boundaryIndices'])
    receipt = json.loads((HERE/'hand35-native.json').read_text())
    assert receipt['sourceSha256'] == BASE_SHA and receipt['angleDeg'] == 35
    assert receipt['protectedPositionsWeightsUvTopologyMaterialsActionsExact'] and receipt['sourceUnchanged']
    native_file = HERE/'hand35-native-rows.json'
    native_bytes = native_file.read_bytes()
    native_rows = json.loads(native_bytes)
    assert {r['index'] for r in native_rows} == selected.keys()
    by_point = {}
    for row in selected.values():
        value = tuple(row['after']), row['jacobian']
        key = tuple(row['before'])
        assert key not in by_point or by_point[key] == value, 'Coincident hand aliases differ'
        by_point[key] = value
    identity = np.eye(3).tolist()
    def field(p):
        return by_point.get(tuple(p), (tuple(p), identity))
    adapter.field = adapter.prior.field = field
    points = adapter.source_points(raw)
    assert len(points) == len(selected)
    gltf_rows = [{'before': gltf(r['before']), 'after': gltf(r['after'])} for r in native_rows]
    aliases, correspondence = adapter.native_aliases(points, gltf_rows)
    for name in ('before', 'after'):
        broken = copy.deepcopy(gltf_rows)
        broken[0][name] = list(broken[0][name]); broken[0][name][0] += .0001
        try:
            adapter.native_aliases(points, broken)
        except AssertionError:
            pass
        else:
            raise AssertionError('Native 100-micrometre negative control passed: '+name)
    code = inspect.getsource(adapter.prior.export)
    replacements = {
        "for m in doc['meshes']:": "for m in [doc['meshes'][2]]:",
        'if min(v[1] for v in positions)>=.20:continue': 'if not any(tuple((p[0],-p[2],p[1])) in by_point for p in positions):continue',
        'if z>=.20:': 'if new == positions[i]:',
        'tx,tz,minus_ty,w=tangents[i];sx,sy,dx,dy=j;t=(sx*tx+dx*tz,sy*(-minus_ty)+dy*tz,tz)': 'tx,tz,minus_ty,w=tangents[i];t=push((tx,-minus_ty,tz),j)',
    }
    for before, after in replacements.items():
        assert code.count(before) == 1, ('Historical writer changed', before)
        code = code.replace(before, after)
    namespace = dict(vars(adapter.prior), field=field, normal=normal, push=push, by_point=by_point)
    exec(compile(code, str(HERE/'hand_export.py')+' [reviewed boot writer]', 'exec'), namespace)
    with tempfile.TemporaryDirectory(prefix='.hand35-export-', dir=HERE) as folder:
        stage = Path(folder).resolve()
        assert stage.parent == HERE
        (stage/'boots-native.json').write_text(json.dumps(aliases))
        staged = stage/target.name
        namespace['export'](source, staged)
        result = staged.read_bytes()
        sha = hashlib.sha256(result).hexdigest()
        _, newer, new_binary = reader.load(staged, sha)
        assert new_binary[:len(binary)] == binary
        assert newer['accessors'][:len(doc['accessors'])] == doc['accessors']
        assert newer['bufferViews'][:len(doc['bufferViews'])] == doc['bufferViews']
        restored = copy.deepcopy(newer)
        restored['buffers'] = doc['buffers']
        restored['accessors'] = restored['accessors'][:len(doc['accessors'])]
        restored['bufferViews'] = restored['bufferViews'][:len(doc['bufferViews'])]
        allowed = []
        for mi, (old_mesh, new_mesh) in enumerate(zip(doc['meshes'], restored['meshes'])):
            for pi, (old_part, new_part) in enumerate(zip(old_mesh['primitives'], new_mesh['primitives'])):
                for key in ('POSITION', 'NORMAL', 'TANGENT'):
                    if old_part['attributes'].get(key) != new_part['attributes'].get(key):
                        allowed.append([mi, pi, key]); new_part['attributes'][key] = old_part['attributes'][key]
        assert allowed == [[2, 0, key] for key in ('POSITION', 'NORMAL', 'TANGENT')]
        assert restored == doc and len(newer['accessors']) == len(doc['accessors'])+3
        assert len(newer['bufferViews']) == len(doc['bufferViews'])+3
        old_attrs, new_attrs = [d['meshes'][2]['primitives'][0]['attributes'] for d in (doc, newer)]
        old_rows = {k: reader.rows(doc, binary, old_attrs[k]) for k in ('POSITION', 'NORMAL', 'TANGENT')}
        new_rows = {k: reader.rows(newer, new_binary, new_attrs[k]) for k in old_rows}
        max_normal = max_tangent = 0.
        for i, p in enumerate(old_rows['POSITION'][0]):
            if i not in selected:
                assert all(old_rows[k][1][i] == new_rows[k][1][i] for k in old_rows), 'Unselected geometry changed'
                continue
            row = selected[i]
            assert native(p) == tuple(row['before'])
            assert new_rows['POSITION'][0][i] == gltf(row['after'])
            n = normal(native(old_rows['NORMAL'][0][i]), row['jacobian'])
            t = push(native(old_rows['TANGENT'][0][i][:3]), row['jacobian'])
            t = unit(np.asarray(t)-np.dot(t, n)*np.asarray(n))
            nn, tt = new_rows['NORMAL'][0][i], new_rows['TANGENT'][0][i]
            max_normal = max(max_normal, math.dist(nn, gltf(n)))
            max_tangent = max(max_tangent, math.dist(tt[:3], gltf(t)))
            assert tt[3] == old_rows['TANGENT'][0][i][3]
            assert abs(np.dot(nn, tt[:3])) < 2e-7 and abs(np.dot(nn, nn)-1) < 2e-7 and abs(np.dot(tt[:3], tt[:3])-1) < 2e-7
        assert max_normal < 1e-7 and max_tangent < 1e-7
        morph_normal_max = 0.
        for target_morph in doc['meshes'][2]['primitives'][0].get('targets', []):
            for key, ai in target_morph.items():
                values = morph_values(doc, binary, ai)
                largest = max(abs(x) for i in selected for x in values[i])
                if key == 'POSITION':
                    assert largest == 0, 'Hand has a nonzero shape-key displacement'
                else:
                    assert key == 'NORMAL' and largest <= 2**-23
                    morph_normal_max = max(morph_normal_max, largest)
        draw = np.asarray(reader.rows(doc, binary, doc['meshes'][2]['primitives'][0]['indices'])[0]).reshape((-1, 3))
        draw = draw[np.any(np.isin(draw, list(selected)), axis=1)]
        before, after = [np.asarray(r['POSITION'][0]) for r in (old_rows, new_rows)]
        a = np.cross(before[draw[:, 1]]-before[draw[:, 0]], before[draw[:, 2]]-before[draw[:, 0]])
        b = np.cross(after[draw[:, 1]]-after[draw[:, 0]], after[draw[:, 2]]-after[draw[:, 0]])
        valid = np.linalg.norm(a, axis=1) > 1e-12
        cosine = np.sum(a[valid]*b[valid], axis=1)/(np.linalg.norm(a[valid], axis=1)*np.linalg.norm(b[valid], axis=1))
        assert np.isfinite(cosine).all() and cosine.min() > 0
        report = {'sourceSha256': expected, 'baseGeometrySha256': BASE_SHA, 'candidateSha256': sha,
                  'changedRows': len(selected), 'allowedAccessorRebindings': allowed,
                  'originalBinaryPrefixBytesExact': len(binary), 'protectedMetadataClipsGeometryWeightsUvMorphsExact': True,
                  'nativeCorrespondence': correspondence, 'nativeRowsSha256': hashlib.sha256(native_bytes).hexdigest(),
                  'native100umNegativeControlsRejected': True, 'portableChecks': plan['checks'],
                  'maximumNormalError': max_normal, 'maximumTangentError': max_tangent,
                  'minimumCandidateFaceNormalCosine': float(cosine.min()), 'handMorphPositionDeltaZero': True,
                  'preservedHandMorphNormalRoundingResidue': morph_normal_max,
                  'status': 'Local append-only hand geometry candidate; final run/idle visual review remains required'}
        assert source.read_bytes() == raw and native_file.read_bytes() == native_bytes
        with target.open('xb') as stream:
            stream.write(result)
        with target.with_suffix('.json').open('x', encoding='utf-8') as stream:
            json.dump(report, stream, indent=2, allow_nan=False); stream.write('\n')
    print(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    import sys
    assert len(sys.argv) == 4, 'hand_export.py SOURCE.glb EXPECTED_SHA256 CANDIDATE.glb'
    export(sys.argv[1], sys.argv[2], sys.argv[3])
