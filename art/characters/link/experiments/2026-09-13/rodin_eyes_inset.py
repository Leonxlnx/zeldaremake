"""Inset the eye study and remove its baked blue halo in the 3D material."""
import bpy,json,hashlib
from pathlib import Path

root=Path(__file__).resolve().parent/'rodin-text-v2'
source=bpy.data.scenes['Rodin | eye study'];name='Rodin | inset eye study'
assert name not in bpy.data.scenes
scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene;scene.world=source.world
for collection in source.collection.children:scene.collection.children.link(collection)
copies={}
for original in source.collection.objects:
    ob=original.copy();ob.data=original.data.copy();scene.collection.objects.link(ob)
    copies[original.name]=ob
scene.camera=copies[source.camera.name]
model=copies['Link | Rodin eye study'];model.name='Link | Rodin inset eye study'
material=model.data.materials[0].copy();model.data.materials[0]=material
nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
points=json.loads((root/'eyes.json').read_text())['eyeSurfacePoints']
coord=nodes.new('ShaderNodeTexCoord');masks=[]
for point in points:
    distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE';distance.inputs[1].default_value=point
    links.new(coord.outputs['Object'],distance.inputs[0])
    mask=nodes.new('ShaderNodeMapRange');mask.interpolation_type='SMOOTHSTEP';mask.clamp=True
    for key,value in [('From Min',.025),('From Max',.058),('To Min',1),('To Max',0)]:mask.inputs[key].default_value=value
    links.new(distance.outputs['Value'],mask.inputs['Value']);masks.append(mask)
combined=nodes.new('ShaderNodeMath');combined.operation='MAXIMUM'
for i,mask in enumerate(masks):links.new(mask.outputs['Result'],combined.inputs[i])
mix=nodes.new('ShaderNodeMixRGB');links.new(combined.outputs[0],mix.inputs[0])
links.new(nodes['Image Texture'].outputs['Color'],mix.inputs[1])
# Sampled cheek image values are sRGB bytes; the shader colour constant is linear.
skin_colour=tuple(((c+.055)/1.055)**2.4 for c in (.923,.784,.720))
mix.inputs[2].default_value=(*skin_colour,1);links.new(mix.outputs[0],shader.inputs['Base Color'])
socket=model.data.materials[2].copy();model.data.materials[2]=socket
socket.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*skin_colour,1)

for original_name,ob in copies.items():
    if original_name.startswith('Actual '):ob.location.y+=.016
    if original_name.startswith(('Actual iris ','Actual pupil ')):
        mat=ob.data.materials[0].copy();ob.data.materials[0]=mat
        bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Roughness'].default_value=.12
        bsdf.inputs['Coat Weight'].default_value=.85;bsdf.inputs['Coat Roughness'].default_value=.04
        ob.scale.y=.0027 if original_name.startswith('Actual pupil ') else .0035

# Restore the cap band excluded by the overly broad first face mask.
im=nodes['Image Texture'].image;pixels=list(im.pixels);w,h=im.size;uv=model.data.uv_layers.active.data
for polygon in model.data.polygons:
    if polygon.material_index!=0 or polygon.center.z<=1.04:continue
    u=sum(uv[i].uv.x for i in polygon.loop_indices)/len(polygon.loop_indices)
    v=sum(uv[i].uv.y for i in polygon.loop_indices)/len(polygon.loop_indices)
    index=(min(h-1,max(0,int(v*h)))*w+min(w-1,max(0,int(u*w))))*4
    r,g,b=pixels[index:index+3]
    if g>r*1.15 and g>b*1.12:polygon.material_index=1
assert all(abs(copies[n].location.y-source.objects[n].location.y-.016)<1e-6 for n in copies if n.startswith('Actual '))
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'face-eyes-inset.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'eyes-inset.blend'),{scene},fake_user=True,compress=True)
print(json.dumps({'status':'Inset eye study, not adopted','image':scene.render.filepath,
    'imageSha256':hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest()}))
