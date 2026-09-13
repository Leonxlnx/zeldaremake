"""Restore unchanged triangle corners exactly; nearest-face transfer is ambiguous at shared vertices."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import barycentric_transform
from mathutils.bvhtree import BVHTree

scene=bpy.data.scenes['Link | source eye study'];bpy.context.window.scene=scene
source=bpy.data.objects['Link | source candidate']
target=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
for rig in [source.parent,target.parent]:rig.data.pose_position='REST'
src=source.data;dst=target.data
key=lambda co:tuple(round(v*1e6) for v in co)
source_normals=[n.vector.copy() for n in src.corner_normals]
faces={tuple(sorted(key(src.vertices[v].co) for v in p.vertices)):p for p in src.polygons}
tree=BVHTree.FromPolygons([v.co for v in src.vertices],[p.vertices[:] for p in src.polygons],all_triangles=True)
normals=[(0,0,0)]*len(dst.loops);matched=0;total=0;max_uv_difference=0
for polygon in dst.polygons:
    if polygon.material_index>0:continue
    total+=1
    original=faces.get(tuple(sorted(key(dst.vertices[v].co) for v in polygon.vertices)))
    if original is not None:
        matched+=1
        corners={key(src.vertices[src.loops[i].vertex_index].co):i for i in original.loop_indices}
        for loop in polygon.loop_indices:
            i=corners[key(dst.vertices[dst.loops[loop].vertex_index].co)]
            normals[loop]=source_normals[i]
            max_uv_difference=max(max_uv_difference,(src.uv_layers.active.data[i].uv-dst.uv_layers.active.data[loop].uv).length)
    else:
        centre=sum((dst.vertices[v].co for v in polygon.vertices),Vector())/len(polygon.vertices)
        _,_,index,distance=tree.find_nearest(centre);assert index is not None and distance<.001
        original=src.polygons[index];assert len(original.vertices)==3
        positions=[src.vertices[v].co for v in original.vertices]
        values=[source_normals[i] for i in original.loop_indices]
        for loop in polygon.loop_indices:
            n=barycentric_transform(dst.vertices[dst.loops[loop].vertex_index].co,*positions,*values)
            normals[loop]=n.normalized()
assert matched/total>.95,(matched,total)
assert max_uv_difference<1e-5,max_uv_difference
dst.normals_split_custom_set(normals)
report={'matched_triangles':matched,'body_triangles':total,'max_unchanged_uv_difference':max_uv_difference,'method':'Exact source triangle/corner restoration; barycentric interpolation only at cut triangles; geometric cavity normals'}
(Path(__file__).resolve().parent/'source-runtime/normal-restoration.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
