"""Rest-mesh refinements from the actual exported front/back views; keeps the UV atlases."""
import bpy
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

eyes=bpy.data.objects[record['groups']['eyes']['object']]
if not eyes.get('iris_occlusion_refined'):
    # The iris, pupil and white are disconnected surfaces, so their topology identifies them.
    neighbors=[[] for _ in eyes.data.vertices]
    for edge in eyes.data.edges:
        a,b=edge.vertices;neighbors[a].append(b);neighbors[b].append(a)
    seen=set();changed=0
    for first in range(len(neighbors)):
        if first in seen:continue
        component=[];queue=[first];seen.add(first)
        while queue:
            index=queue.pop();component.append(index)
            for other in neighbors[index]:
                if other not in seen:seen.add(other);queue.append(other)
        vertices=[eyes.data.vertices[i] for i in component]
        width=max(v.co.x for v in vertices)-min(v.co.x for v in vertices)
        if not .010<width<.044:continue
        cx=.056*.86*(1 if sum(v.co.x for v in vertices)>0 else -1)
        cz=.851+(1.068-.90)*.90
        scale=1 if eyes.get('iris_refined') else 1.25
        for vertex in vertices:
            dx=(vertex.co.x-cx)/.86;dz=(vertex.co.z-cz)/.90
            old=math.sqrt(max(.00001,.046**2-dx*dx-dz*dz))
            dx*=scale;dz*=scale
            new=math.sqrt(max(.00001,.046**2-dx*dx-dz*dz))
            vertex.co.x=cx+dx*.86;vertex.co.z=cz+dz*.90
            vertex.co.y+=(old-new)*.88
            slanted_z=dz-(1 if cx>0 else -1)*dx*.085
            aperture=math.sqrt((dx/.037)**2+(slanted_z/(.019 if slanted_z>0 else .021))**2)
            # Recess the hidden part of the enlarged iris behind the lid surface.
            # Its visible portion retains the eyeball curvature and original UVs.
            vertex.co.y+=.018*min(1,max(0,(aperture-1)/.25))*.88
        changed+=1
    assert changed==6,('Expected two iris rims, two irises and two pupils',changed)
    eyes.data.update();eyes['iris_refined']=True;eyes['iris_occlusion_refined']=True
record['rest_mesh_refinements']=['Nape coverage extended to the collar','Iris and pupil surfaces enlarged 25% on the eyeball curvature']
scene['pipeline']=json.dumps(record)
(ROOT/'runtime/pipeline.json').write_text(json.dumps(record,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-runtime.blend'),compress=True)
print(json.dumps(record['rest_mesh_refinements']))
