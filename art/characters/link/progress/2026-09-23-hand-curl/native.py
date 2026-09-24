"""ROOT-only copied hand study. Requires the exact visually confirmed long-digit seeds."""
import ast, hashlib, importlib.util, json, math
from pathlib import Path

out = Path(__file__).resolve().parent
confirmed = {'L': [75512, 75592, 78323, 76365], 'R': [78136, 78015, 77299, 76829]}
assert globals().get('CONFIRMED_SEEDS') == confirmed, 'HOLD: root must confirm both native long-digit selections'
spec = importlib.util.spec_from_file_location('hand_curl_plan', out/'prepare.py')
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)
plan = profile.prepare()
assert plan['seeds'] == confirmed and plan['angleDeg'] == 18
assert plan == json.loads((out/'hand-curl-plan.json').read_text()), 'Portable preparation contract differs'

import bpy
import numpy as np
from mathutils import Matrix, Vector

name = 'Link | September23 loose fingers study'
outputs = [out/('hand-curl-'+suffix) for suffix in ('study.blend', 'native.json', 'native-rows.json')]
assert name not in bpy.data.scenes and all(not path.exists() for path in outputs), 'Preserve the first native study'
source = bpy.data.scenes['Link | September22 chest posture both straps']
for helper, functions in [
        (out.parent/'2026-09-22-body-posture/native.py', ('rig_of', 'body_of', 'curves', 'fingerprint')),
        (out.parent/'2026-09-22-head-owned-patch/preview_chest_weights.py', ('weights', 'geometry'))]:
    tree = ast.parse(helper.read_text())
    exec(compile(ast.Module([n for n in tree.body if isinstance(n, ast.FunctionDef)
                            and n.name in functions], []), str(helper), 'exec'))
original, original_rig = body_of(source), rig_of(source)
original_geometry, original_weights = geometry(original.data), weights(original)
clips = lambda rig: {t.name: [fingerprint(s.action) for s in t.strips] for t in rig.animation_data.nla_tracks}
original_clips = clips(original_rig)
def shape_rows(mesh):
    result = {}
    for key in mesh.shape_keys.key_blocks if mesh.shape_keys else []:
        values = np.empty(len(key.data)*3, dtype=np.float32)
        key.data.foreach_get('co', values)
        result[key.name] = values.reshape((-1, 3))
    return result
shapes = shape_rows(original.data)
source_shape_receipt = {key: hashlib.sha256(values.tobytes()).hexdigest() for key, values in shapes.items()}
before = np.array([tuple(v.co) for v in original.data.vertices])
assert len(before) == 88153
changed = {row['index']: row for row in plan['rows']}
assert changed and not set(changed) & set(plan['boundaryIndices'])
rest_error = max(math.dist(before[i], row['before']) for i, row in changed.items())
assert rest_error < 3e-6, ('Source native hand differs from7f', rest_error)
assert all(original_weights[i] in ({'handL': 1.0}, {'handR': 1.0}) for i in changed)
topology = [(tuple(p.vertices), p.material_index) for p in original.data.polygons]
uvs = [[tuple(e.uv) for e in layer.data] for layer in original.data.uv_layers]
original_scene = bpy.context.window.scene
try:
    bpy.context.window.scene = source
    bpy.ops.scene.new(type='FULL_COPY')
    scene = bpy.context.scene
    scene.name = name
    body, rig = body_of(scene), rig_of(scene)
    mesh = body.data
    assert mesh is not original.data and rig.data is not original_rig.data
    assert mesh.shape_keys is None or mesh.shape_keys is not original.data.shape_keys
    assert geometry(mesh) == original_geometry and weights(body) == original_weights and clips(rig) == original_clips
    normals = [tuple(n.vector) for n in original.data.corner_normals]
    inverse_transpose = {}
    deltas = np.zeros_like(before)
    for i, row in changed.items():
        delta = Vector(row['after'])-Vector(row['before'])
        deltas[i] = delta
        for key in mesh.shape_keys.key_blocks if mesh.shape_keys else []:
            key.data[i].co += delta
        mesh.vertices[i].co = Vector(before[i])+delta
        inverse_transpose[i] = Matrix(row['jacobian']).inverted().transposed()
    # Same normal and shape-key handling as the boot contour study; a full3x3
    # inverse transpose is required for this curved deformation.
    wanted_normals = [tuple((inverse_transpose[loop.vertex_index] @ Vector(n)).normalized())
                      if loop.vertex_index in changed else n for loop, n in zip(mesh.loops, normals)]
    mesh.normals_split_custom_set(wanted_normals)
    mesh.update()
    after = np.array([tuple(v.co) for v in mesh.vertices])
    protected = np.ones(len(before), dtype=bool)
    protected[list(changed)] = False
    assert np.array_equal(before[protected], after[protected]), 'A protected native position changed'
    delta_error = float(np.max(np.linalg.norm(after-before-deltas, axis=1)))
    assert delta_error < 1e-6
    shape_delta_error = 0.0
    for key, values in shape_rows(mesh).items():
        assert np.array_equal(values[protected], shapes[key][protected]), 'A protected shape-key position changed'
        shape_delta_error = max(shape_delta_error, float(np.max(np.linalg.norm(values-shapes[key]-deltas, axis=1))))
    assert shape_delta_error < 1e-6
    assert [(tuple(p.vertices), p.material_index) for p in mesh.polygons] == topology
    assert [[tuple(e.uv) for e in layer.data] for layer in mesh.uv_layers] == uvs
    assert weights(body) == original_weights and clips(rig) == original_clips
    unselected_normal_error = max((Vector(n.vector)-Vector(old)).length for loop, n, old in
                                 zip(mesh.loops, mesh.corner_normals, normals) if loop.vertex_index not in changed)
    selected_normal_error = max((Vector(n.vector)-Vector(want)).length for loop, n, want in
                               zip(mesh.loops, mesh.corner_normals, wanted_normals) if loop.vertex_index in changed)
    assert geometry(original.data) == original_geometry and weights(original) == original_weights
    assert clips(original_rig) == original_clips
    assert {key: hashlib.sha256(values.tobytes()).hexdigest() for key, values in shape_rows(original.data).items()} == source_shape_receipt
    asset = out.parents[4]/'public/models/link/link-runtime.glb'
    assert hashlib.sha256(asset.read_bytes()).hexdigest() == plan['sourceSha256']
    # Display the complete copied mesh at rest; source evaluation state is untouched.
    rig.data.pose_position = 'REST'
    scene.view_layers[0].update()
    report = {'sourceSha256': plan['sourceSha256'], 'scene': name, 'confirmedSeeds': confirmed,
              'angleDeg': plan['angleDeg'], 'changedRows': len(changed), 'sourceRestErrorM': rest_error,
              'nativeDeltaErrorM': delta_error, 'shapeKeyDeltaErrorM': shape_delta_error,
              'unselectedNativeNormalMaxError': unselected_normal_error,
              'selectedNativeNormalEncodingMaxError': selected_normal_error,
              'protectedPositionsWeightsUvTopologyMaterialsActionsExact': True, 'sourceUnchanged': True,
              'boundaryVerticesExact': True, 'portableChecks': plan['checks'], 'accepted': False,
              'status': 'HOLD: copied native18-degree distal-finger study; root must review shape, normals and contacts. No export or production change.'}
    outputs[2].write_text(json.dumps([{'index': i, 'before': before[i].tolist(), 'after': after[i].tolist()}
                                    for i in sorted(changed)], separators=(',', ':'))+'\n')
    bpy.data.libraries.write(str(outputs[0]), {scene}, fake_user=True, compress=True)
    outputs[1].write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
finally:
    bpy.context.window.scene = original_scene
