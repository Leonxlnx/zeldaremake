"""Reuse the credited CC0 cloth/leather scans for a native material-only comparison."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime';textures=root.parents[2]/'textures'
name='Link | scanned material study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'iris-material-candidate.blend'),link=False) as (available,loaded):loaded.scenes=['Link | iris material study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
material=body.data.materials[0].copy();body.data.materials[0]=material;nodes=material.node_tree.nodes;links=material.node_tree.links
shader=nodes['Principled BSDF'];base=shader.inputs['Base Color'].links[0].from_socket
coord=nodes.new('ShaderNodeTexCoord');rgb=nodes.new('ShaderNodeSeparateXYZ');links.new(base,rgb.inputs[0])
xyz=nodes.new('ShaderNodeSeparateXYZ');links.new(coord.outputs['Object'],xyz.inputs[0])
def calc(op,a,b=0):
    node=nodes.new('ShaderNodeMath');node.operation=op
    for i,value in enumerate((a,b)):
        if isinstance(value,(int,float)):node.inputs[i].default_value=value
        else:links.new(value,node.inputs[i])
    return node.outputs[0]
def ramp(socket,low,high):
    node=nodes.new('ShaderNodeMapRange');node.interpolation_type='SMOOTHSTEP';node.clamp=True
    node.inputs['From Min'].default_value=low;node.inputs['From Max'].default_value=high;links.new(socket,node.inputs['Value']);return node.outputs['Result']
green=calc('MULTIPLY',ramp(calc('SUBTRACT',rgb.outputs['Y'],rgb.outputs['X']),.002,.025),ramp(calc('SUBTRACT',rgb.outputs['Y'],rgb.outputs['Z']),.005,.04))
leather=calc('MULTIPLY',calc('LESS_THAN',xyz.outputs['Z'],.27),calc('LESS_THAN',rgb.outputs['X'],.25))
leather=calc('MULTIPLY',leather,ramp(calc('SUBTRACT',rgb.outputs['X'],rgb.outputs['Y']),.006,.04))
normal=shader.inputs['Normal'].links[0].from_socket;records={}
for label,file,scale,mask,distance in [('cloth','cloth-roughness.jpg',4,green,.0007),('leather','leather-height.png',10,leather,.0004)]:
    path=textures/file;assert path.is_file(),path
    image=bpy.data.images.load(str(path),check_existing=False);image.colorspace_settings.name='Non-Color';image.pack()
    mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs['Scale'].default_value=scale;links.new(coord.outputs['Object'],mapping.inputs[0])
    texture=nodes.new('ShaderNodeTexImage');texture.image=image;texture.projection='BOX';texture.projection_blend=.2;links.new(mapping.outputs[0],texture.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Distance'].default_value=distance
    links.new(calc('MULTIPLY',mask,.55),bump.inputs['Strength']);links.new(texture.outputs['Color'],bump.inputs['Height']);links.new(normal,bump.inputs['Normal']);normal=bump.outputs['Normal']
    records[label]={'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'tiles_per_metre':scale,'bump_distance':distance}
links.new(normal,shader.inputs['Normal'])
tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';links.new(green,tint.inputs[0]);links.new(base,tint.inputs[1]);tint.inputs[2].default_value=(.9,1.08,.85,1);links.new(tint.outputs[0],shader.inputs['Base Color'])
rough=shader.inputs['Roughness'].links[0].from_socket
mix=nodes.new('ShaderNodeMixRGB');links.new(green,mix.inputs[0]);links.new(rough,mix.inputs[1]);mix.inputs[2].default_value=(.72,.72,.72,1);links.new(mix.outputs[0],shader.inputs['Roughness'])
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
for label,target,scale in [('cloth',(0,0,.65),.65),('boots',(0,0,.19),.48)]:
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=scale;scene.camera.location=Vector(target)+Vector((.5,-3,.2))
    scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(root/(label+'-scanned-material-study.png'));bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'scanned-material-study.blend'),{scene},fake_user=True,compress=True)
(root/'scanned-material-study.json').write_text(json.dumps({'status':'Unaccepted native material study; unbaked, not exported','sources':records},indent=2)+'\n');print(json.dumps(records))
