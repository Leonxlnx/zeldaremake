"""Paired visibility diagnostic: retain eyes/light/camera, temporarily hide the body."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent/'source-runtime';scene=bpy.data.scenes['Link | corneal surface study'];bpy.context.window.scene=scene
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name]
graph=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(body,graph);rows=[]
for eye in eyes:
    centre=Vector([(min(v.co[a] for v in eye.data.vertices)+max(v.co[a] for v in eye.data.vertices))/2 for a in range(3)])
    surface=BVHTree.FromObject(eye,graph).ray_cast(Vector((centre.x,-1,centre.z)),Vector((0,1,0)))[0]
    samples=[]
    for light in [o for o in scene.objects if o.type=='LIGHT']:
        direction=light.matrix_world.translation-surface;distance=direction.length;direction.normalize()
        hit=tree.ray_cast(surface+direction*.00001,direction,distance)
        samples.append({'light':light.name,'body_blocks_centre_ray':hit[0] is not None,'hit_distance_metres':hit[3]})
    rows.append({'eye':eye.name,'front_surface':list(surface),'light_centre_rays':samples})
saved=body.hide_render
try:
    body.hide_render=True;scene.render.filepath=str(root/'eyes-unoccluded-diagnostic.png');bpy.ops.render.render(write_still=True)
finally:body.hide_render=saved
assert body.hide_render==saved
record={'status':'Diagnostic only: body hidden temporarily, not a character result','body_visibility_restored':True,'rays':rows}
(root/'eye-occlusion-diagnostic.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
