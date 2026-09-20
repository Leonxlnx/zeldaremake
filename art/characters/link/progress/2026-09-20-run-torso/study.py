"""Restore a restrained share of the existing CC0 chest turn, preserving leg motion."""
import bpy, json, math
from pathlib import Path
from mathutils import Matrix, Vector

out = Path(__file__).resolve().parent
with bpy.data.libraries.load(str(out.parent/'2026-09-20-run-arms/relaxed-run-study.blend'), link=False) as (_, loaded):
    loaded.scenes = ['Link | September20 relaxed run arms.003']
s = loaded.scenes[0]; s.name = 'Link | September20 running torso'
bpy.context.window.scene = s
r = next(o for o in s.objects if o.type == 'ARMATURE')
track = r.animation_data.nla_tracks['run']; old = track.strips[0].action
assert all(t.mute for t in r.animation_data.nla_tracks)
names = {'chest', 'head'}
def curves(a):
    return [f for layer in a.layers for st in layer.strips for bag in st.channelbags for f in bag.fcurves]
def protected(a):
    return [(f.data_path, f.array_index, [tuple(k.co) for k in f.keyframe_points]) for f in curves(a)
            if f.data_path.split('"')[1] not in names or not f.data_path.endswith('.rotation_quaternion')]
before = protected(old)
r.animation_data.action = old; r.animation_data.action_slot = old.slots[0]
poses = []
for f in range(113):
    s.frame_set(f); s.view_layers[0].update()
    poses.append({b.name: b.matrix.copy() for b in r.pose.bones})

source_scene = bpy.data.scenes['Quaternius | September20 source motion']
source = next(o for o in source_scene.objects if o.type == 'ARMATURE')
ad = source.animation_data; original_action, original_slot = ad.action, ad.action_slot
mutes = [t.mute for t in ad.nla_tracks]; previous_frame = source_scene.frame_current
try:
    bpy.context.window.scene = source_scene
    for t in ad.nla_tracks: t.mute = True
    strip = ad.nla_tracks['Jog_Fwd_Loop'].strips[0]
    ad.action = strip.action; ad.action_slot = strip.action_slot
    lo, hi = strip.action.frame_range
    yaw = []
    for f in range(112):
        phase = (f/112 + .078125) % 1  # Existing arm/leg phase alignment.
        frame = lo + phase*(hi-lo)
        source_scene.frame_set(int(frame), subframe=frame % 1); source_scene.view_layers[0].update()
        bone = source.pose.bones['DEF-spine.003']
        rotation = bone.matrix.to_quaternion() @ bone.bone.matrix_local.to_quaternion().inverted()
        lateral = rotation @ Vector((1, 0, 0))
        yaw.append(math.atan2(lateral.y, lateral.x))
finally:
    ad.action = original_action
    if original_action: ad.action_slot = original_slot
    for t, mute in zip(ad.nla_tracks, mutes): t.mute = mute
    source_scene.frame_set(previous_frame); bpy.context.window.scene = s
mean = sum(yaw)/len(yaw)
yaw = [.15*(v-mean) for v in yaw]; yaw.append(yaw[0])
action = old.copy(); action.name = 'run | restrained CC0 chest turn September20'
r.animation_data.action = action; r.animation_data.action_slot = action.slots[0]
rows = []; leg_error = head_error = 0
for f, (pose, angle) in enumerate(zip(poses, yaw)):
    s.frame_set(f); s.view_layers[0].update()
    chest = r.pose.bones['chest']
    m = Matrix.Rotation(angle, 4, 'Z') @ pose['chest']; m.translation = pose['chest'].translation
    chest.matrix = m; s.view_layers[0].update()
    head = r.pose.bones['head']
    m = pose['head'].copy(); m.translation = head.head
    head.matrix = m; s.view_layers[0].update()
    for n in names: r.pose.bones[n].keyframe_insert('rotation_quaternion', frame=f, group=n)
    for n in ['hips'] + [p+side for p in ['thigh','knee','ankle','toe'] for side in ['L','R']]:
        leg_error = max(leg_error, max(abs(a-b) for row_a,row_b in zip(r.pose.bones[n].matrix, pose[n]) for a,b in zip(row_a,row_b)))
    head_error = max(head_error, max(abs(a-b) for row_a,row_b in zip(head.matrix.to_3x3(),pose['head'].to_3x3()) for a,b in zip(row_a,row_b)))
    rows.append({'frame': f, 'chest_yaw_rad': angle})
assert protected(action) == before
assert leg_error < 1e-6 and head_error < 1e-6, (leg_error, head_error)
for c in curves(action):
    if c.data_path.split('"')[1] in names and c.data_path.endswith('.rotation_quaternion'):
        for k in c.keyframe_points: k.interpolation = 'LINEAR'
r.animation_data.action = None
strip = track.strips[0]; strip.action = action; strip.action_slot = action.slots[0]
for b in r.pose.bones: b.matrix_basis = Matrix.Identity(4)
s.frame_set(0)
bpy.data.libraries.write(str(out/'run-torso-study.blend'), {s}, fake_user=True, compress=True)
report = {'scene':s.name, 'cycle_s':112/240, 'stride_m':1.82, 'gait':'run',
    'source_sha256':'1e81bb6ca08c1c01008ad7fecad311d4419dbb691589c7ac5df95c8026c6ae37',
    'edited_bones':sorted(names), 'rotation_only_bones':sorted(names), 'preserve_hips':True,
    'source':'Quaternius Jog_Fwd_Loop', 'source_phase_offset':.078125, 'source_yaw_gain':.15,
    'protected_curves_exact':True, 'leg_matrix_error':leg_error, 'head_orientation_error':head_error,
    'status':'Native study; visual and runtime acceptance pending', 'rows':rows}
(out/'run-torso-study.json').write_text(json.dumps(report, indent=2))
print(json.dumps({k:v for k,v in report.items() if k != 'rows'}))
