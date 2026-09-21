"""Restrained CC0 chest turn on the current rig, using the existing native study workflow."""
import bpy, json, math
from pathlib import Path
from mathutils import Matrix
out = Path(__file__).resolve().parent
name = globals().get('SCENE_NAME', 'Link | September21 restrained torso')
gain = globals().get('GAIN', .5)
clearance = globals().get('CLEARANCE', 0.0)
edited = ['chest','head'] + (['shoulderL','shoulderR'] if clearance else [])
with bpy.data.libraries.load(str(out/'stairs-combined-native.blend'), link=False) as (_, loaded):
    loaded.scenes = ['Link | September21 stairs combined']
s = loaded.scenes[0]; s.name = name
bpy.context.window.scene = s
r = next(o for o in s.objects if o.type == 'ARMATURE')
track = r.animation_data.nla_tracks['run']; old = track.strips[0].action
r.animation_data.action = old; r.animation_data.action_slot = track.strips[0].action_slot
for t in r.animation_data.nla_tracks: t.mute = True
poses = []
for i in range(113):
    frame = i * (28/60*24)/112
    s.frame_set(int(frame), subframe=frame%1)
    graph = bpy.context.evaluated_depsgraph_get(); graph.update()
    poses.append({b.name:b.matrix.copy() for b in r.evaluated_get(graph).pose.bones})
action = old.copy(); action.name = name + ' run'
r.animation_data.action = action; r.animation_data.action_slot = action.slots[0]
yaw = [row['chest_yaw_rad']*gain for row in json.loads((out/'run-torso-study.json').read_text())['rows']]
max_leg_error = max_head_error = 0
for i, (pose, angle) in enumerate(zip(poses, yaw)):
    frame = i * (28/60*24)/112
    s.frame_set(int(frame), subframe=frame%1); s.view_layers[0].update()
    chest = r.pose.bones['chest']; m = Matrix.Rotation(angle, 4, 'Z') @ pose['chest']; m.translation = pose['chest'].translation
    chest.matrix = m; s.view_layers[0].update()
    head = r.pose.bones['head']; m = pose['head'].copy(); m.translation = head.head
    head.matrix = m; s.view_layers[0].update()
    if clearance:
        for side, sign in [('L',-1),('R',1)]:
            shoulder = r.pose.bones['shoulder'+side]
            inherited = shoulder.matrix.copy()
            m = Matrix.Rotation(sign*clearance,4,'Y') @ inherited; m.translation = inherited.translation
            shoulder.matrix = m; s.view_layers[0].update()
    for bone in edited: r.pose.bones[bone].keyframe_insert('rotation_quaternion', frame=frame, group=bone)
    graph = bpy.context.evaluated_depsgraph_get(); graph.update(); evaluated = r.evaluated_get(graph)
    for bone in ['hips']+[j+side for j in ['thigh','knee','ankle','toe'] for side in ['L','R']]:
        max_leg_error = max(max_leg_error, max(abs(a-b) for x,y in zip(evaluated.pose.bones[bone].matrix,pose[bone]) for a,b in zip(x,y)))
    max_head_error = max(max_head_error,max(abs(a-b) for x,y in zip(evaluated.pose.bones['head'].matrix.to_3x3(),pose['head'].to_3x3()) for a,b in zip(x,y)))
assert max_leg_error < 1e-6 and max_head_error < 1e-6,(max_leg_error,max_head_error)
for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for c in bag.fcurves:
                if c.data_path.split('"')[1] in edited and c.data_path.endswith('.rotation_quaternion'):
                    for k in c.keyframe_points: k.interpolation = 'LINEAR'
r.animation_data.action = None
strip = track.strips[0]; strip.action = action; strip.action_slot = action.slots[0]
for b in r.pose.bones: b.matrix_basis = Matrix.Identity(4)
s.frame_set(0)
label = globals().get('LABEL','torso-restrained')
bpy.data.libraries.write(str(out/(label+'.blend')), {s}, fake_user=True, compress=True)
report = {'scene':name,'source_sha256':'e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552','gait':'run','cycle_s':28/60,'stride_m':1.82,'edited_bones':edited,'rotation_only_bones':edited,'shoulder_clearance_rad':clearance,'preserve_hips':True,'source':'Quaternius Jog_Fwd_Loop','source_phase_offset':.078125,'source_yaw_gain':.15*gain,'leg_matrix_error':max_leg_error,'head_orientation_error':max_head_error,'rows':[{'frame':i,'chest_yaw_rad':y} for i,y in enumerate(yaw)]}
(out/(label+'-study.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
