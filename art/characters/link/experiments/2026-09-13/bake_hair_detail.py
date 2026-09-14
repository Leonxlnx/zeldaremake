"""Bake native strand detail onto a separate hair UV layout; keep runtime geometry unchanged."""
import bpy,json,hashlib,numpy as np
from pathlib import Path

root=Path(__file__).resolve().parent/'source-runtime';name='Link | baked hair study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'iris-material-candidate.blend'),link=False) as (available,loaded):loaded.scenes=['Link | iris material study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
before=sum(len(p.vertices)-2 for p in body.data.polygons)
high=body.copy();high.data=body.data.copy();high.modifiers.clear();high.parent=None;high.name='Temporary hair source body';scene.collection.objects.link(high)
for i,material in enumerate(high.data.materials):high.data.materials[i]=material.copy()
with bpy.data.libraries.load(str(root/'hair-dense-study.blend'),link=False) as (available,loaded):
    names=[n for n in available.objects if n.startswith('Link_hair_fine')];assert len(names)==1,names;loaded.objects=names
strands=loaded.objects[0];scene.collection.objects.link(strands);strands.modifiers.clear();strands.parent=None
strands.data.materials[0]=strands.data.materials[0].copy()
albedo=body.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
pixels=np.empty(len(albedo.pixels),dtype=np.float32);albedo.pixels.foreach_get(pixels);width,height=albedo.size
uv=body.data.uv_layers.active.data;selected=[]
for polygon in body.data.polygons:
    if polygon.material_index or min(body.data.vertices[v].co.z for v in polygon.vertices)<.87:continue
    centre=polygon.center
    if centre.z<1.0 and abs(centre.x)<.078:continue
    coords=np.mean([uv[i].uv[:] for i in polygon.loop_indices],axis=0)
    x=max(0,min(width-1,int(coords[0]*width)));y=max(0,min(height-1,int(coords[1]*height)))
    r,g,b=pixels[(y*width+x)*4:(y*width+x)*4+3]
    if r>.35 and r>g*1.1 and g>b*1.25 and b/r<.58:selected.append(polygon.index)
del pixels
assert 1000<len(selected)<20000,len(selected)
assert all(not(body.data.polygons[i].center.z<.98 and abs(body.data.polygons[i].center.x)<.07) for i in selected)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
for i in selected:body.data.polygons[i].select=True
existing=set(scene.objects);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
created=set(scene.objects)-existing;assert len(created)==1
hair=created.pop();hair.name='Link_hair_detail'
assert sum(len(p.vertices)-2 for ob in [body,hair] for p in ob.data.polygons)==before
hair.data.materials.clear();material=bpy.data.materials.new('Original baked strand detail');material.use_nodes=True;hair.data.materials.append(material)
for p in hair.data.polygons:p.material_index=0
hair.data.uv_layers.new(name='HairDetail');hair.data.uv_layers.active_index=len(hair.data.uv_layers)-1
hair.data.uv_layers.active.active_render=True
bpy.ops.object.select_all(action='DESELECT');hair.select_set(True);bpy.context.view_layer.objects.active=hair
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.012);bpy.ops.object.mode_set(mode='OBJECT')
hair.data.uv_layers.remove(hair.data.uv_layers['UVMap'])
hair.data.calc_tangents(uvmap=hair.data.uv_layers.active.name)
nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
mapping=nodes.new('ShaderNodeUVMap');mapping.uv_map='HairDetail'
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.bake.use_selected_to_active=True;scene.render.bake.use_cage=False;scene.render.bake.cage_extrusion=.0015
scene.render.bake.max_ray_distance=.003;scene.render.bake.margin=10;scene.render.bake.use_clear=True
bakes={};textures={}
for label,kind,space in [('color','EMIT','sRGB'),('base-normal','NORMAL','Non-Color'),('strand-normal','NORMAL','Non-Color'),('roughness','ROUGHNESS','Non-Color')]:
    image=bpy.data.images.new('Hair detail '+label,width=4096,height=4096,alpha=False);image.colorspace_settings.name=space
    target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target;links.new(mapping.outputs['UV'],target.inputs['Vector'])
    temporary=[]
    if kind=='EMIT':
        for source in [high,strands]:
            for m in source.data.materials:
                sn=m.node_tree.nodes;sl=m.node_tree.links;bs=next(n for n in sn if n.type=='BSDF_PRINCIPLED');output=next(n for n in sn if n.type=='OUTPUT_MATERIAL')
                emission=sn.new('ShaderNodeEmission')
                if bs.inputs['Base Color'].is_linked:sl.new(bs.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
                else:emission.inputs['Color'].default_value=bs.inputs['Base Color'].default_value
                sl.new(emission.outputs[0],output.inputs['Surface']);temporary.append((m,bs,output,emission))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in ([high,hair] if label=='base-normal' else [high,strands,hair]):ob.select_set(True)
    bpy.context.view_layer.objects.active=hair;bpy.ops.object.bake(type=kind)
    for m,bs,output,emission in temporary:m.node_tree.links.new(bs.outputs[0],output.inputs['Surface']);m.node_tree.nodes.remove(emission)
    image.filepath_raw=str(root/('hair-detail-'+label+'.png'));image.file_format='PNG';image.save();image.pack()
    bakes[label]=hashlib.sha256(Path(image.filepath_raw).read_bytes()).hexdigest()
    textures[label]=target
    if kind=='EMIT':links.new(target.outputs['Color'],shader.inputs['Base Color'])
# Reduce only added fibre relief. Scaling the complete normal map also weakens the
# original source correction and exposes flat geometry in the exported mesh.
mix=nodes.new('ShaderNodeMixRGB');mix.inputs[0].default_value=.15
links.new(textures['base-normal'].outputs['Color'],mix.inputs[1]);links.new(textures['strand-normal'].outputs['Color'],mix.inputs[2])
image=bpy.data.images.new('Hair composite normal',width=4096,height=4096,alpha=False);image.colorspace_settings.name='Non-Color'
target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target;links.new(mapping.outputs['UV'],target.inputs['Vector'])
output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');emission=nodes.new('ShaderNodeEmission')
links.new(mix.outputs[0],emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
bpy.ops.object.select_all(action='DESELECT');hair.select_set(True);bpy.context.view_layer.objects.active=hair
scene.render.bake.use_selected_to_active=False;bpy.ops.object.bake(type='EMIT')
links.new(shader.outputs[0],output.inputs['Surface']);nodes.remove(emission)
image.filepath_raw=str(root/'hair-detail-normal.png');image.file_format='PNG';image.save();image.pack()
bakes['normal']=hashlib.sha256(Path(image.filepath_raw).read_bytes()).hexdigest()
normal=nodes.new('ShaderNodeNormalMap');normal.uv_map='HairDetail';links.new(target.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs[0],shader.inputs['Normal'])
shader.inputs['Roughness'].default_value=.55
for ob in [high,strands]:bpy.data.objects.remove(ob,do_unlink=True)
scene.render.bake.use_selected_to_active=False;scene.cycles.samples=48
scene.render.filepath=str(root/'face-hair-bake-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'hair-bake-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted baked hair detail; runtime export pending','hair_triangles':len(hair.data.polygons),'body_triangles_before':before,'body_triangles_after':sum(len(p.vertices)-2 for ob in [body,hair] for p in ob.data.polygons),'bakes':bakes,'size':4096,'fibre_normal_mix':.15,'normal_strength':1,'roughness':.55}
(root/'hair-bake-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
