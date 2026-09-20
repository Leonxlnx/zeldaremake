"""Small backward arm-carriage correction; retain all non-arm motion and exact clip duration."""
import bpy, json
from pathlib import Path
from mathutils import Matrix

out = Path(__file__).resolve().parent
name = 'Link | September20 clear arm carriage 08'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(out/'aligned-legs-study.blend'), link=False) as (_, loaded):
    loaded.scenes = ['Link | September20 aligned legs']
scene = loaded.scenes[0]
scene.name = name
scene.render.fps = 24
bpy.context.window.scene = scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
track = rig.animation_data.nla_tracks['run']
strip = track.strips[0]
original = strip.action
names = {part+side for part in ['shoulder', 'elbow'] for side in ['L', 'R']}
def curves(action):
    return [f for layer in action.layers for st in layer.strips for bag in st.channelbags for f in bag.fcurves]
def edited(f):
    return f.data_path.endswith('rotation_quaternion') and f.data_path.split('"')[1] in names
def protected(action):
    return [(f.data_path, f.array_index, [tuple(k.co) for k in f.keyframe_points]) for f in curves(action) if not edited(f)]

rig.animation_data.action = original
rig.animation_data.action_slot = strip.action_slot
for t in rig.animation_data.nla_tracks:
    t.mute = True
samples = []
end = original.frame_range[1]
for i in range(113):
    frame = end*i/112
    scene.frame_set(int(frame), subframe=frame-int(frame))
    scene.view_layers[0].update()
    evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
    desired, rotations = {}, {}
    for part, angle in [('shoulder', .10), ('elbow', .14)]:
        for side in ['L', 'R']:
            bone = evaluated.pose.bones[part+side]
            old = bone.matrix.copy()
            parent = desired.get(bone.parent.name, bone.parent.matrix)
            inherited = parent @ bone.parent.matrix.inverted() @ old
            rotation = Matrix.Rotation(angle, 4, 'X')
            if part == 'shoulder':
                rotation = Matrix.Rotation(-(.08 if side == 'L' else -.08), 4, 'Y') @ rotation
            mat = rotation @ inherited
            mat.translation = inherited.translation
            desired[bone.name] = mat
            local = bone.bone.convert_local_to_pose(mat, bone.bone.matrix_local,
                parent_matrix=parent, parent_matrix_local=bone.parent.bone.matrix_local, invert=True)
            q = local.to_quaternion().normalized()
            if samples and q.dot(samples[-1][bone.name]) < 0:
                q.negate()
            rotations[bone.name] = q
    samples.append(rotations)

action = original.copy()
action.name = 'run | natural carriage September20'
for layer in action.layers:
    for st in layer.strips:
        for bag in st.channelbags:
            for f in list(bag.fcurves):
                if edited(f):
                    bag.fcurves.remove(f)
bag = action.layers[0].strips[0].channelbag(action.slots[0])
for n in names:
    for axis in range(4):
        f = bag.fcurves.new('pose.bones["'+n+'"].rotation_quaternion', index=axis)
        f.keyframe_points.add(113)
        for i, sample in enumerate(samples):
            f.keyframe_points[i].co = (end*i/112, sample[n][axis])
            f.keyframe_points[i].interpolation = 'LINEAR'
        f.update()
ends = [samples[0], samples[-1]]
rows = [{'phase': i/112, 'rotations': {n:list(q) for n,q in row.items()}} for i,row in enumerate(samples)]
assert protected(action) == protected(original)
loop = max(min(max(abs(a-b) for a,b in zip(ends[0][n],ends[1][n])), max(abs(a+b) for a,b in zip(ends[0][n],ends[1][n]))) for n in names)
assert loop < 1e-5, loop
for f in curves(action):
    if edited(f):
        for k in f.keyframe_points:
            k.interpolation = 'LINEAR'
rig.animation_data.action = None
strip.action = action
strip.action_slot = action.slots[0]
scene.frame_set(0)
bpy.data.libraries.write(str(out/'natural-carriage-study.blend'), {scene}, fake_user=True, compress=True)
report = {'scene': name, 'cycle_s': 28/60, 'stride_m': 1.82, 'preserve_hips': True,
          'edited_bones': sorted(names), 'rotation_only_bones': sorted(names),
          'shoulder_back_radians': .10, 'elbow_open_radians': .14, 'shoulder_outward_radians': .08,
          'nonarm_channels_exact': True, 'loop_error': loop, 'rows': rows}
(out/'run-arms-study.json').write_text(json.dumps(report, indent=2), encoding='utf-8')

# An isolated, armature-only carrier uses 240 fps so the exporter retains 113 cycle samples.
carrier = bpy.data.scenes.new('Link | September20 clear08 arm export carrier')
carrier.render.fps = 240
crig = rig.copy()
crig.data = rig.data.copy()
crig.animation_data_clear()
carrier.collection.objects.link(crig)
crig.animation_data_create()
export_action = action.copy()
for f in curves(export_action):
    for k in f.keyframe_points:
        k.co.x *= 10
        k.handle_left.x *= 10
        k.handle_right.x *= 10
export_track = crig.animation_data.nla_tracks.new()
export_track.name = 'run'
export_strip = export_track.strips.new('run', 0, export_action)
export_strip.action_slot = export_action.slots[0]
export_track.mute = True
for b in crig.pose.bones:
    b.matrix_basis = Matrix.Identity(4)
job = out.parent/'2026-09-19-run-contact/export_native.py'
exec(compile(job.read_text(encoding='utf-8'), str(job), 'exec'), {'__file__': str(job), 'JOB': {'scene': carrier.name, 'out': str(out), 'stem': 'run-arms'}})
print(json.dumps({k:v for k,v in report.items() if k != 'rows'}))
