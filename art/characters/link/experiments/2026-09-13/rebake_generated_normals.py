"""Transfer source surface normals and bake detail into the reduced mesh's tangent frame."""
import bpy,json,hashlib
from pathlib import Path

root=Path(__file__).resolve().parent/'generated-runtime'
record=json.loads((root/'validation.json').read_text())
scene=bpy.data.scenes['Link | generated runtime'];bpy.context.window.scene=scene
model=scene.objects['Link | generated candidate'];rig=scene.objects['Link | reused stable rig']
rig.data.pose_position='REST'
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
material=model.data.materials[0].copy();model.data.materials[0]=material
nodes=material.node_tree.nodes;links=material.node_tree.links
target=bpy.data.images.new('Link generated runtime normal bake',width=2048,height=2048,alpha=False)
target.generated_color=(.5,.5,1,1);target.colorspace_settings.name='Non-Color'
node=nodes.new('ShaderNodeTexImage');node.image=target;nodes.active=node
scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.012
scene.render.bake.max_ray_distance=.035;scene.render.bake.margin=12;scene.render.bake.use_clear=True
high.select_set(True);bpy.context.view_layer.objects.active=model
bpy.ops.object.bake(type='NORMAL')
normal=next(n for n in nodes if n.type=='NORMAL_MAP')
links.new(node.outputs['Color'],normal.inputs['Color'])
normal.inputs['Strength'].default_value=1
target.filepath_raw=str(root/'normal.png');target.file_format='PNG';target.save();target.pack()
assert target.size[:]==(2048,2048)
bpy.data.objects.remove(high,do_unlink=True)
rig.data.pose_position='POSE'
bpy.data.libraries.write(str(root/'candidate.blend'),{scene},fake_user=True,compress=True)
bpy.ops.object.select_all(action='DESELECT');model.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(root/'candidate.glb'),export_format='GLB',use_selection=True,use_active_scene=True,
    export_cameras=False,export_lights=False,export_tangents=True,export_animations=True,export_animation_mode='NLA_TRACKS',
    export_force_sampling=True,export_frame_step=1,export_frame_range=False,export_rest_position_armature=True,
    export_yup=True,export_extras=False,export_all_influences=False,export_def_bones=True,export_vertex_color='NONE')
raw=(root/'candidate.glb').read_bytes()
record.update(sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),normal_bake={'size':[2048,2048],
    'source':'Gen25 multiview surface plus original generated normal map','sha256':hashlib.sha256((root/'normal.png').read_bytes()).hexdigest()})
(root/'validation.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'sha256':record['sha256'],'normal_bake':record['normal_bake'],'status':'Recapture required'}))
