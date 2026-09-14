"""Native lattice adjustment of existing orbital geometry; no added eyelid surfaces."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime';name='Link | eyelid lattice study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'iris-material-candidate.blend'),link=False) as (available,loaded):loaded.scenes=['Link | iris material study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
before=[v.co.copy() for v in body.data.vertices];count=len(before);affected=[]
points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
for point in points:
    group=body.vertex_groups.new(name='Temporary orbital fit');n=0
    for vertex in body.data.vertices:
        if vertex.co.y>-.045:continue
        r=math.hypot((vertex.co.x-point.x)/.03,(vertex.co.z-point.z)/.023)
        t=max(0,min(1,(1.55-r)/.8));weight=t*t*(3-2*t)
        if weight>0:group.add([vertex.index],weight,'REPLACE');n+=1
    assert 100<n<5000,n;affected.append(n)
    data=bpy.data.lattices.new('Orbital fit cage');data.points_u=3;data.points_v=3;data.points_w=3
    for point_data in data.points:
        point_data.co_deform.z*=.86
        point_data.co_deform.z+=point_data.co.x*(.018 if point.x>0 else -.018)
    cage=bpy.data.objects.new('Temporary orbital cage',data);scene.collection.objects.link(cage)
    cage.location=point;cage.scale=(.095,.14,.09)
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
    group_name=group.name
    modifier=body.modifiers.new('Shape original eyelid','LATTICE');modifier.object=cage;modifier.vertex_group=group_name
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    body.vertex_groups.remove(body.vertex_groups[group_name]);bpy.data.objects.remove(cage,do_unlink=True)
assert len(body.data.vertices)==count
deltas=[(vertex.co-old).length for vertex,old in zip(body.data.vertices,before)]
assert .0005<max(deltas)<.008,max(deltas)
assert all(delta<1e-8 for vertex,delta in zip(body.data.vertices,deltas) if vertex.co.z<.90)
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.46;scene.camera.location=(.5,-3,1.13)
scene.camera.rotation_euler=(Vector((0,0,1.015))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.filepath=str(root/'face-eyelid-lattice-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'eyelid-lattice-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted native lattice study; not exported','affected_vertices':affected,'max_displacement_metres':max(deltas),'vertices_unchanged':count,'height_scale':.86}
(root/'eyelid-lattice-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
