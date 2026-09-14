"""Smooth only the socket transition, preserving source normals elsewhere."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime'
face_mode=bool(globals().get('JOB',{}).get('face',False))
prefix='face-smooth' if face_mode else 'orbital-normal'
name='Link | face smooth study' if face_mode else 'Link | orbital normal study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/('hardware-candidate.blend' if face_mode else 'orbital-uv-candidate.blend')),link=False) as (_,loaded):
    loaded.scenes=['Link | boot hardware study v2' if face_mode else 'Link | orbital UV study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
mesh=body.data;points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
scale=Vector((.119,.105,.109)) if face_mode else Vector((1,1,1))
if face_mode:points=[Vector((0,-.095,.960))]
inner,outer=(.65,1) if face_mode else (.032,.052)
before=[n.vector.copy() for n in mesh.corner_normals]
key=lambda co:tuple(round(c*1e6) for c in co)
smooth={};weights=[]
for vertex in mesh.vertices:
    distance=min(Vector(tuple((vertex.co[i]-point[i])/scale[i] for i in range(3))).length for point in points)
    t=max(0,min(1,(outer-distance)/(outer-inner)));weights.append(t*t*(3-2*t))
for polygon in mesh.polygons:
    corners=[mesh.vertices[v].co for v in polygon.vertices]
    for j,v in enumerate(polygon.vertices):
        if not weights[v]:continue
        a=corners[j-1]-corners[j];b=corners[(j+1)%len(corners)]-corners[j]
        if a.length<1e-10 or b.length<1e-10:continue
        k=key(corners[j]);smooth[k]=smooth.get(k,Vector())+polygon.normal*a.angle(b)
for polygon in mesh.polygons:
    if any(weights[v] for v in polygon.vertices):polygon.use_smooth=True
normals=[];changed=0;max_angle=0
for i,loop in enumerate(mesh.loops):
    weight=weights[loop.vertex_index]
    if weight:
        normal=smooth[key(mesh.vertices[loop.vertex_index].co)].normalized()
        normal=before[i].lerp(normal,weight).normalized();changed+=1
        max_angle=max(max_angle,math.degrees(before[i].angle(normal)))
    else:normal=before[i]
    normals.append(normal)
mesh.normals_split_custom_set(normals)
assert 100<changed<(25000 if face_mode else 15000),changed
assert all((a-b).length<1e-7 for i,(a,b) in enumerate(zip(before,normals)) if not weights[mesh.loops[i].vertex_index])
# The source normal map still describes the old eyes. Fade that map at the edited sockets.
material=mesh.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
normal=next(n for n in nodes if n.type=='NORMAL_MAP')
coord=nodes.new('ShaderNodeTexCoord');strengths=[]
for point in points:
    subtract=nodes.new('ShaderNodeVectorMath');subtract.operation='SUBTRACT';links.new(coord.outputs['Object'],subtract.inputs[0]);subtract.inputs[1].default_value=point
    divide=nodes.new('ShaderNodeVectorMath');divide.operation='DIVIDE';links.new(subtract.outputs[0],divide.inputs[0]);divide.inputs[1].default_value=scale
    distance=nodes.new('ShaderNodeVectorMath');distance.operation='LENGTH';links.new(divide.outputs[0],distance.inputs[0])
    fade=nodes.new('ShaderNodeMapRange');fade.interpolation_type='SMOOTHSTEP';fade.clamp=True
    for key_name,value in [('From Min',inner),('From Max',outer),('To Min',0),('To Max',1)]:fade.inputs[key_name].default_value=value
    links.new(distance.outputs['Value'],fade.inputs['Value']);strengths.append(fade.outputs['Result'])
strength=strengths[0]
if len(strengths)==2:
    minimum=nodes.new('ShaderNodeMath');minimum.operation='MINIMUM'
    for i,value in enumerate(strengths):links.new(value,minimum.inputs[i])
    strength=minimum.outputs[0]
links.new(strength,normal.inputs['Strength'])
if face_mode:
    scene.camera.data.type='PERSP';scene.camera.data.sensor_fit='VERTICAL';scene.camera.data.sensor_height=32;scene.camera.data.lens=32/(2*math.tan(math.radians(15)))
    scene.camera.location=(.14,-.84,1.03);scene.camera.rotation_euler=(Vector((0,0,1.005))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/('face-'+prefix+'-study.png'));bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/(prefix+'-study.blend')),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted local normal transition study; not exported','changed_corners':changed,'max_normal_angle_degrees':max_angle,'fade_normalized_radius':[inner,outer],'ellipsoid_radii_metres':list(scale),'centres':[list(p) for p in points],'body_triangles':sum(len(p.vertices)-2 for p in mesh.polygons),'method':'Position-keyed angle weighted normals across separate UV/material boundaries; source map faded in the same bounded region'}
(root/(prefix+'-study.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
