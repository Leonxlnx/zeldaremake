"""Transfer source surface normals and bake detail into the reduced mesh's tangent frame."""
import bpy,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree

job=globals().get('JOB',{})
folder=job.get('folder','generated-runtime');assert folder in {'generated-runtime','lid-runtime'}
root=Path(__file__).resolve().parent/folder
record=json.loads((root.parent/'generated-runtime/validation.json').read_text())
scene=bpy.data.scenes[job.get('scene','Link | generated runtime')];bpy.context.window.scene=scene
model=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE')
rig.data.pose_position='REST'
bpy.context.view_layer.update()
source=bpy.data.objects['Link | Rodin Gen25 multiview trial']
high=source.copy();high.data=source.data.copy();high.name='Temporary aligned source normals'
scene.collection.objects.link(high)
for vertex in high.data.vertices:
    vertex.co.y+=record['anatomical_root_offset_y']
    vertex.co.z=vertex.co.z*record['anatomical_height_scale']+record['anatomical_root_offset_z']
bpy.ops.object.select_all(action='DESELECT');model.select_set(True);bpy.context.view_layer.objects.active=model
transfer=model.modifiers.new('Preserve source surface normals','DATA_TRANSFER');transfer.object=high
transfer.use_loop_data=True;transfer.data_types_loops={'CUSTOM_NORMAL'};transfer.loop_mapping='POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier=transfer.name)
# New orbital surfaces have no matching source geometry. Keep their own smooth normals.
if len(model.data.materials)>1:
    normals=[tuple(n.vector) for n in model.data.corner_normals]
    for polygon in model.data.polygons:
        if polygon.material_index>0:
            for loop in polygon.loop_indices:normals[loop]=(0,0,0)
    model.data.normals_split_custom_set(normals)
material=model.data.materials[0].copy();model.data.materials[0]=material
nodes=material.node_tree.nodes;links=material.node_tree.links
size=job.get('size',2048);assert size in {2048,4096}
target=bpy.data.images.new('Link generated runtime normal bake',width=size,height=size,alpha=False)
target.generated_color=(.5,.5,1,1);target.colorspace_settings.name='Non-Color'
node=nodes.new('ShaderNodeTexImage');node.image=target;nodes.active=node
scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=job.get('cage',.012)
scene.render.bake.max_ray_distance=job.get('ray',.035);scene.render.bake.margin=12;scene.render.bake.use_clear=True
for other in list(model.data.materials)[1:]:
    unused=other.node_tree.nodes.new('ShaderNodeTexImage');unused.image=bpy.data.images.new('Unused cavity normal target',width=4,height=4)
    other.node_tree.nodes.active=unused
cage=None
scene.render.bake.use_cage=False
if job.get('fit_cage',False):
    bpy.context.view_layer.update();surface=BVHTree.FromObject(high,bpy.context.evaluated_depsgraph_get())
    cage=model.copy();cage.data=model.data.copy();cage.modifiers.clear();cage.parent=None
    scene.collection.objects.link(cage);cage.name='Temporary fitted normal cage';cage.hide_render=True
    for vertex in cage.data.vertices:
        hit,normal,_,distance=surface.find_nearest(vertex.co)
        assert hit is not None
        vertex.co=hit+normal*.0003
    assert len(cage.data.vertices)==len(model.data.vertices)
    scene.render.bake.use_cage=True;scene.render.bake.cage_object=cage
high.select_set(True);bpy.context.view_layer.objects.active=model
bpy.ops.object.bake(type='NORMAL')
normal=next(n for n in nodes if n.type=='NORMAL_MAP')
links.new(node.outputs['Color'],normal.inputs['Color'])
normal.inputs['Strength'].default_value=1
target.filepath_raw=str(root/'normal.png');target.file_format='PNG';target.save();target.pack()
assert target.size[:]==(size,size)
bpy.data.objects.remove(high,do_unlink=True)
if cage is not None:
    scene.render.bake.cage_object=None;bpy.data.objects.remove(cage,do_unlink=True)
rig.data.pose_position='POSE'
if folder=='lid-runtime':
    bpy.data.libraries.write(str(root/'normal-study.blend'),{scene},fake_user=True,compress=True)
    bake_record={'status':'Rebaked lid-study body normals; use bake_generated_eyes to export all meshes','size':size,'cage':scene.render.bake.cage_extrusion,'ray':scene.render.bake.max_ray_distance,'fit_cage':bool(job.get('fit_cage',False)),'sha256':hashlib.sha256((root/'normal.png').read_bytes()).hexdigest()}
    (root/'normal-bake.json').write_text(json.dumps(bake_record,indent=2)+'\n');print(json.dumps(bake_record))
else:
    bpy.data.libraries.write(str(root/'candidate.blend'),{scene},fake_user=True,compress=True)
if folder=='lid-runtime':
    scene.render.filepath=str(root/'face-normal-study.png');bpy.ops.render.render(write_still=True)
else:
    bpy.ops.object.select_all(action='DESELECT');model.select_set(True);rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(root/'candidate.glb'),export_format='GLB',use_selection=True,use_active_scene=True,
        export_cameras=False,export_lights=False,export_tangents=True,export_animations=True,export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,export_frame_step=1,export_frame_range=False,export_rest_position_armature=True,
        export_yup=True,export_extras=False,export_all_influences=False,export_def_bones=True,export_vertex_color='NONE')
    raw=(root/'candidate.glb').read_bytes()
    record.update(sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),normal_bake={'size':[size,size],
        'source':'Gen25 multiview surface plus original generated normal map','sha256':hashlib.sha256((root/'normal.png').read_bytes()).hexdigest()})
    (root/'validation.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'sha256':record['sha256'],'normal_bake':record['normal_bake'],'status':'Recapture required'}))
