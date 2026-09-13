"""Skin the four baked meshes and author four in-place locomotion clips.

Foot paths are sampled in metres. A two-segment leg solve retains bone lengths;
stance feet move opposite the stated travel speed. Runtime terrain still needs IK.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['Link | runtime'];bpy.context.window.scene=scene
record=json.loads(scene['pipeline'])
assert len(record['bakes'])==13, 'Finish all PBR maps before rigging'
collection=bpy.data.collections['LINK_RUNTIME']
old=bpy.data.objects.get('LinkRig')
if old:bpy.data.objects.remove(old,do_unlink=True)
data=bpy.data.armatures.new('Link skeleton')
rig=bpy.data.objects.new('LinkRig',data);collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')

def bone(name,head,tail,parent=None):
    b=data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=data.edit_bones[parent]

bone('hips',(0,0,.52),(0,0,.61))
bone('chest',(0,0,.61),(0,0,.825),'hips')
bone('neck',(0,0,.825),(0,0,.886),'chest')
bone('head',(0,0,.886),(0,0,1.115),'neck')
bone('cap',(0,.12,1.13),(0,.21,.95),'head')
for side,s in [(1,'L'),(-1,'R')]:
    bone('shoulder'+s,(side*.150,0,.798),(side*.196,-.007,.640),'chest')
    bone('elbow'+s,(side*.196,-.007,.640),(side*.222,-.023,.532),'shoulder'+s)
    bone('hand'+s,(side*.222,-.023,.532),(side*.228,-.037,.468),'elbow'+s)
    bone('thigh'+s,(side*.074,0,.52),(side*.074,-.016,.34),'hips')
    bone('knee'+s,(side*.074,-.016,.34),(side*.077,0,.11),'thigh'+s)
    bone('ankle'+s,(side*.077,0,.11),(side*.077,-.090,.048),'knee'+s)
    bone('toe'+s,(side*.077,-.090,.048),(side*.077,-.134,.041),'ankle'+s)
bpy.ops.object.mode_set(mode='OBJECT')

def smooth(a,b,z):
    t=max(0,min(1,(z-a)/(b-a)))
    return t*t*(3-2*t)

max_weight_error=0
for group,info in record['groups'].items():
    ob=bpy.data.objects[info['object']]
    regions={g.index:g.name[7:] for g in ob.vertex_groups if g.name.startswith('region_')}
    vertex_regions=[]
    for v in ob.data.vertices:
        choices=[(g.weight,regions[g.group]) for g in v.groups if g.group in regions]
        assert choices,(ob.name,v.index,'missing region')
        vertex_regions.append(max(choices)[1])
    for old_group in list(ob.vertex_groups):
        if not old_group.name.startswith('region_'):ob.vertex_groups.remove(old_group)
    weights={b.name:ob.vertex_groups.new(name=b.name) for b in data.bones}
    for v,region in zip(ob.data.vertices,vertex_regions):
        x,y,z=v.co
        if region=='head':w={'head':1}
        elif region=='cap':
            t=smooth(.12,.21,y)*(1-smooth(1.06,1.16,z));w={'head':1-t,'cap':t}
        elif region=='neck':
            t=smooth(.855,.90,z);w={'neck':1-t,'head':t}
        elif region=='hips' and not (z<.525 and y<-.07 and abs(x)<.12):w={'hips':1}
        elif region.startswith('arm'):
            s=region[-1];upper=smooth(.603,.674,z);hand=1-smooth(.506,.558,z)
            w={'shoulder'+s:upper,'elbow'+s:(1-upper)*(1-hand),'hand'+s:(1-upper)*hand}
        elif region.startswith('leg'):
            s=region[-1];upper=smooth(.297,.38,z);hip=smooth(.45,.51,z)
            w={'hips':hip,'thigh'+s:upper*(1-hip),'knee'+s:(1-upper)*(1-hip)}
        elif region.startswith('boot'):
            s=region[-1];shin=smooth(.12,.205,z);toe=(1-smooth(-.13,-.07,y))*(1-smooth(.060,.094,z))*.65
            w={'knee'+s:shin,'ankle'+s:(1-shin)*(1-toe),'toe'+s:(1-shin)*toe}
        elif y>.105:
            w={'chest':1}  # Rigid pack, shield, and sword behind the torso.
        else:
            chest=smooth(.57,.78,z)
            hem=(1-smooth(.44,.59,z))*.88
            left=smooth(-.04,.04,x)
            w={'hips':(1-chest)*(1-hem),'chest':chest,
               'thighL':(1-chest)*hem*left,'thighR':(1-chest)*hem*(1-left)}
        total=sum(w.values());max_weight_error=max(max_weight_error,abs(total-1))
        assert abs(total-1)<1e-6 and all(math.isfinite(value) and value>=0 for value in w.values())
        for name,value in w.items():
            if value>1e-6:weights[name].add([v.index],value/total,'REPLACE')
    for mod in list(ob.modifiers):
        if mod.type=='ARMATURE':ob.modifiers.remove(mod)
    arm=ob.modifiers.new('Link skeleton','ARMATURE');arm.object=rig
    ob.parent=rig
    assert max(sum(ob.vertex_groups[g.group].name in weights for g in v.groups) for v in ob.data.vertices)<=4

for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
rig.animation_data_create()
fps=60;scene.render.fps=fps
# ponytail: these authored clips plant on a flat plane. Terrain IK belongs to the game sampler.
gaits={
    'idle':{'frames':180,'speed':0,'duty':1,'lift':0,'pelvis':.518,'arm':.025},
    'walk':{'frames':33,'speed':1.6,'duty':.48,'lift':.062,'pelvis':.463,'arm':.32},
    'run':{'frames':34,'speed':3.9,'duty':.25,'lift':.155,'pelvis':.47,'arm':.65},
    'stairs':{'frames':44,'speed':1.1,'duty':.48,'lift':.145,'pelvis':.46,'arm':.27},
}

def foot_path(q,g):
    period=g['frames']/fps;duty=g['duty'];span=g['speed']*period*duty
    if q<duty:return Vector((0,-span/2+g['speed']*period*q,.11)),True
    t=(q-duty)/(1-duty)
    h=t*t*(3-2*t)
    tangent=min(g['speed']*period*(1-duty),span*.5)
    y=span/2-span*h+tangent*(2*t**3-3*t*t+t)
    return Vector((0,y,.11+g['lift']*math.sin(math.pi*t)**2)),False

def orient_bone(name,start,end):
    pb=rig.pose.bones[name]
    direction=(end-start).normalized()
    # Retain the rest roll: only swing the bone's rest direction to its new direction.
    rest=data.bones[name].matrix_local
    rotation=(data.bones[name].tail_local-data.bones[name].head_local).rotation_difference(direction)
    matrix=rotation.to_matrix().to_4x4()@rest
    matrix.translation=start
    pb.matrix=matrix
    bpy.context.view_layer.update()

def solve_leg(s,target,pitch=0):
    thigh=data.bones['thigh'+s];shin=data.bones['knee'+s]
    hip=rig.pose.bones['hips'].matrix@data.bones['hips'].matrix_local.inverted()@thigh.head_local
    delta=target-hip;distance=delta.length;l1=thigh.length;l2=shin.length
    assert abs(l1-l2)+1e-5<distance<l1+l2+1e-5,(s,distance,l1+l2)
    direction=delta.normalized()
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    bend=Vector((0,-1,0));bend=(bend-direction*bend.dot(direction)).normalized()
    knee=hip+direction*along+bend*math.sqrt(max(0,l1*l1-along*along))
    orient_bone('thigh'+s,hip,knee);orient_bone('knee'+s,knee,target)
    ankle=rig.pose.bones['ankle'+s]
    matrix=Matrix.Rotation(pitch,4,'X')@data.bones['ankle'+s].matrix_local;matrix.translation=target
    ankle.matrix=matrix
    bpy.context.view_layer.update()
    assert (ankle.head-target).length<1e-5,('Unplanted ankle',s,list(ankle.head),list(target))
    assert abs((rig.pose.bones['thigh'+s].tail-rig.pose.bones['thigh'+s].head).length-l1)<1e-5
    assert abs((rig.pose.bones['knee'+s].tail-rig.pose.bones['knee'+s].head).length-l2)<1e-5
    return max(abs((knee-hip).length-l1),abs((target-knee).length-l2))

clips={};max_bone_error=0
for gait,g in gaits.items():
    previous=bpy.data.actions.get(gait)
    if previous and previous.users==0:bpy.data.actions.remove(previous)
    action=bpy.data.actions.new(gait);rig.animation_data.action=action
    contacts={'L':[],'R':[]};first_pose=None;last_pose=None;min_pelvis=10;max_pelvis=0
    for frame in range(g['frames']+1):
        phase=(frame/g['frames'])%1;angle=math.tau*phase
        scene.frame_set(frame)
        for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
        targets={};is_contact={}
        for side,s in [(1,'L'),(-1,'R')]:
            q=(phase+(0 if s=='L' else .5))%1
            target,contact=foot_path(q,g);target.x=side*.077
            targets[s]=target;is_contact[s]=contact
            if contact:contacts[s].append({'frame':frame,'ankle':list(target)})
        pelvis=g['pelvis']+(.007 if gait!='idle' else .001)*math.cos(2*angle)
        if gait=='run':pelvis+=.045*max(0,-math.cos(2*angle))
        for s,target in targets.items():
            reach=(data.bones['thigh'+s].length+data.bones['knee'+s].length)*.992
            pelvis=min(pelvis,target.z+math.sqrt(max(.0001,reach*reach-target.y*target.y)))
        min_pelvis=min(min_pelvis,pelvis);max_pelvis=max(max_pelvis,pelvis)
        m=data.bones['hips'].matrix_local.copy();m.translation.z=pelvis
        rig.pose.bones['hips'].matrix=m
        lean=.13 if gait=='run' else .07 if gait=='stairs' else .025
        rig.pose.bones['chest'].rotation_quaternion=Quaternion((1,0,0),lean+.008*math.sin(angle))
        rig.pose.bones['neck'].rotation_quaternion=Quaternion((1,0,0),-lean*.5)
        rig.pose.bones['head'].rotation_quaternion=Quaternion((0,1,0),.02*math.sin(angle))
        rig.pose.bones['cap'].rotation_quaternion=Quaternion((1,0,0),.035*math.sin(angle+.5))
        for side,s in [(1,'L'),(-1,'R')]:
            rig.pose.bones['shoulder'+s].rotation_quaternion=Quaternion((1,0,0),side*g['arm']*math.cos(angle))
            rig.pose.bones['elbow'+s].rotation_quaternion=Quaternion((1,0,0),-.65 if gait=='run' else -.12)
        bpy.context.view_layer.update()
        for s in ['L','R']:
            q=(phase+(0 if s=='L' else .5))%1
            swing=(q-g['duty'])/(1-g['duty']) if not is_contact[s] else 0
            # Swing pitch eases to zero before contact; planted soles retain their flat path.
            pitch=(.45 if gait=='run' else .25)*math.sin(math.tau*swing)*math.sin(math.pi*swing)**2
            max_bone_error=max(max_bone_error,solve_leg(s,targets[s],pitch))
        pose={pb.name:[list(row) for row in pb.matrix] for pb in rig.pose.bones}
        if frame==0:first_pose=pose
        if frame==g['frames']:last_pose=pose
        for pb in rig.pose.bones:
            pb.keyframe_insert('location',frame=frame,group=pb.name)
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
            pb.keyframe_insert('scale',frame=frame,group=pb.name)
    seam=max(abs(first_pose[n][r][c]-last_pose[n][r][c]) for n in first_pose for r in range(4) for c in range(4))
    assert seam<1e-5,(gait,'loop seam',seam)
    assert min_pelvis>.38 and max_pelvis-min_pelvis<.15,(gait,'pelvis collapse',min_pelvis,max_pelvis)
    # Actual stance positions must cancel root travel between consecutive contact frames.
    max_slide=0
    for samples in contacts.values():
        for a,b in zip(samples,samples[1:]):
            if b['frame']-a['frame']==1:
                residual=b['ankle'][1]-a['ankle'][1]-g['speed']/fps
                max_slide=max(max_slide,abs(residual))
    assert max_slide<1e-6,(gait,'stance sliding',max_slide)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for channel in bag.fcurves:
                    for key in channel.keyframe_points:key.interpolation='LINEAR'
    track=rig.animation_data.nla_tracks.new();track.name=gait
    strip=track.strips.new(gait,0,action);strip.action_frame_start=0;strip.action_frame_end=g['frames']
    track.mute=True
    clips[gait]={**g,'duration_seconds':g['frames']/fps,'stride_metres':g['speed']*g['frames']/fps,
        'pelvis_range_metres':[min_pelvis,max_pelvis],'loop_matrix_error':seam,
        'flat_stance_residual_metres_per_frame':max_slide,'contacts':contacts}
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
scene.frame_set(0)
record['rig']={'bones':list(data.bones.keys()),'weight_sum_error':max_weight_error,'leg_length_error':max_bone_error,
    'clips':clips,'terrain_ik':'Runtime ground sampler required; source clips use a flat plane.'}
record['stage']='Rigged candidate; export and visual motion review pending'
scene['pipeline']=json.dumps(record);scene['status']=record['stage']
(ROOT/'runtime/pipeline.json').write_text(json.dumps(record,indent=2))
bpy.data.libraries.write(str(ROOT/'link-runtime.blend'),{scene},fake_user=True,compress=True)
print(json.dumps({'bones':len(data.bones),'weight_error':max_weight_error,'leg_length_error':max_bone_error,
                  'clips':{name:{k:v for k,v in c.items() if k!='contacts'} for name,c in clips.items()}}))
