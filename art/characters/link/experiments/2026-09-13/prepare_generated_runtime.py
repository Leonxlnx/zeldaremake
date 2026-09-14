"""Reduce the selected generated study and reuse the validated 409b603 rig/clips.

Isolated candidate only. Never writes the delivered link-runtime.glb.
"""
import bpy, bmesh, json, hashlib, math, struct
from pathlib import Path
from mathutils import Matrix

job=globals().get('JOB',{});preserve=bool(job.get('preserve_source',False))
root=Path(__file__).resolve().parent/('source-runtime' if preserve else 'generated-runtime')
root.mkdir(exist_ok=True)
assert hashlib.sha256(Path('E:/Tools/blender-mcp/link-runtime-409b603.blend').read_bytes()).hexdigest()=='4b93f2fdb2578640aef04f4fa3a65663178b1711ed00d9ff0db9ca91c6dedc3d'
source=bpy.data.objects['Link | Rodin Gen25 multiview trial']
scene_name='Link | source runtime' if preserve else 'Link | generated runtime'
rig_name='Link | source stable rig' if preserve else 'Link | reused stable rig'
scene=bpy.data.scenes.get(scene_name)
if scene is None:
    scene=bpy.data.scenes.new(scene_name)
    with bpy.data.libraries.load('E:/Tools/blender-mcp/link-runtime-409b603.blend',link=False) as (available,loaded):loaded.objects=['LinkRig']
    rig=loaded.objects[0];rig.name=rig_name;scene.collection.objects.link(rig)
bpy.context.window.scene=scene
rig=scene.objects[rig_name]
assert len(rig.data.bones)==19
assert {t.name for t in rig.animation_data.nla_tracks}=={'idle','walk','run','stairs'}
assert not any(ob.type=='MESH' for ob in scene.objects), 'Candidate already prepared; inspect before rebuilding'
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
rig.data.pose_position='REST'
scene.render.fps=60;scene.frame_set(0)

model=source.copy();model.data=source.data.copy();model.name='Link | source candidate' if preserve else 'Link | generated candidate'
scene.collection.objects.link(model)
# The generator centres the whole backpack/body volume, not the anatomical root.
knee=[v.co for v in model.data.vertices if .31<=v.co.z<=.36 and v.co.x>.025]
assert len(knee)>50
root_offset_y=-.016-(min(p.y for p in knee)+max(p.y for p in knee))/2
assert abs(root_offset_y)<.2, ('Review anatomical alignment',root_offset_y)
stable=json.loads((Path(__file__).resolve().parents[2]/'runtime'/'validation.json').read_text())
low,high=stable['bounds_metres']['min'][1],stable['bounds_metres']['max'][1]
assert stable['sha256']=='281895fef8f8fda7e7fe73f7fa84ef16fff2df8cb2ead48be15327dece3f2faa'
source_low=min(v.co.z for v in model.data.vertices);source_high=max(v.co.z for v in model.data.vertices)
height_scale=(high-low)/(source_high-source_low);root_offset_z=low-source_low*height_scale
for vertex in model.data.vertices:
    vertex.co.y+=root_offset_y;vertex.co.z=vertex.co.z*height_scale+root_offset_z
assert abs(min(v.co.z for v in model.data.vertices)-low)<1e-6
if not preserve:
    mesh=bmesh.new();mesh.from_mesh(model.data)
    bmesh.ops.remove_doubles(mesh,verts=list(mesh.verts),dist=1e-7)
    mesh.to_mesh(model.data);mesh.free()
    for polygon in model.data.polygons:polygon.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');model.select_set(True)
bpy.context.view_layer.objects.active=model
before=sum(len(p.vertices)-2 for p in model.data.polygons)
if not preserve:
    reduce=model.modifiers.new('Runtime reduction','DECIMATE')
    reduce.ratio=min(1,24000/before);reduce.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=reduce.name)
triangles=sum(len(p.vertices)-2 for p in model.data.polygons)
assert (triangles==before and triangles<=60000) if preserve else 20000<=triangles<=25000,triangles

# Generated disconnected/nonmanifold details make heat weighting unstable. Reuse the known skin.
with bpy.data.libraries.load('E:/Tools/blender-mcp/link-runtime-409b603.blend',link=False) as (available,loaded):
    loaded.objects=['Link_skin','Link_hair','Link_eyes','Link_outfit']
bpy.ops.object.select_all(action='DESELECT')
for reference in loaded.objects:
    assert reference is not None
    scene.collection.objects.link(reference);reference.parent=None;reference.matrix_world=Matrix.Identity(4)
    reference.modifiers.clear();reference.select_set(True)
bpy.context.view_layer.objects.active=loaded.objects[0]
bpy.ops.object.join();reference=bpy.context.object;reference.name='Temporary validated skin transfer'
for bone in rig.data.bones:model.vertex_groups.new(name=bone.name)
bpy.ops.object.select_all(action='DESELECT');model.select_set(True);bpy.context.view_layer.objects.active=model
transfer=model.modifiers.new('Native validated skin transfer','DATA_TRANSFER');transfer.object=reference
transfer.use_vert_data=True;transfer.data_types_verts={'VGROUP_WEIGHTS'}
transfer.vert_mapping='POLYINTERP_NEAREST';transfer.layers_vgroup_select_src='ALL';transfer.layers_vgroup_select_dst='NAME'
bpy.ops.object.modifier_apply(modifier=transfer.name)
bpy.data.objects.remove(reference,do_unlink=True)
assert all(sum(g.weight for g in v.groups)>1e-6 for v in model.data.vertices), 'Skin transfer missed vertices'
model.parent=rig
armature=model.modifiers.new('Validated Link skeleton','ARMATURE');armature.object=rig

def smooth(a,b,value):
    t=max(0,min(1,(value-a)/(b-a)))
    return t*t*(3-2*t)

groups={g.name:g for g in model.vertex_groups}
assert set(groups)==set(rig.data.bones.keys())
for vertex in model.data.vertices:
    # ponytail: broad spatial overrides are a first skinning pass; replace with authored groups after gait review.
    x,y,z=vertex.co;weights=None
    if z>.895:
        tail=smooth(.10,.20,y)*(1-smooth(1.02,1.12,z))
        weights={'head':1-tail,'cap':tail}
    elif y>.105 and .45<z<.87:
        weights={'chest':1}
    if weights is not None:
        for group in groups.values():group.remove([vertex.index])
        for name,weight in weights.items():
            if weight>0:groups[name].add([vertex.index],weight,'REPLACE')
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
weight_error=max(abs(sum(g.weight for g in v.groups)-1) for v in model.data.vertices)
assert weight_error<1e-5
assert max(sum(g.weight>1e-8 for g in v.groups) for v in model.data.vertices)<=4
rig.data.pose_position='POSE'
assert all(math.isfinite(n) for v in model.data.vertices for n in v.co)

source_scene=bpy.data.scenes['Rodin | Gen25 multiview trial']
scene.world=source_scene.world
for collection in source_scene.collection.children:scene.collection.children.link(collection)
camera=source_scene.camera.copy();camera.data=source_scene.camera.data.copy()
scene.collection.objects.link(camera);scene.camera=camera
scene.blendermcp_hyper3d_api_key='';scene.blendermcp_use_hyper3d=False
bpy.data.libraries.write(str(root/'candidate.blend'),{scene},fake_user=True,compress=True)

bpy.ops.object.select_all(action='DESELECT');model.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=rig
target=root/'candidate.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,
    export_cameras=False,export_lights=False,export_tangents=True,export_animations=True,
    export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_step=1,
    export_frame_range=False,export_rest_position_armature=True,export_yup=True,
    export_extras=False,export_all_influences=False,export_def_bones=True,export_vertex_color='NONE')
raw=target.read_bytes();assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
length,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
gltf=json.loads(raw[20:20+length])
clips={a['name'] for a in gltf.get('animations',[])}
assert clips=={'idle','walk','run','stairs'},clips
assert len(gltf['skins'])==1 and len(gltf['skins'][0]['joints'])==19
exported_triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert exported_triangles==triangles
report={'status':'Unaccepted reduced/skinned candidate; actual GLB motion review required',
    'source_geometry_preserved':preserve,
    'source_job':'03f2d679-4d9f-412a-a855-25630f526349','rig_source_commit':'409b603',
    'rig_source_blend_sha256':'4b93f2fdb2578640aef04f4fa3a65663178b1711ed00d9ff0db9ca91c6dedc3d',
    'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':triangles,
    'anatomical_root_offset_y':root_offset_y,
    'anatomical_height_scale':height_scale,'anatomical_root_offset_z':root_offset_z,
    'meshes':len(gltf['meshes']),'materials':len(gltf['materials']),'bones':19,'clips':sorted(clips),
    'weight_sum_error':weight_error,'weighting':'Native nearest-surface transfer from validated409b603, then explicit head/pack overrides',
    'terrain_ik':'Unchanged production sampler; per-foot IK remains Fable work',
    'limitations':'Transferred weights with spatial head/pack overrides are an initial skinning study. Eyes, material detail, equipment and deformation are not accepted.'}
(root/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
