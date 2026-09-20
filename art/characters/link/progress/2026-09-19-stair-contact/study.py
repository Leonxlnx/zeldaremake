"""Lower the authored stair swing; retain stride, hips, upper body and planted targets."""
import ast,bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector

out=Path(__file__).resolve().parent;root=out.parents[1]
source=root/'experiments/2026-09-13/source-runtime/cc0-arm-narrow-study.blend'
with bpy.data.libraries.load(str(source),link=False) as (_,loaded):loaded.scenes=['Link | narrow CC0 arm study']
scene=loaded.scenes[0];scene.name='Link | September19 lower stair swing';bpy.context.window.scene=scene
rig=next(o for o in scene.objects if o.type=='ARMATURE');data=rig.data;data.pose_position='POSE'
solver=root/'rig_runtime.py';tree=ast.parse(solver.read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'orient_bone','solve_leg'}],type_ignores=[]),str(solver),'exec'))
track=rig.animation_data.nla_tracks['stairs'];old=track.strips[0].action
assert all(t.mute for t in rig.animation_data.nla_tracks)
frames=176;fps=240;factor=frames/track.strips[0].action_frame_end;lift_scale=.06/.145
rig.animation_data.action=old;rig.animation_data.action_slot=old.slots[0];samples=[]
# Invalidate the source file's evaluated run pose before sampling stairs at frame zero.
rig.update_tag();scene.frame_set(-1);bpy.context.view_layer.update()
for f in range(frames+1):
    native=f/factor;scene.frame_set(int(native),subframe=native-int(native));bpy.context.view_layer.update()
    pair={}
    for side in ['L','R']:
        ankle=rig.pose.bones['ankle'+side];p=ankle.head.copy()
        rot=(ankle.matrix.to_3x3()@data.bones['ankle'+side].matrix_local.to_3x3().inverted()).to_euler()
        # Subframe FK interpolation adds at most 0.00181 degrees of non-pitch rotation.
        assert abs(rot.y)<1e-4 and abs(rot.z)<1e-4
        p.z-=max(0,p.z-.11)*(1-lift_scale)
        pair[side]=(p,rot.x*lift_scale)
    samples.append(pair)
action=old.copy();action.name='stairs | lower swing September19';edited={j+s for j in ['thigh','knee','ankle'] for s in ['L','R']}
def curves():return [f for l in action.layers for st in l.strips for bag in st.channelbags for f in bag.fcurves]
for l in action.layers:
    for st in l.strips:
        for bag in st.channelbags:
            for f in list(bag.fcurves):
                if f.data_path.split('"')[1] in edited:bag.fcurves.remove(f)
                else:
                    for k in f.keyframe_points:k.co.x*=factor;k.handle_left.x*=factor;k.handle_right.x*=factor
def protected():return [(f.data_path,f.array_index,[tuple(k.co) for k in f.keyframe_points]) for f in curves() if f.data_path.split('"')[1] not in edited]
before=protected();rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
scene.render.fps=fps;error=0;ends=[]
for f,pair in enumerate(samples):
    scene.frame_set(f);bpy.context.view_layer.update()
    for side,(target,pitch) in pair.items():error=max(error,solve_leg(side,target,pitch))
    for name in edited:
        for prop in ['location','rotation_quaternion','scale']:rig.pose.bones[name].keyframe_insert(prop,frame=f,group=name)
    if f in (0,frames):ends.append({b.name:[v for row in b.matrix for v in row] for b in rig.pose.bones})
assert protected()==before
loop=max(abs(a-b) for name in ends[0] for a,b in zip(ends[0][name],ends[1][name]));assert loop<1e-5,('Loop did not close',loop)
for f in curves():
    for k in f.keyframe_points:k.interpolation='LINEAR'
rig.animation_data.action=None;strip=track.strips[0];strip.action=action;strip.action_slot=action.slots[0];strip.action_frame_end=frames;strip.frame_end=frames
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);stem='stairs-lower-swing'
bpy.data.libraries.write(str(out/(stem+'-study.blend')),{scene},fake_user=True,compress=True)
bpy.data.libraries.write(str(out/(stem+'-action.blend')),{action},fake_user=True,compress=True)
report={'scene':scene.name,'gait':'stairs','frames':frames,'fps':fps,'cycle_s':frames/fps,'stride_m':.8066667,'preserve_hips':True,'lift_scale':lift_scale,'bone_error_m':error,'loop_error':loop,'other_curves_exact_at_normalized_phase':True,'status':'Native candidate; actual shoe and world checks required'}
(out/(stem+'-study.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report))
