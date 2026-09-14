"""Native iris material study against the generated front reference."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime'
textured=bool(globals().get('JOB',{}).get('texture',False))
prefix='textured-iris-v2' if textured else 'iris-material'
name='Link | textured iris study v2' if textured else 'Link | iris material study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/('eyelash-candidate.blend' if textured else 'iris-plane-candidate.blend')),link=False) as (available,loaded):
    loaded.scenes=['Link | existing lid detail v4' if textured else 'Link | source iris plane study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name];assert len(eyes)==2
material=eyes[0].data.materials[0].copy()
for eye in eyes:eye.data.materials[0]=material
nodes=material.node_tree.nodes;links=material.node_tree.links
shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value=.24;shader.inputs['Coat Weight'].default_value=.65
shader.inputs['Coat Roughness'].default_value=.07
coord=nodes.new('ShaderNodeTexCoord');xyz=nodes.new('ShaderNodeSeparateXYZ');links.new(coord.outputs['Generated'],xyz.inputs[0])
def calc(op,a,b=0):
    node=nodes.new('ShaderNodeMath');node.operation=op
    for i,value in enumerate((a,b)):
        if isinstance(value,(int,float)):node.inputs[i].default_value=value
        else:links.new(value,node.inputs[i])
    return node.outputs[0]
def mix(factor,a,b):
    node=nodes.new('ShaderNodeMixRGB');links.new(factor,node.inputs[0])
    for i,value in enumerate((a,b),1):
        if isinstance(value,tuple):node.inputs[i].default_value=value
        else:links.new(value,node.inputs[i])
    return node.outputs[0]
x=calc('SUBTRACT',xyz.outputs['X'],.5);z=calc('SUBTRACT',xyz.outputs['Z'],.5)
r=calc('MULTIPLY',calc('SQRT',calc('ADD',calc('MULTIPLY',x,x),calc('MULTIPLY',z,z))),2)
if textured:
    source=root.parents[2]/'textures'/'original-iris-teal-v1.png'
    assert hashlib.sha256(source.read_bytes()).hexdigest()=='a1ad966e42b5c53f04a895e66443e1311dc04f61296b0c72da4c29b37440ed20'
    image=bpy.data.images.load(str(source),check_existing=False);image.colorspace_settings.name='sRGB';image.pack()
    radial=nodes.new('ShaderNodeMapRange');radial.clamp=True
    for key,value in [('From Min',.34),('From Max',.61),('To Min',.163),('To Max',.467)]:radial.inputs[key].default_value=value
    links.new(r,radial.inputs['Value'])
    radius=calc('MULTIPLY',radial.outputs['Result'],2)
    uv=nodes.new('ShaderNodeCombineXYZ')
    links.new(calc('ADD',.5,calc('MULTIPLY',calc('DIVIDE',x,calc('MAXIMUM',r,.00001)),radius)),uv.inputs['X'])
    links.new(calc('ADD',.5,calc('MULTIPLY',calc('DIVIDE',z,calc('MAXIMUM',r,.00001)),radius)),uv.inputs['Y'])
    texture=nodes.new('ShaderNodeTexImage');texture.image=image;links.new(uv.outputs[0],texture.inputs['Vector'])
    tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(.7,.8,.82,1);links.new(texture.outputs['Color'],tint.inputs[1])
    limbus=nodes.new('ShaderNodeMapRange');limbus.clamp=True;limbus.interpolation_type='SMOOTHSTEP';limbus.inputs['From Min'].default_value=.575;limbus.inputs['From Max'].default_value=.61;links.new(r,limbus.inputs['Value'])
    iris=mix(limbus.outputs['Result'],tint.outputs[0],(.003,.018,.016,1))
else:
    angle=calc('ARCTAN2',z,x)
    fibres=calc('MULTIPLY_ADD',calc('SINE',calc('ADD',calc('MULTIPLY',angle,157),calc('SINE',calc('MULTIPLY',r,57)))),.5)
    fibres.node.inputs[2].default_value=.5
    iris=mix(fibres,(.004,.045,.037,1),(.055,.23,.17,1))
    iris=mix(calc('GREATER_THAN',r,.55),iris,(.002,.014,.012,1))
front=calc('LESS_THAN',xyz.outputs['Y'],.5)
colour=mix(calc('MULTIPLY',calc('LESS_THAN',r,.61),front),(.72,.69,.62,1),iris)
colour=mix(calc('MULTIPLY',calc('LESS_THAN',r,.34),front),colour,(.0005,.001,.001,1))
links.new(colour,shader.inputs['Base Color'])
assert .34/.61>.55
if not textured:
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.46;scene.camera.location=(.5,-3,1.13)
    scene.camera.rotation_euler=(Vector((0,0,1.015))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.filepath=str(root/('face-'+prefix+'-study.png'));bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/(prefix+'-study.blend')),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted iris material study; not exported','pupil_to_iris_radius':.34/.61,'samples':48}
if textured:record.update(texture_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),texture_radii=[.163,.467],native_iris_radii=[.34,.61],texture_size=list(image.size),albedo_multiplier=[.7,.8,.82],limbus_fade=[.575,.61])
else:record['iris_fibres']=157
(root/(prefix+'-study.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
