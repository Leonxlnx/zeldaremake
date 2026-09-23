"""Distal boot-tip art preview. Reuses the reviewed September-20 geometry exporter."""
import hashlib
import importlib.util
import inspect
import itertools
import json
import math
import struct
import tempfile
from pathlib import Path

out = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('prior_boots', out.parent / '2026-09-20-run-arms/boots.py')
prior = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prior)
SOURCE_SHA = '89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b'


def smooth(value, low, high):
    t = max(0, min(1, (value-low)/(high-low)))
    return t*t*(3-2*t), 6*t*(1-t)/(high-low) if low < value < high else 0


def field(p):
    x, y, z = p
    forward = -y
    if forward <= .09 or z >= .16:
        return tuple(p), (1, 1, 0, 0)
    a, da = smooth(forward, .09, .15)
    b, db = smooth(z, .10, .16)
    weight = a*(1-b)
    delta = .10*weight*(forward-.09)
    sy = 1-.10*(weight+(forward-.09)*da*(1-b))
    dy = -.10*(forward-.09)*a*db
    return (x, y+delta, z), (1, sy, 0, dy)


prior.field = field


def source_points(raw):
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    binary = raw[28+size:]
    result = []
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            accessor = doc['accessors'][primitive['attributes']['POSITION']]
            assert accessor['componentType'] == 5126 and accessor['type'] == 'VEC3' and 'sparse' not in accessor
            view = doc['bufferViews'][accessor['bufferView']]
            start = view.get('byteOffset', 0)+accessor.get('byteOffset', 0)
            for i in range(accessor['count']):
                p = struct.unpack_from('<fff', binary, start+i*view.get('byteStride', 12))
                q, _ = field((p[0], -p[2], p[1]))
                q = (q[0], q[2], -q[1])
                if p != q:
                    result.append((p, q))
    return result


def native_aliases(points, native):
    """Match raw imported vertices, then compare the authored deformation delta."""
    assert len(points) == len(native) > 0, 'Native/source vertex counts differ'
    def bucket(p, cell):
        return tuple(math.floor(v/cell) for v in p)
    def index(rows, cell):
        grid = {}
        for i, p in enumerate(rows):
            grid.setdefault(bucket(p, cell), []).append(i)
        return grid
    def nearby(grid, p, cell):
        key = bucket(p, cell)
        return [i for d in itertools.product((-1, 0, 1), repeat=3)
                for i in grid.get(tuple(key[k]+d[k] for k in range(3)), [])]
    original = [r['before'] for r in native]
    grid = index(original, 3e-6)
    used, aliases = set(), []
    source_error = after_error = delta_error = 0.0
    for p, q in points:
        ids = [i for i in nearby(grid, p, 3e-6) if i not in used]
        assert ids, 'Native correspondence is not one-to-one'
        i = min(ids, key=lambda n: math.dist(p, original[n]))
        source_error = max(source_error, math.dist(p, original[i]))
        assert source_error <= 3e-6, 'Raw native source differs by >3 µm'
        after_error = max(after_error, math.dist(q, native[i]['after']))
        delta_error = max(delta_error, math.dist([q[k]-p[k] for k in range(3)],
                         [native[i]['after'][k]-native[i]['before'][k] for k in range(3)]))
        assert delta_error <= 1e-6, 'Native deformation delta parity exceeds 1 µm'
        used.add(i)
        # The old writer checks absolute points by rounded keys. Give it the
        # raw-source key plus the independently matched native deformation delta.
        # This is validation input only: it writes field(p), never these aliases.
        aliases.append({'before': list(p), 'after': [p[k]+native[i]['after'][k]-native[i]['before'][k]
                                                    for k in range(3)]})
    assert len(used) == len(native)
    return aliases, {'correspondence': 'raw one-to-one nearest source; no registration or fitted transform',
                     'raw_native_source_error_m': source_error, 'raw_native_after_error_m': after_error,
                     'deformation_delta_error_m': delta_error, 'one_to_one_vertices': len(used),
                     'raw_source_tolerance_m': 3e-6, 'deformation_delta_tolerance_m': 1e-6}


def native():
    import bpy
    baseline = bpy.data.scenes['Link | September21 rebuilt clean run arms']
    name = 'Link | September21 shorter boot tips'
    assert name not in bpy.data.scenes, 'Do not deform an existing study twice'
    assert not (out/'boots-native.json').exists(), 'Preserve prior evidence'
    bpy.context.window.scene = baseline
    bpy.ops.scene.new(type='FULL_COPY')
    scene = bpy.context.scene
    scene.name = name
    body = next(o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
    original = next(o for o in baseline.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
    mesh = body.data
    assert mesh is not original.data
    normals = [tuple(n.vector) for n in original.data.corner_normals]
    rows, jacobians = [], {}
    for v in original.data.vertices:
        p = tuple(v.co)
        q, j = field(p)
        if p == q:
            continue
        jacobians[v.index] = j
        for key in mesh.shape_keys.key_blocks:
            key.data[v.index].co.y += q[1]-p[1]
        mesh.vertices[v.index].co = q
        rows.append({'before': [p[0], p[2], -p[1]], 'after': [q[0], q[2], -q[1]]})
    mesh.normals_split_custom_set([prior.normal(n, jacobians.get(loop.vertex_index, (1, 1, 0, 0)))
                                   if loop.vertex_index in jacobians else n
                                   for n, loop in zip(normals, mesh.loops)])
    mesh.update()
    assert rows and all(r['before'][:2] == r['after'][:2] for r in rows)
    assert all(0 < r['before'][2]-r['after'][2] < .0115 for r in rows)
    (out/'boots-native.json').write_text(json.dumps(rows), encoding='utf-8')
    summary = {'scene': name, 'changed_native_vertices': len(rows),
               'max_shortening_m': max(r['before'][2]-r['after'][2] for r in rows),
               'width_height_heel_cuff_ankle_unchanged': True,
               'status': 'Native preview only; visual and runtime contact review pending'}
    (out/'native-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary))


def export(source, target):
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SOURCE_SHA
    assert source.resolve() != target.resolve()
    assert not target.exists(), 'Do not overwrite an existing candidate'
    assert not target.with_suffix('.json').exists(), 'Do not overwrite an existing export report'
    native_file = target.parent/'boots-native.json'
    native_bytes = native_file.read_bytes()
    aliases, correspondence = native_aliases(source_points(raw), json.loads(native_bytes))
    correspondence['original_native_rows_sha256'] = hashlib.sha256(native_bytes).hexdigest()
    # Reuse the historical writer unchanged on disk. Its old height-only guard
    # renormalizes untouched low vertices; use this field's exact identity guard.
    code = inspect.getsource(prior.export)
    assert code.count('if z>=.20:') == 1, 'Historical writer changed; review the adapter'
    code = code.replace('if z>=.20:', 'if new == positions[i]:')
    namespace = dict(vars(prior))
    exec(compile(code, str(out/'preview.py')+' [reviewed writer adapter]', 'exec'), namespace)
    with tempfile.TemporaryDirectory(prefix='.boot-export-', dir=target.parent) as folder:
        stage = Path(folder).resolve()
        assert stage.parent == target.parent.resolve(), 'Temporary cleanup must stay in the evidence directory'
        (stage/'boots-native.json').write_text(json.dumps(aliases), encoding='utf-8')
        staged = stage/target.name
        namespace['export'](source, staged)
        report = json.loads(staged.with_suffix('.json').read_text())
        with target.open('xb') as handle:
            handle.write(staged.read_bytes())
    assert native_file.read_bytes() == native_bytes, 'Native evidence was modified'
    # The reused writer's old broad-scaling labels do not describe this localized field.
    for key in ['width_scale', 'length_scale', 'fade_height_m']:
        report.pop(key)
    report.update({'width_scale': 1, 'distal_length_scale': .90, 'forward_pivot_m': .09,
                   'forward_fade_m': [.09, .15], 'height_fade_m': [.10, .16],
                   'native_correspondence': correspondence, 'untouched_normal_tangent_rows_preserved': True})
    target.with_suffix('.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    (target.parent/'native-correspondence.json').write_text(json.dumps(correspondence, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3:
        export(Path(sys.argv[1]), Path(sys.argv[2]))
    else:
        native()
