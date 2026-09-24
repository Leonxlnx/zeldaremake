"""Blender run-only carriage fit on the verified delivered rig; no production writes."""
import ast, bpy, hashlib, json, math
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion

out = Path(__file__).resolve().parent
source = out/'baseline-46.glb'
sha = '46dcbcc36490ee5c86f6d9eb28d58d1743f60cfab02bb0c899b8388b6eda3de0'
assert hashlib.sha256(source.read_bytes()).hexdigest() == sha
base = bpy.data.scenes['Link | September24 run repair baseline']
name, stem = 'Link | September24 running torso-relative return', 'run-torso-return'
carrier_name = name+' carrier240'
assert name not in bpy.data.scenes and carrier_name not in bpy.data.scenes
assert all(not (out/(stem+s)).exists() for s in ['-study.blend','-study.json','-native.glb'])
names = ['shoulderL','elbowL','shoulderR','elbowR']
paths = {'pose.bones["'+n+'"].rotation_quaternion' for n in names}
helper = out.parent/'2026-09-24-natural-walk/native.py'
tree = ast.parse(helper.read_text())
exec(compile(ast.Module([n for n in tree.body if isinstance(n,ast.FunctionDef)
                        and n.name in ['curves','fingerprint','activate','sample']],[]),str(helper),'exec'))
original_rig = next(o for o in base.objects if o.type=='ARMATURE')
original = original_rig.animation_data.nla_tracks['run'].strips[0].action
original_fingerprint = fingerprint(original)
bpy.context.window.scene = base
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = name
rig = next(o for o in scene.objects if o.type=='ARMATURE')
baseline = rig.animation_data.nla_tracks['run'].strips[0].action
assert fingerprint(baseline)==original_fingerprint
activate(rig,baseline)
period, count = 28/60, 113
end = float(baseline.frame_range[1])
assert abs(end/24-period)<1e-6
snapshots = [sample(scene,rig,end*i/(count-1)) for i in range(count)]
rows=[]
for pose in snapshots:
    world=pose['world']
    lateral=(world['shoulderL'].translation-world['shoulderR'].translation).normalized()
    torso=world['neck'].translation-world['hips'].translation
    lean=math.atan2(-torso.y,torso.z)
    desired={}
    for side in ['L','R']:
        sn,en='shoulder'+side,'elbow'+side
        upper=world[sn].to_quaternion() @ Vector((0,1,0))
        pitch=math.atan2(-upper.y,-upper.z)
        rear=max(0,min(1,-pitch/math.radians(35)))
        rear=rear*rear*(3-2*rear)
        forward=max(0,min(1,(pitch+lean+math.radians(10))/math.radians(18)))
        forward=forward*forward*(3-2*forward)
        backward=Quaternion(lateral,math.radians(6)*forward)
        outward=Quaternion(Vector((0,1,0)),0)
        desired[sn]=(outward @ backward @ world[sn].to_quaternion()).normalized()
        desired[en]=(outward @ Quaternion(lateral,math.radians(4)*rear) @ backward @ world[en].to_quaternion()).normalized()
    actual_world,row={},{}
    inv=pose['object'].inverted()
    for n in names:
        bone=rig.data.bones[n]
        parent=actual_world.get(bone.parent.name,world[bone.parent.name])
        wanted=Matrix.LocRotScale(world[n].translation,desired[n],world[n].to_scale())
        q=bone.convert_local_to_pose(inv@wanted,bone.matrix_local,parent_matrix=inv@parent,
                                   parent_matrix_local=bone.parent.matrix_local,invert=True).to_quaternion().normalized()
        if rows and q.dot(rows[-1][n])<0:q.negate()
        loc,_,scale=pose['basis'][n]
        actual_world[n]=pose['object'] @ bone.convert_local_to_pose(Matrix.LocRotScale(loc,q,scale),bone.matrix_local,
                              parent_matrix=inv@parent,parent_matrix_local=bone.parent.matrix_local)
        row[n]=q
    rows.append(row)
loop=max(abs(a-b) for n in names for a,b in zip(rows[0][n],rows[-1][n]))
assert loop<1e-5
rows[-1]={n:rows[0][n].copy() for n in names}
action=baseline.copy();action.name='run | rearward carriage with relaxed return'
for layer in action.layers:
    for st in layer.strips:
        for bag in st.channelbags:
            for f in list(bag.fcurves):
                if f.data_path in paths:bag.fcurves.remove(f)
bag=action.layers[0].strips[0].channelbag(action.slots[0])
for n in names:
    for axis in range(4):
        f=bag.fcurves.new('pose.bones["'+n+'"].rotation_quaternion',index=axis)
        f.keyframe_points.add(count)
        for i,row in enumerate(rows):
            f.keyframe_points[i].co=(end*i/(count-1),row[n][axis])
            f.keyframe_points[i].interpolation='LINEAR'
        f.update()
assert fingerprint(action,True)==fingerprint(baseline,True)
assert fingerprint(original)==original_fingerprint
strip=rig.animation_data.nla_tracks['run'].strips[0]
strip.action,strip.action_slot=action,action.slots[0]
activate(rig,action)
scene.frame_set(0)
bpy.data.libraries.write(str(out/(stem+'-study.blend')),{scene},fake_user=True,compress=True)
report={'scene':name,'source_sha256':sha,'gait':'run','cycle_s':period,'stride_m':1.82,
        'preserve_hips':True,'edited_bones':names,'rotation_only_bones':names,
        'forward_half_shoulder_reduction_degrees':6,'rear_half_elbow_opening_degrees':4,'right_sleeve_clearance_degrees':0,
        'method':'Retained CC0-derived run cycle, restrained forward shoulder reach and smooth rear-half elbow opening; wrists inherit forearms',
        'other_action_curves_exact':True,'source_unchanged':True,'loop_error':loop,
        'rows':[{'phase':i/(count-1),'rotations':{n:list(row[n]) for n in names}} for i,row in enumerate(rows)]}
(out/(stem+'-study.json')).write_text(json.dumps(report,indent=2))
carrier=bpy.data.scenes.new(carrier_name);carrier.render.fps=240
crig=rig.copy();crig.data=rig.data.copy();crig.animation_data_clear();carrier.collection.objects.link(crig)
crig.animation_data_create();export_action=action.copy()
for f in curves(export_action):
    assert not f.modifiers
    data=[(float(k.co.x),float(k.co.y),k.interpolation) for k in f.keyframe_points]
    f.keyframe_points.clear();f.keyframe_points.add(len(data))
    for k,(x,value,interpolation) in zip(f.keyframe_points,data):
        k.co=(round(x*10,5),value);k.interpolation=interpolation
    f.update()
track=crig.animation_data.nla_tracks.new();track.name='run'
export_strip=track.strips.new('run',0,export_action);export_strip.action_slot=export_action.slots[0]
export_strip.action_frame_start=0;export_strip.action_frame_end=112;export_strip.frame_end=112;track.mute=True
for bone in crig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
helper=out.parent/'2026-09-19-run-contact/export_native.py'
exec(compile(helper.read_text(),str(helper),'exec'),{'__file__':str(helper),'JOB':{'scene':carrier_name,'out':str(out),'stem':stem,'gait':'run'}})
bpy.context.window.scene=scene
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
