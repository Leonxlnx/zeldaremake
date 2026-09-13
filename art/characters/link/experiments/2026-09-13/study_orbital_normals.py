"""Smooth only the socket transition, preserving source normals elsewhere."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime'
name='Link | orbital normal study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'orbital-uv-candidate.blend'),link=False) as (_,loaded):
    loaded.scenes=['Link | orbital UV study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
mesh=body.data;points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
before=[n.vector.copy() for n in mesh.corner_normals]
key=lambda co:tuple(round(c*1e6) for c in co)
smooth={};weights=[]
for vertex in mesh.vertices:
    distance=min((vertex.co-point).length for point in points)
    t=max(0,min(1,(.052-distance)/.020));weights.append(t*t*(3-2*t))
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
assert 100<changed<15000,changed
assert all((a-b).length<1e-7 for i,(a,b) in enumerate(zip(before,normals)) if not weights[mesh.loops[i].vertex_index])
# The source normal map still describes the old eyes. Fade that map at the edited sockets.
material=mesh.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
normal=next(n for n in nodes if n.type=='NORMAL_MAP')
coord=nodes.new('ShaderNodeTexCoord');strengths=[]
for point in points:
    distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE'
    links.new(coord.outputs['Object'],distance.inputs[0]);distance.inputs[1].default_value=point
    fade=nodes.new('ShaderNodeMapRange');fade.interpolation_type='SMOOTHSTEP';fade.clamp=True
    for key_name,value in [('From Min',.032),('From Max',.052),('To Min',0),('To Max',1)]:fade.inputs[key_name].default_value=value
    links.new(distance.outputs['Value'],fade.inputs['Value']);strengths.append(fade.outputs['Result'])
minimum=nodes.new('ShaderNodeMath');minimum.operation='MINIMUM'
for i,strength in enumerate(strengths):links.new(strength,minimum.inputs[i])
links.new(minimum.outputs[0],normal.inputs['Strength'])
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/'face-orbital-normal-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'orbital-normal-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted local normal transition study; not exported','changed_corners':changed,'max_normal_angle_degrees':max_angle,'fade_metres':[.032,.052],'body_triangles':sum(len(p.vertices)-2 for p in mesh.polygons),'method':'Position-keyed angle weighted normals across separate UV/material boundaries; source map disabled only at edited sockets'}
(root/'orbital-normal-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
