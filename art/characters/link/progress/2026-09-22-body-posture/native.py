"""ROOT-run HOLD study: +10deg chest lean, accepted arms, compensated head, proven strap weights."""
import ast, bpy, hashlib, json, math
from pathlib import Path
from mathutils import Matrix

out = Path(__file__).resolve().parent
asset = Path(globals().get('SOURCE_ASSET', out.parents[4] / 'public/models/link/link-runtime.glb'))
expected = '4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850'
assert hashlib.sha256(asset.read_bytes()).hexdigest() == expected
name = 'Link | September22 forward chest posture study'
assert name not in bpy.data.scenes
assert all(not (out / ('body-posture-study'+suffix)).exists() for suffix in ('.blend', '.json'))
base = bpy.data.scenes['Link | September21 shorter boot tips']
strap_reference = bpy.data.scenes['Link | September22 isolated strap chest preview']
def rig_of(scene): return next(o for o in scene.objects if o.type == 'ARMATURE')
def body_of(scene): return next(o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
source_rig, source_body = rig_of(base), body_of(base)
original = source_rig.animation_data.nla_tracks['run'].strips[0].action
helper = out.parent / '2026-09-22-head-owned-patch/preview_chest_weights.py'
tree = ast.parse(helper.read_text())
exec(compile(ast.Module([n for n in tree.body if isinstance(n, ast.FunctionDef)
                        and n.name in ('weights', 'geometry')], []), str(helper), 'exec'))
island_path = out.parent / '2026-09-22-head-owned-patch/head-island-summary.json'
island_raw = island_path.read_bytes()
selected = set(json.loads(island_raw)['selectedHeadVertexIndices'])
source_weights, corrected_weights = weights(source_body), weights(body_of(strap_reference))
source_geometry = geometry(source_body.data)
assert len(selected) == 243 and len(corrected_weights) == len(source_weights)
assert all(source_weights[i] == {'head': 1} and corrected_weights[i] == {'chest': 1} for i in selected)
assert all(corrected_weights[i] == source_weights[i] for i in range(len(source_weights)) if i not in selected)
assert geometry(body_of(strap_reference).data) == source_geometry

names = ['chest', 'head']
paths = {'pose.bones["'+n+'"].rotation_quaternion' for n in names}
def curves(action):
    return [f for layer in action.layers for strip in layer.strips for bag in strip.channelbags for f in bag.fcurves]
def fingerprint(action, protected=False):
    return [(f.data_path, f.array_index, [(tuple(k.co), tuple(k.handle_left), tuple(k.handle_right),
            k.interpolation, k.handle_left_type, k.handle_right_type) for k in f.keyframe_points])
            for f in curves(action) if not protected or f.data_path not in paths]
def quaternion_step_deg(a, b):
    # Metadata only: acos(float32 w) rounds small but real chest steps to zero.
    a = [float(x)/math.sqrt(sum(float(v)**2 for v in a)) for x in a]
    b = [float(x)/math.sqrt(sum(float(v)**2 for v in b)) for x in b]
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    scalar = aw*bw+ax*bx+ay*by+az*bz
    vector = (aw*bx-ax*bw-ay*bz+az*by, aw*by+ax*bz-ay*bw-az*bx,
              aw*bz-ax*by+ay*bx-az*bw)
    return math.degrees(2*math.atan2(math.hypot(*vector), abs(scalar)))
original_fingerprint = fingerprint(original)
other_clips = {track.name: [fingerprint(strip.action) for strip in track.strips]
               for track in source_rig.animation_data.nla_tracks if track.name != 'run'}

# Copy the accepted complete scene to preserve every other clip. Reuse the exact
# validated strap assignment, checked against its native reference above.
bpy.context.window.scene = base
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = name
rig, body = rig_of(scene), body_of(scene)
assert body.data is not source_body.data
body.vertex_groups['head'].remove(sorted(selected))
body.vertex_groups['chest'].add(sorted(selected), 1, 'REPLACE')
assert weights(body) == corrected_weights and geometry(body.data) == source_geometry
# Head/chest are both outside the arm groups: the original contact face census
# is therefore unchanged by this assignment, without reclassification.
arm_weight = lambda row: sum(w for n, w in row.items() if n.startswith(('shoulder', 'elbow', 'hand')))
assert all(arm_weight(a) == arm_weight(b) for a, b in zip(source_weights, corrected_weights))
baseline = rig.animation_data.nla_tracks['run'].strips[0].action
assert fingerprint(baseline) == original_fingerprint
rig.animation_data.action = baseline
rig.animation_data.action_slot = baseline.slots[0]
for track in rig.animation_data.nla_tracks: track.mute = True
end = float(baseline.frame_range[1])
assert abs(baseline.frame_range[0]) < 1e-6
assert abs(end/(scene.render.fps/scene.render.fps_base)-28/60) < 1e-6
carried = [b.name for b in rig.data.bones if (b.name == 'chest' or 'chest' in [p.name for p in b.parent_recursive])
           and b.name != 'head' and 'head' not in [p.name for p in b.parent_recursive]]
protected = [b.name for b in rig.data.bones if b.name != 'chest' and 'chest' not in [p.name for p in b.parent_recursive]]
assert all(n in protected for n in ['hips', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toeL', 'toeR'])

def sample(frame):
    scene.frame_set(int(frame), subframe=frame-int(frame))
    scene.view_layers[0].update()
    graph = bpy.context.evaluated_depsgraph_get(); graph.update()
    er, eb = rig.evaluated_get(graph), body.evaluated_get(graph)
    world = {b.name: er.matrix_world @ b.matrix for b in er.pose.bones}
    p = {n: m.translation for n, m in world.items()}
    lateral = (p['shoulderL']-p['shoulderR']).normalized()
    up = (p['neck']-p['chest']).normalized()
    return {'object': er.matrix_world.copy(), 'world': world, 'lateral': lateral,
            'local_q': {b.name: b.rotation_quaternion.copy() for b in er.pose.bones},
            'chest_lean_deg': math.degrees(math.atan2(-up.y, up.z)),
            'strap': [eb.matrix_world @ eb.data.vertices[i].co for i in sorted(selected)]}

# Freeze all113 accepted poses before creating any selected replacement curve.
source = [sample(end*i/112) for i in range(113)]
rows = []
for old in source:
    chest = old['world']['chest']
    desired_chest = Matrix.Rotation(math.radians(10), 4, old['lateral']) @ chest
    desired_chest.translation = chest.translation
    carry = desired_chest @ chest.inverted()
    desired_head = old['world']['head'].copy()
    desired_head.translation = (carry @ old['world']['head']).translation
    local = {}
    for n, desired in [('chest', desired_chest), ('head', desired_head)]:
        bone = rig.data.bones[n]
        parent = old['world'][bone.parent.name]
        if n == 'head': parent = carry @ parent
        inv_object = old['object'].inverted()
        q = bone.convert_local_to_pose(inv_object @ desired, bone.matrix_local,
                parent_matrix=inv_object @ parent, parent_matrix_local=bone.parent.matrix_local,
                invert=True).to_quaternion().normalized()
        if rows and q.dot(rows[-1][n]) < 0: q.negate()
        local[n] = q
    rows.append(local)
loop = max(abs(a-b) for n in names for a, b in zip(rows[0][n], rows[-1][n]))
assert loop < 3e-6
rows[-1] = {n: rows[0][n].copy() for n in names}
action = baseline.copy()
action.name = 'run | forward chest posture with accepted arm-relative motion'
for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for f in list(bag.fcurves):
                if f.data_path in paths: bag.fcurves.remove(f)
bag = action.layers[0].strips[0].channelbag(action.slots[0])
for n in names:
    for axis in range(4):
        f = bag.fcurves.new('pose.bones["'+n+'"].rotation_quaternion', index=axis)
        f.keyframe_points.add(113)
        for i, row in enumerate(rows):
            f.keyframe_points[i].co = (end*i/112, row[n][axis])
            f.keyframe_points[i].interpolation = 'LINEAR'
        f.update()
assert fingerprint(action, True) == fingerprint(baseline, True)
strip = rig.animation_data.nla_tracks['run'].strips[0]
strip.action, strip.action_slot = action, action.slots[0]
rig.animation_data.action, rig.animation_data.action_slot = action, action.slots[0]
candidate = [sample(end*i/112) for i in range(113)]
protected_error = carried_error = head_error = strap_error = local_error = lean_error = 0.
for a, b in zip(source, candidate):
    carry = b['world']['chest'] @ a['world']['chest'].inverted()
    for n in protected:
        protected_error = max(protected_error, max(abs(x-y) for ra, rb in zip(a['world'][n], b['world'][n]) for x, y in zip(ra, rb)))
    for n in carried:
        wanted = carry @ a['world'][n]
        carried_error = max(carried_error, max(abs(x-y) for ra, rb in zip(wanted, b['world'][n]) for x, y in zip(ra, rb)))
        if n != 'chest': local_error = max(local_error, max(abs(x-y) for x, y in zip(a['local_q'][n], b['local_q'][n])))
    qa, qb = [r['world']['head'].to_quaternion().normalized() for r in (a, b)]
    if qa.dot(qb) < 0: qb.negate()
    head_error = max(head_error, max(abs(x-y) for x, y in zip(qa, qb)))
    strap_error = max(strap_error, max((carry @ x-y).length for x, y in zip(a['strap'], b['strap'])))
    lean_error = max(lean_error, abs(b['chest_lean_deg']-a['chest_lean_deg']-10))
assert protected_error == 0 and local_error == 0, (protected_error, local_error)
assert max(carried_error, head_error, strap_error) < 3e-6, (carried_error, head_error, strap_error)
assert lean_error < math.degrees(3e-6), lean_error
assert fingerprint(original) == original_fingerprint
assert {track.name: [fingerprint(strip.action) for strip in track.strips]
        for track in rig.animation_data.nla_tracks if track.name != 'run'} == other_clips
assert geometry(source_body.data) == source_geometry and weights(source_body) == source_weights
assert geometry(body.data) == source_geometry and weights(body) == corrected_weights
report = {'scene': name, 'source_sha256': expected, 'strap_reference_scene': strap_reference.name,
    'island_sha256': hashlib.sha256(island_raw).hexdigest(), 'cycle_s': 28/60, 'stride_m': 1.82,
    'gait': 'run', 'preserve_hips': True, 'edited_bones': names, 'rotation_only_bones': names,
    'added_chest_lean_deg': 10, 'field': 'Positive10deg around current anatomical shoulder-to-shoulder lateral axis, about chest origin. Head origin follows neck; original head world orientation restored.',
    'selected_strap_rows': 243, 'all_other_weights_exact': True, 'original_contact_face_classification_exact': True,
    'all_other_action_curves_exact': True, 'other_clips_exact': True, 'source_scene_unchanged': True,
    'protected_world_matrix_error': protected_error, 'carried_chest_neck_arm_matrix_error': carried_error,
    'neck_and_arm_local_quaternion_error': local_error, 'head_world_quaternion_component_error': head_error,
    'corrected_strap_rigid_carry_error_m': strap_error, 'additive_lean_error_deg': lean_error,
    'chest_lean_deg': {'before': [min(r['chest_lean_deg'] for r in source), max(r['chest_lean_deg'] for r in source)],
                       'after': [min(r['chest_lean_deg'] for r in candidate), max(r['chest_lean_deg'] for r in candidate)]},
    'loop_component_error_before_exact_closure': loop,
    'max_adjacent_native_step_deg': {n: max(quaternion_step_deg(a[n], b[n]) for a,b in zip(rows,rows[1:])) for n in names},
    'status': 'HOLD: corrected-strap control1289/21 contacts and matched wholebody views required. Mixed hips/head skin and head/neck clearance are not protected by common rigid chest motion. No export/runtime sweep yet.',
    'rows': [{'phase': i/112, 'rotations': {n: list(row[n]) for n in names}} for i,row in enumerate(rows)]}
scene.frame_set(0); scene.view_layers[0].update()
bpy.data.libraries.write(str(out / 'body-posture-study.blend'), {scene}, fake_user=True, compress=True)
(out / 'body-posture-study.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k != 'rows'}))
