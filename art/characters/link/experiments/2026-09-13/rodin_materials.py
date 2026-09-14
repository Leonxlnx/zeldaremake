"""Isolated material/normal diagnostic; preserves the original generated model."""
import bpy,bmesh,json,hashlib
from pathlib import Path

root=Path(__file__).resolve().parent/'rodin-text-v2'
source=bpy.data.scenes['Rodin | second trial']
assert 'Rodin | material study' not in bpy.data.scenes
scene=bpy.data.scenes.new('Rodin | material study');bpy.context.window.scene=scene
scene.world=source.world
for collection in source.collection.children:scene.collection.children.link(collection)
scene.camera=source.camera.copy();scene.camera.data=source.camera.data.copy()
scene.collection.objects.link(scene.camera)
original=bpy.data.objects['Link | Rodin second trial']
model=original.copy();model.data=original.data.copy();model.name='Link | Rodin material study'
scene.collection.objects.link(model)
material=original.data.materials[0].copy();model.data.materials.clear();model.data.materials.append(material)
bpy.context.view_layer.objects.active=model;model.select_set(True)
bpy.ops.mesh.customdata_custom_splitnormals_clear()
bm=bmesh.new();bm.from_mesh(model.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bm.to_mesh(model.data);bm.free()
for polygon in model.data.polygons:polygon.use_smooth=True
assert len(model.data.polygons)==len(original.data.polygons)

# Reuse the existing authored cloth on green garment polygons.
cloth=bpy.data.materials['Tunic | forest woven linen'];model.data.materials.append(cloth)
image=material.node_tree.nodes['Image Texture'].image;pixels=list(image.pixels);w,h=image.size
uv=model.data.uv_layers.active.data;cloth_faces=0
for polygon in model.data.polygons:
    u=sum(uv[i].uv.x for i in polygon.loop_indices)/len(polygon.loop_indices)
    v=sum(uv[i].uv.y for i in polygon.loop_indices)/len(polygon.loop_indices)
    index=(min(h-1,max(0,int(v*h)))*w+min(w-1,max(0,int(u*w))))*4
    r,g,b=pixels[index:index+3]
    centre=polygon.center
    # ponytail: colour plus face exclusion is a study mask; author garment groups before adoption.
    face=abs(centre.x)<.15 and centre.y<.04 and .86<centre.z<1.105
    if not face and g>r*1.15 and g>b*1.12:
        polygon.material_index=1;cloth_faces+=1
assert 1000<cloth_faces<len(model.data.polygons)*.8,cloth_faces
nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
rough=nodes.new('ShaderNodeMath');rough.operation='MAXIMUM';rough.inputs[1].default_value=.52
links.new(nodes['Separate Color'].outputs['Green'],rough.inputs[0]);links.new(rough.outputs[0],shader.inputs['Roughness'])
nodes['Normal Map'].inputs['Strength'].default_value=.20
for link in list(shader.inputs['Metallic'].links):links.remove(link)
shader.inputs['Metallic'].default_value=0
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'face-materials.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'materials.blend'),{scene},fake_user=True,compress=True)
report={'status':'Isolated material study, not adopted','verticesBefore':len(original.data.vertices),
    'verticesAfter':len(model.data.vertices),'triangles':len(model.data.polygons),'clothFaces':cloth_faces,
    'imageSha256':hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest()}
(root/'materials.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
