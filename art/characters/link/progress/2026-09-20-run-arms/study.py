"""Narrow the existing CC0 arm carriage, retaining its timing, roll and elbow flexion."""
import bpy, json, math
from pathlib import Path
from mathutils import Matrix, Vector

out=Path(__file__).resolve().parent
with bpy.data.libraries.load(str(out.parent/'2026-09-19-run-contact/run-flight-retained-study.blend'),link=False) as (_,loaded):
    loaded.scenes=['Link | September19 retained hips flight']
s=loaded.scenes[0];s.name='Link | September20 relaxed run arms'
bpy.context.window.scene=s
r=next(o for o in s.objects if o.type=='ARMATURE')
strip=r.animation_data.nla_tracks['run'].strips[0];original=strip.action
action=original.copy();action.name='run | relaxed arm carriage September20'
names={'shoulderL','shoulderR'}
def curves(a): return [f for layer in a.layers for st in layer.strips for bag in st.channelbags for f in bag.fcurves]
def protected(a): return [(f.data_path,f.array_index,[tuple(k.co) for k in f.keyframe_points]) for f in curves(a) if f.data_path.split('"')[1] not in names]
before=protected(original);rows=[];ends=[];source=[]
r.animation_data.action=original;r.animation_data.action_slot=original.slots[0]
for frame in range(113):
    s.frame_set(frame);s.view_layers[0].update()
    er=r.evaluated_get(bpy.context.evaluated_depsgraph_get())
    source.append({n:er.pose.bones[n].matrix.copy() for n in names})
r.animation_data.action=action;r.animation_data.action_slot=action.slots[0]
for frame,old in enumerate(source):
    s.frame_set(frame);s.view_layers[0].update()
    for side,sign in [('L',1),('R',-1)]:
        upper=r.pose.bones['shoulder'+side]
        rot=Matrix.Rotation(sign*.10,4,'Y')
        m=rot@old[upper.name];m.translation=old[upper.name].translation
        upper.matrix=m;s.view_layers[0].update()
    for name in names:
        for prop in ['location','rotation_quaternion','scale']:
            r.pose.bones[name].keyframe_insert(prop,frame=frame,group=name)
    rows.append({'frame':frame,'hands':{side:list(r.pose.bones['hand'+side].head) for side in ['L','R']}})
    if frame in [0,112]: ends.append({n:list(v for row in r.pose.bones[n].matrix for v in row) for n in names})
assert protected(action)==before
loop=max(abs(x-y) for n in names for x,y in zip(ends[0][n],ends[1][n]));assert loop<1e-6,loop
for f in curves(action):
    if f.data_path.split('"')[1] in names:
        for k in f.keyframe_points:k.interpolation='LINEAR'
r.animation_data.action=None;strip.action=action;strip.action_slot=action.slots[0]
s.frame_set(0)
bpy.data.libraries.write(str(out/'relaxed-run-study.blend'),{s},fake_user=True,compress=True)
report={'scene':s.name,'status':'Native candidate; render and collision validation pending','cycle_s':112/240,'stride_m':1.82,'preserve_hips':True,'edited_bones':sorted(names|{p+side for p in ['thigh','knee','ankle'] for side in ['L','R']}),'rotation_only_bones':sorted(names),'nonarm_channels_exact':True,'loop_error':loop,'rows':rows}
(out/'relaxed-run-study.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
