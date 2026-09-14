"""Keep a flat iris while the glTF clearcoat reflects a smooth corneal dome."""
import bpy,json,hashlib
from pathlib import Path

root=Path(__file__).resolve().parent/'source-runtime'
scene=bpy.data.scenes['Link | source iris plane study'];bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
eyes=sorted([o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name],key=lambda o:min(v.co.x for v in o.data.vertices))
assert len(eyes)==2 and eyes[0].data.materials[0]==eyes[1].data.materials[0]
target=eyes[0];material=target.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
image=bpy.data.images.new('Original cornea coat normal',width=1024,height=1024,alpha=False)
image.generated_color=(.5,.5,1,1);image.colorspace_settings.name='Non-Color'
texture=nodes.new('ShaderNodeTexImage');texture.image=image;nodes.active=texture
centre=json.loads((root/'eye-study.json').read_text())['eye_centres'][0]
bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,location=centre)
high=bpy.context.object;high.name='Temporary cornea bake surface';high.scale=(.028,.028,.027)
for p in high.data.polygons:p.use_smooth=True
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.bake.use_selected_to_active=True;scene.render.bake.use_cage=False
scene.render.bake.cage_extrusion=.014;scene.render.bake.max_ray_distance=.035;scene.render.bake.margin=8
bpy.ops.object.select_all(action='DESELECT');target.select_set(True);high.select_set(True);bpy.context.view_layer.objects.active=target
bpy.ops.object.bake(type='NORMAL')
bpy.data.objects.remove(high,do_unlink=True)
normal=nodes.new('ShaderNodeNormalMap');links.new(texture.outputs['Color'],normal.inputs['Color'])
shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');links.new(normal.outputs['Normal'],shader.inputs['Coat Normal'])
image.filepath_raw=str(root/'iris-cornea-normal.png');image.file_format='PNG';image.save();image.pack()
assert tuple(image.size)==(1024,1024)
record={'method':'Native smooth ellipsoid baked into the flattened iris tangent frame, connected only to Principled Coat Normal','sha256':hashlib.sha256((root/'iris-cornea-normal.png').read_bytes()).hexdigest(),'size':[1024,1024],'cage':.014,'ray':.035,'status':'GLB clearcoat-normal export and visual review required'}
(root/'cornea-normal.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
