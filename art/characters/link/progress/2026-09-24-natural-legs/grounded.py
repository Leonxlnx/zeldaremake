"""Blender: a continuous support / heel-recovery cycle fitted to this short rig."""
import ast, bpy, hashlib, json, math
from pathlib import Path
from mathutils import Matrix, Vector

study=Path(__file__).resolve().parent
out=Path(globals().get('OUTPUT',study));out.mkdir(parents=True,exist_ok=True)
baseline=Path(globals().get('BASELINE',study/'baseline-aa.glb'))
sha='aa0520e0d7aaedcc452103ad14c81113866ff3c5adbd5307fdcedf711a248c89'
assert hashlib.sha256(baseline.read_bytes()).hexdigest()==sha
stem='smooth-jog'
name='Link | September24 '+stem
assert name not in bpy.data.scenes
assert not (out/(stem+'-study.json')).exists()
base_name='Link | September24 leg repair baseline'
if base_name not in bpy.data.scenes:
 p=study.parent/'2026-09-21-motion-integration/import_comparison.py'
 exec(compile(p.read_text(),str(p),'exec'),{'__file__':str(out/'import.py'),'SOURCE_ASSET':str(baseline),'EXPECTED_SHA':sha,'SCENE_NAME':base_name,'LABEL':'baseline'})
base=bpy.data.scenes[base_name]
bpy.context.window.scene=base;bpy.ops.scene.new(type='FULL_COPY')
scene=bpy.context.scene;scene.name=name
rig=next(o for o in scene.objects if o.type=='ARMATURE');data=rig.data
helper=study.parent/'2026-09-24-natural-walk/native.py'
tree=ast.parse(helper.read_text())
exec(compile(ast.Module([n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['curves','fingerprint','activate']],[]),str(helper),'exec'))
old=rig.animation_data.nla_tracks['run'].strips[0].action
original=fingerprint(old)
end=float(old.frame_range[1]);frames=112;period=28/60;stride=1.20;duty=.30
names=[a+s for s in ['L','R'] for a in ['thigh','knee','ankle']]
paths={'pose.bones["'+n+'"].rotation_quaternion' for n in names}|{'pose.bones["hips"].location'}
action=old.copy();action.name='run | grounded support and rear heel recovery'
for layer in action.layers:
 for st in layer.strips:
  for bag in st.channelbags:
   for f in list(bag.fcurves):
    if f.data_path in paths:bag.fcurves.remove(f)
activate(rig,action)

def orient_bone(n,start,finish):
 b=data.bones[n];q=(b.tail_local-b.head_local).rotation_difference((finish-start).normalized())
 m=q.to_matrix().to_4x4()@b.matrix_local;m.translation=start;rig.pose.bones[n].matrix=m
 bpy.context.view_layer.update()

def solve_leg(s,target,pitch):
 thigh=data.bones['thigh'+s];shin=data.bones['knee'+s]
 hip=rig.pose.bones['hips'].matrix@data.bones['hips'].matrix_local.inverted()@thigh.head_local
 delta=target-hip;d=delta.length;l1=thigh.length;l2=shin.length
 assert abs(l1-l2)<d<l1+l2,(s,d,l1+l2)
 axis=delta.normalized();a=(l1*l1-l2*l2+d*d)/(2*d)
 bend=Vector((0,-1,0));bend=(bend-axis*bend.dot(axis)).normalized()
 knee=hip+axis*a+bend*math.sqrt(max(0,l1*l1-a*a))
 orient_bone('thigh'+s,hip,knee);orient_bone('knee'+s,knee,target)
 m=Matrix.Rotation(pitch,4,'X')@data.bones['ankle'+s].matrix_local;m.translation=target
 rig.pose.bones['ankle'+s].matrix=m;bpy.context.view_layer.update()
 assert (rig.pose.bones['ankle'+s].head-target).length<1e-5

# Hermite derivatives are with respect to normalized swing. The first/last
# velocities cancel root travel; heel recovery peaks behind the body, then unfolds.
span=stride*duty
knots=[(0,.195,.11,.91,0,0),(.15,.22,.21,0,.65,.45),
       (.35,.14,.30,-.5,0,.5),(.60,.015,.22,-.8,-.5,.25),
       (.82,-.155,.135,-.6,-.2,-.08),(1,-.195,.11,.91,0,0)]
knots=[(t,y*1.2/1.3,z,dy*1.2/1.3,dz,pitch) for t,y,z,dy,dz,pitch in knots]

def path(q):
 if q<duty:return Vector((0,-span/2+stride*q,.11)),0
 t=(q-duty)/(1-duty)
 a,b=next((a,b) for a,b in zip(knots,knots[1:]) if a[0]<=t<=b[0]+1e-8)
 h=b[0]-a[0];u=(t-a[0])/h
 def hermite(i,di):
  return (2*u**3-3*u*u+1)*a[i]+(u**3-2*u*u+u)*h*a[di]+(-2*u**3+3*u*u)*b[i]+(u**3-u*u)*h*b[di]
 smooth=u*u*(3-2*u)
 return Vector((0,hermite(1,3),hermite(2,4))),a[5]+(b[5]-a[5])*smooth

for q in [duty,1]:
 h=1e-4;a=path((q-h)%1)[0];b=path((q+h)%1)[0]
 assert abs((b.y-a.y)/(2*h)-stride)<.004
 assert abs((b.z-a.z)/(2*h))<.004
targets=[];caps=[]
for i in range(frames):
 phase=i/frames;pair={}
 # One broad compression per contact; no high-frequency correction baked into hips.
 height=.480-.008*math.cos(2*math.tau*(phase-duty/2))
 for s,sign in [('L',1),('R',-1)]:
  p,pitch=path((phase+(0 if s=='L' else .5))%1);p.x=sign*.077;pair[s]=(p,pitch)
  reach=(data.bones['thigh'+s].length+data.bones['knee'+s].length)*.992
  height=min(height,p.z+math.sqrt(max(.0001,reach*reach-p.y*p.y)))
 targets.append(pair);caps.append(height)
wave=[.480-.006*math.cos(2*math.tau*(i/frames-duty/2)) for i in range(frames)]
offset=min(c-w for c,w in zip(caps,wave))-.0005
heights=[w+offset for w in wave]
assert all(h<c for h,c in zip(heights,caps))
rows=[];previous={}
for i in range(frames+1):
 frame=end*i/frames;scene.frame_set(int(frame),subframe=frame-int(frame))
 m=rig.pose.bones['hips'].matrix.copy();m.translation.z=heights[i%frames];rig.pose.bones['hips'].matrix=m
 bpy.context.view_layer.update()
 for s,(p,pitch) in targets[i%frames].items():solve_leg(s,p,pitch)
 rig.pose.bones['hips'].keyframe_insert('location',frame=frame,group='hips')
 for n in names:
  b=rig.pose.bones[n];q=b.rotation_quaternion.copy().normalized()
  if n in previous and q.dot(previous[n])<0:q.negate()
  b.rotation_quaternion=q;previous[n]=q
  b.keyframe_insert('rotation_quaternion',frame=frame,group=n)
 rows.append({'phase':i/frames,'hips':heights[i%frames],'ankles':{s:list(rig.pose.bones['ankle'+s].head) for s in ['L','R']}})
for f in curves(action):
 if f.data_path in paths:
  for k in f.keyframe_points:k.interpolation='LINEAR'
assert fingerprint(old)==original
assert fingerprint(action,True)==fingerprint(old,True)
strip=rig.animation_data.nla_tracks['run'].strips[0];strip.action=action;strip.action_slot=action.slots[0]
scene.frame_set(0)
bpy.data.libraries.write(str(out/(stem+'-study.blend')),{scene},fake_user=True,compress=True)
report={'scene':name,'source_sha256':'aa0520e0d7aaedcc452103ad14c81113866ff3c5adbd5307fdcedf711a248c89','gait':'run','cycle_s':period,'stride_m':stride,'duty':duty,'preserve_hips':False,'edited_bones':['hips']+names,'rotation_only_bones':names,'pelvis_range_m':[min(heights),max(heights)],'other_curves_exact':True,'knots':knots,'rows':rows}
(out/(stem+'-study.json')).write_text(json.dumps(report,indent=2))
# Existing armature-only export appends selected channels without touching the mesh.
carrier=bpy.data.scenes.new(name+' carrier');carrier.render.fps=240
crig=rig.copy();crig.data=rig.data.copy();crig.animation_data_clear()
carrier.collection.objects.link(crig);crig.animation_data_create()
export_action=action.copy()
for f in curves(export_action):
 assert not f.modifiers
 values=[(float(k.co.x),float(k.co.y),k.interpolation) for k in f.keyframe_points]
 f.keyframe_points.clear();f.keyframe_points.add(len(values))
 for k,(x,v,interp) in zip(f.keyframe_points,values):k.co=(round(x*10,5),v);k.interpolation=interp
 f.update()
track=crig.animation_data.nla_tracks.new();track.name='run'
strip=track.strips.new('run',0,export_action);strip.action_slot=export_action.slots[0]
strip.action_frame_start=0;strip.action_frame_end=112;strip.frame_end=112;track.mute=True
for b in crig.pose.bones:b.matrix_basis=Matrix.Identity(4)
p=study.parent/'2026-09-19-run-contact/export_native.py'
exec(compile(p.read_text(),str(p),'exec'),{'__file__':str(p),'JOB':{'scene':carrier.name,'out':str(out),'stem':stem,'gait':'run'}})
bpy.context.window.scene=scene
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
