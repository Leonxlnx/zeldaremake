"""Give existing boot medallions/rivets metal response; no added geometry."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent/'source-runtime';name='Link | boot hardware study v2'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'iris-material-candidate.blend'),link=False) as (_,loaded):loaded.scenes=['Link | iris material study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
material=body.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
coord=nodes.new('ShaderNodeTexCoord');mask=None
parts=[
    ('left cuff medallion',(-.12971163,-.08770794,.17424518),(.014,.012,.014)),
    ('right cuff medallion',(.13701436,-.08277637,.17491716),(.014,.012,.014)),
    ('left vamp rivet',(-.08949721,-.10546428,.10922465),(.006,.008,.006)),
    ('right vamp rivet',(.19665778,-.08084238,.10837814),(.006,.008,.006)),
    ('left crossed strap stud',(-.08872932,-.07483125,.14690158),(.004,.006,.004)),
    ('right crossed strap stud',(.10600618,-.06625748,.15416068),(.004,.006,.004)),
]
coverage=[];distances=[]
bpy.context.view_layer.update();surface=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
for _,point,scale in parts:
    count=sum(sum(((v.co[i]-point[i])/scale[i])**2 for i in range(3))<1 for v in body.data.vertices)
    coverage.append(count)
    _,_,face,distance=surface.find_nearest(Vector(point));assert face is not None and distance<.0001,distance;distances.append(distance)
assert all(.08<p[2]-r[2] and p[2]+r[2]<.20 for _,p,r in parts),'Hardware mask must remain below the boot cuffs'
for label,point,scale in parts:
    subtract=nodes.new('ShaderNodeVectorMath');subtract.operation='SUBTRACT';links.new(coord.outputs['Object'],subtract.inputs[0]);subtract.inputs[1].default_value=point
    divide=nodes.new('ShaderNodeVectorMath');divide.operation='DIVIDE';links.new(subtract.outputs[0],divide.inputs[0]);divide.inputs[1].default_value=scale
    distance=nodes.new('ShaderNodeVectorMath');distance.operation='LENGTH';links.new(divide.outputs[0],distance.inputs[0])
    fade=nodes.new('ShaderNodeMapRange');fade.interpolation_type='SMOOTHSTEP';fade.clamp=True
    for key,value in [('From Min',.80),('From Max',1),('To Min',1),('To Max',0)]:fade.inputs[key].default_value=value
    links.new(distance.outputs['Value'],fade.inputs['Value'])
    if mask is None:mask=fade.outputs['Result']
    else:
        maximum=nodes.new('ShaderNodeMath');maximum.operation='MAXIMUM';links.new(mask,maximum.inputs[0]);links.new(fade.outputs['Result'],maximum.inputs[1]);mask=maximum.outputs[0]
for key,value in [('Base Color',(.38,.29,.17,1)),('Metallic',(.88,.88,.88,1)),('Roughness',(.32,.32,.32,1))]:
    original=shader.inputs[key].links[0].from_socket
    mix=nodes.new('ShaderNodeMixRGB');links.new(mask,mix.inputs[0]);links.new(original,mix.inputs[1]);mix.inputs[2].default_value=value;links.new(mix.outputs[0],shader.inputs[key])
scene.camera.data.type='PERSP';scene.camera.data.sensor_fit='VERTICAL';scene.camera.data.sensor_height=32;scene.camera.data.lens=32/(2*math.tan(math.radians(15)))
scene.camera.location=(.45,-.88,.24);scene.camera.rotation_euler=(Vector((0,0,.13))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/'boots-hardware-study-v2.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'boot-hardware-study-v2.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted hardware material study; no geometry changes','parts':[{'name':n,'centre':p,'radii':r} for n,p,r in parts],'vertices_in_masks':coverage,'surface_distance_metres':distances,'metallic':.88,'roughness':.32,'source_metal_sample_max':.0274509825}
(root/'boot-hardware-study-v2.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
