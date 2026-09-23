"""Author run contact and flight in Blender; reuse the retained leg solver and arm action."""
import ast,bpy,json,math,traceback
from pathlib import Path
from mathutils import Matrix,Vector
out=Path(__file__).resolve().parent
job=globals().get('JOB',{});stem=job.get('stem','run-contact')
source=out.parents[1]/'experiments/2026-09-13/source-runtime/cc0-arm-narrow-study.blend'
solver=out.parents[1]/'rig_runtime.py'
with bpy.data.libraries.load(str(source),link=False) as (_,loaded):loaded.scenes=['Link | narrow CC0 arm study']
scene=loaded.scenes[0];scene.name=job.get('scene','Link | September19 planted run candidate');bpy.context.window.scene=scene
rig=next(o for o in scene.objects if o.type=='ARMATURE');data=rig.data;data.pose_position='POSE'
tree=ast.parse(solver.read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'orient_bone','solve_leg'}],type_ignores=[]),str(solver),'exec'))
frames=112;fps=240;period=frames/fps;stride=job.get('stride',2.05);speed=stride/period;duty=job.get('duty',.27)
scene.render.fps=fps
track=rig.animation_data.nla_tracks['run'];old=track.strips[0].action
retained_heights=[]
if job.get('preserve_hips'):
 rig.animation_data.action=old;rig.animation_data.action_slot=old.slots[0]
 for frame in range(frames):
  scene.frame_set(frame//2,subframe=(frame%2)/2);bpy.context.view_layer.update();retained_heights.append(rig.pose.bones['hips'].head.z)
 rig.animation_data.action=None
action=old.copy();action.name='run | velocity continuous contact September19'
edited={'hips'}|{j+s for j in ['thigh','knee','ankle'] for s in ['L','R']}
for layer in action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for f in list(bag.fcurves):
    bone=f.data_path.split('"')[1]
    if bone in edited and (bone!='hips' or f.data_path.endswith('.location')):bag.fcurves.remove(f)
    else:
     for k in f.keyframe_points:k.co.x*=2;k.handle_left.x*=2;k.handle_right.x*=2
def protected():
 return [(f.data_path,f.array_index,[tuple(k.co) for k in f.keyframe_points]) for l in action.layers for st in l.strips for bag in st.channelbags for f in bag.fcurves if f.data_path.split('"')[1] not in edited]
untouched=protected();rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
def smooth(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
def path(q):
 span=stride*duty
 if q<duty:return Vector((0,-span/2+stride*q,.11)),True
 t=(q-duty)/(1-duty);tangent=stride*(1-duty);extra=job.get('overshoot',.025);e=2*extra/tangent
 if t<e:
  r=t/e;y=span/2+tangent*e*(r-r**3+.5*r**4)
 elif t>1-e:
  r=(t-1+e)/e;y=-span/2-extra+tangent*e*(r**3-.5*r**4)
 else:
  r=(t-e)/(1-2*e);h=r**3*(10-15*r+6*r*r);y=(span/2+extra)*(1-2*h)
 lift=job.get('lift',.075)*smooth(t/job.get('attack',.10))*smooth((1-t)/.14)+job.get('arc',.020)*math.sin(math.pi*t)**2
 return Vector((0,y,.11+lift)),False
# End velocities must match planted root-space speed; no toe-off / heel-strike kink.
for q in [duty,1]:
 h=1e-5;a=path((q-h)%1)[0];b=path((q+h)%1)[0] # Resolve float32 Vector differences.
 assert abs((b.y-a.y)/(2*h*period)-speed)<.002
 assert abs((b.z-a.z)/(2*h*period))<.002
targets=[];caps=[]
for frame in range(frames):
 phase=frame/frames;pair={}
 for sign,s in [(1,'L'),(-1,'R')]:
  p,contact=path((phase+(0 if s=='L' else .5))%1);p.x=sign*.077;pair[s]=(p,contact)
 cap=.47+.007*math.cos(2*math.tau*phase)+.012*max(0,-math.cos(2*math.tau*phase))
 for s,(p,contact) in pair.items():
  reach=(data.bones['thigh'+s].length+data.bones['knee'+s].length)*.992
  cap=min(cap,p.z+math.sqrt(max(.0001,reach*reach-p.y*p.y)))
 caps.append(cap);targets.append(pair)
# Existing reach-constrained periodic smoothing: do not raise the root above either leg's reach.
heights=caps[:]
for _ in range(500):
 d=[heights[(i-1)%frames]-2*heights[i]+heights[(i+1)%frames] for i in range(frames)]
 heights=[min(caps[i],heights[i]-(heights[i]-caps[i]+4*(d[(i-1)%frames]-2*d[i]+d[(i+1)%frames]))/65) for i in range(frames)]
assert min(heights)>.38,min(heights)
if retained_heights:heights=retained_heights
rows=[];poses=[];error=0
for frame in range(frames+1):
 scene.frame_set(frame);phase=(frame/frames)%1
 matrix=data.bones['hips'].matrix_local.copy();matrix.translation.z=heights[frame%frames];rig.pose.bones['hips'].matrix=matrix;bpy.context.view_layer.update()
 for s,(p,contact) in targets[frame%frames].items():
  q=(phase+(0 if s=='L' else .5))%1;t=(q-duty)/(1-duty) if not contact else 0
  pitch=.25*math.sin(math.tau*t)*math.sin(math.pi*t)**2
  error=max(error,solve_leg(s,p,pitch))
 for bone in edited:
  for prop in (['location'] if bone=='hips' else ['location','rotation_quaternion','scale']):rig.pose.bones[bone].keyframe_insert(prop,frame=frame,group=bone)
 rows.append({'frame':frame,'hips':heights[frame%frames],'ankles':{s:list(rig.pose.bones['ankle'+s].head) for s in ['L','R']}})
 if frame in (0,frames):poses.append({b.name:list(v for row in b.matrix for v in row) for b in rig.pose.bones})
assert protected()==untouched
loop=max(abs(a-b) for name in poses[0] for a,b in zip(poses[0][name],poses[1][name]));assert loop<1e-5,loop
assert error<1e-5
for l in action.layers:
 for st in l.strips:
  for bag in st.channelbags:
   for f in bag.fcurves:
    for k in f.keyframe_points:k.interpolation='LINEAR'
rig.animation_data.action=None;track.strips[0].action=action;track.strips[0].action_slot=action.slots[0];track.strips[0].action_frame_end=frames;track.strips[0].frame_end=frames
for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
scene.frame_set(0)
bpy.data.libraries.write(str(out/(stem+'-study.blend')),{scene},fake_user=True,compress=True)
bpy.data.libraries.write(str(out/(stem+'-action.blend')),{action},fake_user=True,compress=True)
report={'status':'Native candidate; shoe and game validation pending','scene':scene.name,'frames':frames,'fps':fps,'cycle_s':period,'stride_m':stride,'native_speed_m_s':speed,'duty':duty,'plant_s_at_4_6_m_s':duty*stride/4.6,'preserve_hips':bool(retained_heights),'parameters':job,'pelvis_range_m':[min(heights),max(heights)],'bone_error_m':error,'loop_error':loop,'nonleg_curves_preserved_at_normalized_phase':True,'samples':rows}
(out/(stem+'-study.json')).write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='samples'}))
