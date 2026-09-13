"""Native iris material study against the generated front reference."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime'
name='Link | iris material study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'iris-plane-candidate.blend'),link=False) as (available,loaded):
    loaded.scenes=['Link | source iris plane study']
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
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.46;scene.camera.location=(.5,-3,1.13)
scene.camera.rotation_euler=(Vector((0,0,1.015))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.filepath=str(root/'face-iris-material-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'iris-material-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted iris material study; not exported','pupil_to_iris_radius':.34/.61,'iris_fibres':157,'samples':48}
(root/'iris-material-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
