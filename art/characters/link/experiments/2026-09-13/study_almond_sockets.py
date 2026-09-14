"""Cut almond openings in the uncut source; retain the reviewed materials and rig."""
import bpy,bmesh,json,math,runpy
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime';name='Link | almond socket study'
assert name not in bpy.data.scenes
source=bpy.data.scenes['Link | source runtime'];appearance=bpy.data.scenes['Link | textured iris study v2']
original=bpy.data.objects['Link | source candidate']
assert sum(len(p.vertices)-2 for p in original.data.polygons)==50000
scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene;scene.world=appearance.world
for collection in appearance.collection.children:scene.collection.children.link(collection)
rig=original.parent.copy();rig.data=original.parent.data.copy();scene.collection.objects.link(rig);rig.name='Link | almond rig';rig.data.pose_position='REST'
body=original.copy();body.data=original.data.copy();scene.collection.objects.link(body);body.name='Link | almond face';body.parent=rig
for modifier in body.modifiers:
    if modifier.type=='ARMATURE':modifier.object=rig
look=next(o for o in appearance.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
body.data.materials.clear()
for material in list(look.data.materials)[:2]:body.data.materials.append(material.copy())
for polygon in body.data.polygons:polygon.material_index=0
eyes=[]
for original_eye in [o for o in appearance.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name]:
    eye=original_eye.copy();eye.data=original_eye.data.copy();scene.collection.objects.link(eye);eye.parent=rig
    for modifier in eye.modifiers:
        if modifier.type=='ARMATURE':modifier.object=rig
    eyes.append(eye)
assert len(eyes)==2 and len(rig.data.bones)==19
scene.camera=appearance.camera.copy();scene.camera.data=appearance.camera.data.copy();scene.collection.objects.link(scene.camera)
scene.render.fps=60;scene.frame_set(0)

# UVs and split normals belong to face corners; coincident vertex positions can be welded.
# Check skin weights first so welding does not silently alter animation at a seam.
weights={};max_delta=0
for v in body.data.vertices:
    key=tuple(v.co);value={g.group:g.weight for g in v.groups}
    if key in weights:
        old=weights[key];max_delta=max(max_delta,max((abs(value.get(g,0)-old.get(g,0)) for g in value.keys()|old.keys()),default=0))
    else:weights[key]=value
assert max_delta<1e-5,('Conflicting coincident skin weights',max_delta)
bm=bmesh.new();bm.from_mesh(body.data)
before={'vertices':len(bm.verts),'boundary_edges':sum(e.is_boundary for e in bm.edges)}
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
after={'vertices':len(bm.verts),'boundary_edges':sum(e.is_boundary for e in bm.edges)}
bm.to_mesh(body.data);bm.free()
assert after['vertices']<before['vertices'] and len(body.data.polygons)==50000

points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
for point in points:
    side=1 if point.x>0 else -1;outline=[];count=64
    for i in range(count):
        angle=2*math.pi*i/count;c,s=math.cos(angle),math.sin(angle)
        z=point.z+(1 if s>=0 else -1)*(.017 if s>=0 else .012)*s*s+side*.001*c
        outline.append((point.x+.027*c,z))
    vertices=[(x,y,z) for y in [point.y-.13,point.y+.065] for x,z in outline]
    faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]
    faces.extend((i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count))
    mesh=bpy.data.meshes.new('Almond socket cutter');mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    cutter=bpy.data.objects.new('Temporary almond cutter',mesh);scene.collection.objects.link(cutter)
    for material in body.data.materials:mesh.materials.append(material)
    for polygon in mesh.polygons:polygon.material_index=1
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
    modifier=body.modifiers.new('Cut almond opening once','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name);bpy.data.objects.remove(cutter,do_unlink=True)

runpy.run_path(str(root.parent/'bevel_orbital_rims.py'),init_globals={'JOB':{'almond':True}})
runpy.run_path(str(root.parent/'restore_source_normals.py'),init_globals={'JOB':{'almond':True}})
triangles=sum(len(p.vertices)-2 for ob in [body,*eyes] for p in ob.data.polygons)
assert 50000<triangles<60000,triangles
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.render.filepath=str(root/'face-almond-socket-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'almond-socket-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted almond opening study; not exported','source_triangles':50000,'triangles':triangles,'weld_before':before,'weld_after':after,'coincident_weight_max_delta':max_delta,'half_width':.027,'top_height':.017,'bottom_height':.012,'method':'Weld source vertex seams, cut parabolic upper/lower openings, reuse native bevel and exact corner-normal restoration; reviewed materials and existing eyes/rig'}
(root/'almond-socket-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
