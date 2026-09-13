import bpy,json
from mathutils import Vector
scene=bpy.data.scenes['CC0 | hair template study'];bpy.context.window.scene=scene
source=bpy.data.scenes['Link | Blender art study']
hero=next(c for c in source.collection.children if c.name.startswith('LINK | original'))
studio=next(c for c in source.collection.children if c.name.startswith('STUDIO |'))
scene.collection.children.link(studio);scene.world=source.world
for ob in hero.objects:
    if not ob.name.startswith('Hair |'):scene.collection.objects.link(ob)
hair=bpy.data.objects['basic_short_hair']
hair.parent=None
hair.location=(0,.025,-.505);hair.scale=(1.47,1.10,1.0)
modifier=hair.modifiers.get('Surface Deform')
if modifier:hair.modifiers.remove(modifier)
material=bpy.data.materials.new('CC0 groom | golden blond');material.use_nodes=True
nodes=material.node_tree.nodes;links=material.node_tree.links;nodes.clear()
output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeBsdfHairPrincipled')
shader.parametrization='MELANIN';shader.inputs['Melanin'].default_value=.20
shader.inputs['Melanin Redness'].default_value=.25;shader.inputs['Roughness'].default_value=.35
links.new(shader.outputs[0],output.inputs['Surface']);hair.data.materials.clear();hair.data.materials.append(material)
camera=source.camera.copy();camera.data=source.camera.data.copy();scene.collection.objects.link(camera);scene.camera=camera
camera.location=(.6,-3,1.25);camera.rotation_euler=(Vector((0,0,.995))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=.47
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath='E:/Tools/blender-mcp/link-native-hair-trial.png'
bpy.ops.render.render(write_still=True)
bpy.data.libraries.write('E:/Tools/blender-mcp/link-native-hair-trial.blend',{scene},fake_user=True,compress=True)
print(json.dumps({'image':scene.render.filepath,'status':'CC0 hair template trial, not adopted'}))
