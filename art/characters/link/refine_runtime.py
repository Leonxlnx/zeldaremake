"""Rest-mesh refinements from the actual exported front/back views; keeps the UV atlases."""
import bpy
import bmesh
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['Link | runtime'];bpy.context.window.scene=scene
record=json.loads(scene['pipeline'])

def smooth(a,b,value):
    t=max(0,min(1,(value-a)/(b-a)))
    return t*t*(3-2*t)

hair=bpy.data.objects[record['groups']['hair']['object']]
if not hair.get('nape_refined'):
    for vertex in hair.data.vertices:
        x,y,z=vertex.co
        amount=.12*smooth(.012,.070,y)*(1-smooth(1.02,1.145,z))
        vertex.co.z=max(z-amount,.864+.009*math.sin(x*90)) if amount else z
    hair.data.update();hair['nape_refined']=True

outfit=bpy.data.objects[record['groups']['outfit']['object']]
if not outfit.get('cap_front_lifted'):
    cap_group=outfit.vertex_groups['region_cap'].index
    raised=0
    for vertex in outfit.data.vertices:
        if not any(g.group==cap_group and g.weight>.5 for g in vertex.groups):continue
        x,y,z=vertex.co
        lift=.048*smooth(.025,.11,-y)*(1-smooth(1.085,1.16,z))
        vertex.co.z+=lift;raised+=lift>.001
    assert raised>20,('Cap front edge missing',raised)
    outfit.data.update();outfit['cap_front_lifted']=True
if not outfit.get('cap_draped'):
    cap_group=outfit.vertex_groups['region_cap'].index
    changed=0
    for vertex in outfit.data.vertices:
        if not any(g.group==cap_group and g.weight>.5 for g in vertex.groups):continue
        x,y,z=vertex.co
        drape=smooth(.08,.18,y)*(1-smooth(1.10,1.20,z))
        vertex.co.x*=1+.75*drape
        vertex.co.z-=.025*drape*(1-smooth(.93,1.03,z))
        changed+=drape>0
    assert changed>50,('Cap drape region missing',changed)
    outfit.data.update();outfit['cap_draped']=True
if not outfit.get('vamp_seated'):
    neighbors=[[] for _ in outfit.data.vertices]
    for edge in outfit.data.edges:
        a,b=edge.vertices;neighbors[a].append(b);neighbors[b].append(a)
    seen=set();seated=0
    for first in range(len(neighbors)):
        if first in seen:continue
        queue=[first];seen.add(first);component=[]
        while queue:
            index=queue.pop();component.append(outfit.data.vertices[index])
            for other in neighbors[index]:
                if other not in seen:seen.add(other);queue.append(other)
        low=min(v.co.z for v in component);high=max(v.co.z for v in component)
        if not (.018<low<.060 and .16<high<.24):continue
        # Seat the continuous leather upper into the welt, retaining the original UVs.
        shift=max(0,low-.022)
        for vertex in component:vertex.co.z-=shift*(1-smooth(.045,.105,vertex.co.z))
        seated+=1
    assert seated==2,('Expected the two continuous leather uppers',seated)
    outfit.data.update();outfit['vamp_seated']=True

eyes=bpy.data.objects[record['groups']['eyes']['object']]
assert eyes.get('iris_occlusion_refined'), 'Rebuild eyes from the authored almond source first'
for info in record['groups'].values():
    geometry=bpy.data.objects[info['object']].data
    if any(p.area<1e-9 for p in geometry.polygons):
        # Collapsed faces have undefined UV tangents; retain every visible surface.
        bm=bmesh.new();bm.from_mesh(geometry)
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-9],context='FACES_ONLY')
        bm.to_mesh(geometry);bm.free();geometry.update()
    assert all(p.area>=1e-9 for p in geometry.polygons), 'Collapsed runtime face remains'
    geometry.calc_tangents(uvmap=geometry.uv_layers.active.name)
    broken={loop.index for loop in geometry.loops if loop.tangent.length<.5}
    if broken:
        # Reduction left two corner normals parallel to their surface tangents.
        # Restore those corners from their actual faces; keep other authored normals.
        normals=[n.vector.copy() for n in geometry.corner_normals]
        for polygon in geometry.polygons:
            for index in polygon.loop_indices:
                if index in broken:normals[index]=polygon.normal
        geometry.normals_split_custom_set(normals);geometry.update()
        geometry.calc_tangents(uvmap=geometry.uv_layers.active.name)
        assert all(loop.tangent.length>.99 for loop in geometry.loops), 'Undefined runtime tangent remains'
    geometry.free_tangents()
    info['triangles']=len(geometry.polygons)
record['rest_mesh_refinements']=['Nape coverage extended to the collar',
    'Iris aperture authored with the continuous eyelids; no runtime iris expansion',
    'Leather uppers seated into the sole welt without an open gap',
    'Rear cap widened and lowered into a fuller cloth drape',
    'Front cap edge lifted behind the fringe',
    'Collapsed triangles removed before tangent export']
scene['pipeline']=json.dumps(record)
(ROOT/'runtime/pipeline.json').write_text(json.dumps(record,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-runtime.blend'),compress=True)
print(json.dumps(record['rest_mesh_refinements']))
