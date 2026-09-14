"""Isolated anatomical eye study: embedded eyeballs, circular pupils, and skin-coloured lids."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

job=globals().get('JOB',{});preserve=bool(job.get('preserve_source',False))
root=Path(__file__).resolve().parent/('source-runtime' if preserve else 'generated-runtime')
source=bpy.data.scenes['Link | source runtime' if preserve else 'Link | generated runtime']
scene_name='Link | source eye study' if preserve else 'Link | generated eye study'
assert scene_name not in bpy.data.scenes
scene=bpy.data.scenes.new(scene_name);bpy.context.window.scene=scene
scene.world=source.world
for collection in source.collection.children:scene.collection.children.link(collection)
copies={}
for original in source.collection.objects:
    ob=original.copy();ob.data=original.data.copy();scene.collection.objects.link(ob);copies[original.name]=ob
rig=copies['Link | source stable rig' if preserve else 'Link | reused stable rig'];rig.name='Link | source eye rig' if preserve else 'Link | eye study rig';rig.data.pose_position='REST'
model=copies['Link | source candidate' if preserve else 'Link | generated candidate'];model.name='Link | source eye body' if preserve else 'Link | eye study body';model.parent=rig
for modifier in model.modifiers:
    if modifier.type=='ARMATURE':modifier.object=rig
scene.camera=copies[source.camera.name]
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.46
scene.camera.location=(.5,-3,1.13)
scene.camera.rotation_euler=(Vector((0,0,1.015))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
assert points[0].x<0<points[1].x and abs(points[0].z-points[1].z)<.002

material=model.data.materials[0].copy();model.data.materials[0]=material
socket=bpy.data.materials.new('Link | orbital skin');socket.use_nodes=True
socket.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.62,.45,.36,1)
socket.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.6
model.data.materials.append(socket)
nodes=material.node_tree.nodes;links=material.node_tree.links;bsdf=nodes['Principled BSDF']
original_colour=bsdf.inputs['Base Color'].links[0].from_socket
bpy.context.view_layer.update()
tree=BVHTree.FromObject(model,bpy.context.evaluated_depsgraph_get())
_,_,face_index,_=tree.find_nearest(Vector((-.067,-.10,.938)))
polygon=model.data.polygons[face_index];uv=model.data.uv_layers.active.data
skin_uv=sum((uv[i].uv for i in polygon.loop_indices),Vector((0,0)))/len(polygon.loop_indices)
skin_image=original_colour.node.image
pixel=(min(int(skin_uv.y*skin_image.size[1]),skin_image.size[1]-1)*skin_image.size[0]+min(int(skin_uv.x*skin_image.size[0]),skin_image.size[0]-1))*4
colour=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in skin_image.pixels[pixel:pixel+3]]
socket.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*colour,1)
skin=nodes.new('ShaderNodeTexImage');skin.image=original_colour.node.image
sample_uv=nodes.new('ShaderNodeCombineXYZ');sample_uv.inputs['X'].default_value=skin_uv.x;sample_uv.inputs['Y'].default_value=skin_uv.y
links.new(sample_uv.outputs[0],skin.inputs['Vector'])
coord=nodes.new('ShaderNodeTexCoord');masks=[]
for point in points:
    distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE';distance.inputs[1].default_value=point
    links.new(coord.outputs['Object'],distance.inputs[0])
    mask=nodes.new('ShaderNodeMapRange');mask.interpolation_type='SMOOTHSTEP';mask.clamp=True
    for key,value in [('From Min',.023),('From Max',.044),('To Min',1),('To Max',0)]:mask.inputs[key].default_value=value
    links.new(distance.outputs['Value'],mask.inputs['Value']);masks.append(mask)
combined=nodes.new('ShaderNodeMath');combined.operation='MAXIMUM'
for i,mask in enumerate(masks):links.new(mask.outputs['Result'],combined.inputs[i])
mix=nodes.new('ShaderNodeMixRGB');links.new(combined.outputs[0],mix.inputs[0]);links.new(original_colour,mix.inputs[1]);links.new(skin.outputs['Color'],mix.inputs[2])
links.new(mix.outputs[0],bsdf.inputs['Base Color'])

eye=bpy.data.materials.new('Link | generated study living eyes');eye.use_nodes=True
en=eye.node_tree.nodes;el=eye.node_tree.links;shader=en.get('Principled BSDF')
shader.inputs['Roughness'].default_value=.18;shader.inputs['Coat Weight'].default_value=.8
shader.inputs['Coat Roughness'].default_value=.035;shader.inputs['IOR'].default_value=1.376
tex=en.new('ShaderNodeTexCoord');separate=en.new('ShaderNodeSeparateXYZ');el.new(tex.outputs['Generated'],separate.inputs[0])
def value(op,a,b=0):
    node=en.new('ShaderNodeMath');node.operation=op
    for i,v in enumerate((a,b)):
        if isinstance(v,(int,float)):node.inputs[i].default_value=v
        else:el.new(v,node.inputs[i])
    return node.outputs[0]
x=value('SUBTRACT',separate.outputs['X'],.5);z=value('SUBTRACT',separate.outputs['Z'],.5)
r=value('MULTIPLY',value('SQRT',value('ADD',value('MULTIPLY',x,x),value('MULTIPLY',z,z))),2)
front=value('LESS_THAN',separate.outputs['Y'],.5)
noise=en.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=95;noise.inputs['Detail'].default_value=2
el.new(tex.outputs['Generated'],noise.inputs['Vector'])
fibres=value('ADD',value('MULTIPLY',value('ADD',value('SINE',value('MULTIPLY',value('ARCTAN2',z,x),83)),1),.2),value('MULTIPLY',noise.outputs['Fac'],.6))
iris=en.new('ShaderNodeMixRGB');el.new(fibres,iris.inputs[0])
iris.inputs[1].default_value=(.012,.11,.13,1);iris.inputs[2].default_value=(.06,.32,.30,1)
limbus=en.new('ShaderNodeMixRGB');el.new(value('GREATER_THAN',r,.60),limbus.inputs[0]);el.new(iris.outputs[0],limbus.inputs[1]);limbus.inputs[2].default_value=(.003,.025,.031,1)
colour=en.new('ShaderNodeMixRGB');el.new(value('MULTIPLY',value('LESS_THAN',r,.65),front),colour.inputs[0])
colour.inputs[1].default_value=(.86,.83,.76,1);el.new(limbus.outputs[0],colour.inputs[2])
pupil=en.new('ShaderNodeMixRGB');el.new(value('MULTIPLY',value('LESS_THAN',r,.24),front),pupil.inputs[0]);el.new(colour.outputs[0],pupil.inputs[1]);pupil.inputs[2].default_value=(.001,.002,.002,1)
el.new(pupil.outputs[0],shader.inputs['Base Color'])

eyes=[];before=sum(len(p.vertices)-2 for p in model.data.polygons)
for i,point in enumerate(points):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(point.x,point.y-.012,point.z))
    cutter=bpy.context.object;cutter.scale=(.025,.035,.019)
    # Cutter UVs span the atlas. Keep newly created cavity faces in their own material.
    cutter.data.materials.append(material);cutter.data.materials.append(socket)
    for polygon in cutter.data.polygons:polygon.material_index=1
    bpy.ops.object.select_all(action='DESELECT');model.select_set(True);bpy.context.view_layer.objects.active=model
    boolean=model.modifiers.new('Recess orbital socket','BOOLEAN');boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=cutter
    bpy.ops.object.modifier_apply(modifier=boolean.name);bpy.data.objects.remove(cutter,do_unlink=True)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=8,location=(point.x,point.y+.016,point.z))
    globe=bpy.context.object;globe.name='Link | anatomical eye '+str(i);globe.scale=(.028,.028,.027)
    for p in globe.data.polygons:p.use_smooth=True
    globe.data.materials.append(eye);eyes.append(globe)
triangles=sum(len(p.vertices)-2 for ob in [model,*eyes] for p in ob.data.polygons)
assert before<=triangles<(55000 if preserve else 27000),triangles
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'face-eye-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'eye-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Embedded eye study; not baked/exported/adopted','triangles':triangles,'eye_centres':[[p.x,p.y+.016,p.z] for p in points],
    'iris_radius':.0182,'pupil_radius':.00672,'skin_sample_uv':list(skin_uv),'image_sha256':hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest()}
(root/'eye-study.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8');print(json.dumps(record))
