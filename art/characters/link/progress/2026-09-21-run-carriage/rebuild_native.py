"""ROOT executes in Blender: reconstruct four run rotations in a separate full scene copy.

Uses the smooth, hash-pinned 2459 GLB, then exactly the previously authored inward,
backward/outward and elbow-open corrections. No new artistic offset or smoothing.
The native carrier is evidence only; export_candidate.py patches the four reviewed
rotations onto the exact current delivery after the owner's native contact review.
"""
import bpy, hashlib, json, math
from pathlib import Path
from mathutils import Matrix, Quaternion

out = Path(__file__).resolve().parent
source = out / 'source-pre382.glb'
delivery = out.parents[4] / 'public/models/link/link-runtime.glb'
clean_sha = '2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4'
delivery_sha = '305603e92277952f345842e526216ff066b2b5888908eef054990199b6597a69'
assert hashlib.sha256(source.read_bytes()).hexdigest() == clean_sha
assert hashlib.sha256(delivery.read_bytes()).hexdigest() == delivery_sha
baseline = bpy.data.scenes['Link | September21 delivery baseline']
name = 'Link | September21 rebuilt clean run arms'
source_name = 'Link | September21 clean 2459 arm source'
carrier_name = 'Link | September21 rebuilt arm carrier'
stem = 'rebuilt-run'
assert all(n not in bpy.data.scenes for n in [name, source_name, carrier_name])
assert all(not (out / (stem + suffix)).exists() for suffix in ['-native.glb', '-study.json', '-study.blend'])
names = ['shoulderL', 'shoulderR', 'elbowL', 'elbowR']
period = 28 / 60

def curves(action):
    return [f for l in action.layers for st in l.strips for bag in st.channelbags for f in bag.fcurves]

def is_edited(f):
    return f.data_path.endswith('.rotation_quaternion') and f.data_path.split('"')[1] in names

def fingerprint(action, protected_only=False):
    return [(f.data_path, f.array_index, [(tuple(k.co), tuple(k.handle_left), tuple(k.handle_right),
             k.interpolation, k.handle_left_type, k.handle_right_type) for k in f.keyframe_points])
            for f in curves(action) if not protected_only or not is_edited(f)]

def angle(a, b):
    return math.degrees(2 * math.acos(min(1.0, abs(a.normalized().dot(b.normalized())))))

def set_frame(scene, frame):
    scene.frame_set(int(frame), subframe=frame-int(frame))
    scene.view_layers[0].update()

# Import a known-good exported source. Its glTF SLERP may cross quaternion signs;
# align the imported four-component curves before evaluating Blender's nlerp.
clean_scene = bpy.data.scenes.new(source_name)
clean_scene.render.fps = 24
bpy.context.window.scene = clean_scene
bpy.ops.import_scene.gltf(filepath=str(source))
clean_rig = next(o for o in clean_scene.objects if o.type == 'ARMATURE')
clean_strip = clean_rig.animation_data.nla_tracks['run'].strips[0]
clean_original = clean_strip.action
clean_action = clean_original.copy()
clean_action.name = 'run | 2459 source hemisphere aligned for native sampling'
sign_changes = {}
for n in names:
    fs = sorted((f for f in curves(clean_action) if f.data_path == 'pose.bones["'+n+'"].rotation_quaternion'), key=lambda f: f.array_index)
    assert [f.array_index for f in fs] == [0, 1, 2, 3]
    ts = [k.co.x for k in fs[0].keyframe_points]
    assert len(ts) == 57 and all([k.co.x for k in f.keyframe_points] == ts for f in fs)
    values = [Quaternion(tuple(f.keyframe_points[i].co.y for f in fs)).normalized() for i in range(len(ts))]
    count = 0
    for i, q in enumerate(values):
        if i and q.dot(values[i-1]) < 0:
            q.negate()
            count += 1
    for axis, f in enumerate(fs):
        for i, k in enumerate(f.keyframe_points):
            k.co = (ts[i], values[i][axis])
            k.interpolation = 'LINEAR'
        f.update()
    sign_changes[n] = count
clean_rig.animation_data.action = clean_action
clean_rig.animation_data.action_slot = clean_action.slots[0]
for track in clean_rig.animation_data.nla_tracks:
    track.mute = True

base_rig = next(o for o in baseline.objects if o.type == 'ARMATURE')
base_strip = base_rig.animation_data.nla_tracks['run'].strips[0]
base_action = base_strip.action
base_fingerprint = fingerprint(base_action)
assert abs(base_action.frame_range[0]) < 1e-6
assert abs(base_action.frame_range[1] / 24 - period) < 1e-6
assert abs(clean_action.frame_range[1] / 24 - period) < 1e-6
for n in names + ['hips', 'chest', 'handL', 'handR']:
    a, b = base_rig.data.bones[n], clean_rig.data.bones[n]
    assert (a.parent.name if a.parent else None) == (b.parent.name if b.parent else None)
    assert max(abs(x-y) for ra, rb in zip(a.matrix_local, b.matrix_local) for x, y in zip(ra, rb)) < 1e-6, n

# Snapshot all source samples before creating or writing the target action.
# The first stage reproduces 382's inward shoulder rotation. The second stage
# reproduces ea939's world-X backward/open and world-Y outward rotations.
samples, source_local = [], []
for i in range(113):
    set_frame(clean_scene, clean_action.frame_range[1] * i / 112)
    evaluated = clean_rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
    original = {n: evaluated.pose.bones[n].matrix.copy() for n in names + ['chest']}
    source_local.append({n: evaluated.pose.bones[n].rotation_quaternion.copy().normalized() for n in names})
    desired, row = {}, {}
    for side, sign in [('L', 1), ('R', -1)]:
        sn, en = 'shoulder'+side, 'elbow'+side
        inward = Matrix.Rotation(sign*.10, 4, 'Y') @ original[sn]
        inward.translation = original[sn].translation
        inherited_elbow = inward @ original[sn].inverted() @ original[en]
        shoulder = Matrix.Rotation(-sign*.08, 4, 'Y') @ Matrix.Rotation(.10, 4, 'X') @ inward
        shoulder.translation = inward.translation
        elbow = shoulder @ inward.inverted() @ inherited_elbow
        elbow_position = elbow.translation.copy()
        elbow = Matrix.Rotation(.14, 4, 'X') @ elbow
        elbow.translation = elbow_position
        desired[sn], desired[en] = shoulder, elbow
        for n in [sn, en]:
            bone = evaluated.pose.bones[n]
            parent = desired[bone.parent.name] if bone.parent.name in desired else original[bone.parent.name]
            local = bone.bone.convert_local_to_pose(desired[n], bone.bone.matrix_local,
                parent_matrix=parent, parent_matrix_local=bone.parent.bone.matrix_local, invert=True)
            q = local.to_quaternion().normalized()
            if samples and q.dot(samples[-1][n]) < 0:
                q.negate()
            row[n] = q
    samples.append(row)

def continuity(rows):
    return {n: {'max_step_degrees_240hz': max(angle(a[n], b[n]) for a, b in zip(rows, rows[1:])),
                'endpoint_degrees': angle(rows[0][n], rows[-1][n])} for n in names}

source_continuity, corrected_continuity = continuity(source_local), continuity(samples)
# This is a regression bound for this measured clean clip, not a medical range.
assert all(r['max_step_degrees_240hz'] < 3 for r in source_continuity.values()), source_continuity
assert all(r['max_step_degrees_240hz'] < 3 for r in corrected_continuity.values()), corrected_continuity
loop_component_error = max(abs(a-b) for n in names for a, b in zip(samples[0][n], samples[-1][n]))
assert loop_component_error < 1e-5, loop_component_error
samples[-1] = {n: samples[0][n].copy() for n in names}

bpy.context.window.scene = baseline
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = name
scene.render.fps = 24
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
strip = rig.animation_data.nla_tracks['run'].strips[0]
action = base_action.copy()
action.name = 'run | rebuilt clean authored arms September21'
for layer in action.layers:
    for st in layer.strips:
        for bag in st.channelbags:
            for f in list(bag.fcurves):
                if is_edited(f):
                    bag.fcurves.remove(f)
bag = action.layers[0].strips[0].channelbag(action.slots[0])
end = period * 24
for n in names:
    for axis in range(4):
        f = bag.fcurves.new('pose.bones["'+n+'"].rotation_quaternion', index=axis)
        f.keyframe_points.add(113)
        for i, row in enumerate(samples):
            f.keyframe_points[i].co = (end*i/112, row[n][axis])
            f.keyframe_points[i].interpolation = 'LINEAR'
        f.update()
assert fingerprint(action, True) == fingerprint(base_action, True)
assert fingerprint(base_action) == base_fingerprint
rig.animation_data.action = None
strip.action = action
strip.action_slot = action.slots[0]
for track in rig.animation_data.nla_tracks:
    track.mute = True
for bone in rig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
scene.frame_set(0)
bpy.data.libraries.write(str(out/(stem+'-study.blend')), {scene}, fake_user=True, compress=True)
report = {'scene': scene.name, 'source_sha256': delivery_sha, 'clean_arm_source_sha256': clean_sha,
          'cycle_s': period, 'stride_m': 1.82, 'preserve_hips': True, 'gait': 'run',
          'edited_bones': names, 'rotation_only_bones': names,
          'ordered_corrections_radians': {'shoulder_inward_Y': .10, 'shoulder_back_X': .10,
                                          'shoulder_outward_Y': .08, 'elbow_open_X': .14},
          'source_hemisphere_flips': sign_changes, 'source_continuity': source_continuity,
          'corrected_continuity': corrected_continuity, 'loop_component_error_before_exact_closure': loop_component_error,
          'nonselected_action_curves_exact': True, 'source_action_unchanged': True,
          'status': 'Native candidate only; raw exported continuity, strict mesh contact and game evidence pending',
          'rows': [{'phase': i/112, 'rotations': {n: list(row[n]) for n in names}} for i, row in enumerate(samples)]}
(out/(stem+'-study.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')

# Fresh key arrays avoid in-place retiming of an evaluated source action.
carrier = bpy.data.scenes.new(carrier_name)
carrier.render.fps = 240
crig = rig.copy()
crig.data = rig.data.copy()
crig.animation_data_clear()
carrier.collection.objects.link(crig)
crig.animation_data_create()
export_action = action.copy()
for f in curves(export_action):
    assert not f.modifiers
    data = [(float(k.co.x), float(k.co.y), k.interpolation) for k in f.keyframe_points]
    f.keyframe_points.clear()
    f.keyframe_points.add(len(data))
    for k, (x, y, interpolation) in zip(f.keyframe_points, data):
        k.co = (round(x * 10, 5), y)
        k.interpolation = interpolation
    f.update()
export_track = crig.animation_data.nla_tracks.new()
export_track.name = 'run'
export_strip = export_track.strips.new('run', 0, export_action)
export_strip.action_slot = export_action.slots[0]
export_strip.action_frame_start = 0
export_strip.action_frame_end = 112
export_strip.frame_end = 112
export_track.mute = True
for bone in crig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
job = out.parent/'2026-09-19-run-contact/export_native.py'
exec(compile(job.read_text(encoding='utf-8'), str(job), 'exec'),
     {'__file__': str(job), 'JOB': {'scene': carrier.name, 'out': str(out), 'stem': stem}})
bpy.context.window.scene = scene
print(json.dumps({k: v for k, v in report.items() if k != 'rows'}))
