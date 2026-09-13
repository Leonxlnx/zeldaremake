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

outfit=bpy.data.objects[record['groups']['outfit']['object']]
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
record['rest_mesh_refinements']=['Nape coverage extended to the collar',
    'Iris aperture authored with the continuous eyelids; no runtime iris expansion',
    'Leather uppers seated into the sole welt without an open gap']
scene['pipeline']=json.dumps(record)
(ROOT/'runtime/pipeline.json').write_text(json.dumps(record,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-runtime.blend'),compress=True)
print(json.dumps(record['rest_mesh_refinements']))
