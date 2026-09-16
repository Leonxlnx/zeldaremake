"""Refit only locally displaced brow rings against the current full face mesh."""
import bpy,collections,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=Path(__file__).resolve().parent;s=bpy.context.scene
b=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
original=b.data;b.data=original.copy();m=b.data
rig=next(o for o in s.objects if o.type=='ARMATURE');pose=rig.data.pose_position;rig.data.pose_position='REST'
hair=next(o for o in s.objects if o.type=='MESH' and 'secondary hair' in o.name);hidden=hair.hide_render;hair.hide_render=True
before=[v.co.copy() for v in m.vertices];normal_codes=[tuple(v.value) for v in m.attributes['custom_normal'].data]
adj=collections.defaultdict(set)
for p in m.polygons:
 if p.material_index==2:
  for a,c in p.edge_keys:adj[a].add(c);adj[c].add(a)
parts=[];remaining=set(adj)
while remaining:
 todo=[min(remaining)];part=set()
 while todo:
  i=todo.pop()
  if i in part:continue
  part.add(i);todo.extend(adj[i]-part)
 remaining-=part;parts.append(sorted(part))
assert len(parts)==152 and all(len(p)==16 for p in parts)
tree=BVHTree.FromPolygons(before,[p.vertices[:] for p in m.polygons if p.material_index!=2])
changes={};skipped=0
try:
 s.cycles.samples=16;s.render.threads=4;s.render.filepath=str(out/'brow-current-before.png');bpy.ops.render.render(write_still=True)
 for part in parts:
  for start in range(0,16,4):
   ring=part[start:start+4];center=sum((before[i] for i in ring),Vector())/4
   hit=tree.ray_cast(center-Vector((0,.006,0)),Vector((0,1,0)),.012)[0]
   if hit is None:skipped+=1;continue
   delta=hit.y-.00035-center.y
   if abs(delta)>.003:skipped+=1;continue
   if abs(delta)<.0002:continue
   for i in ring:
    changes[i]=delta;m.vertices[i].co.y+=delta
    if m.shape_keys:
     for key in m.shape_keys.key_blocks:key.data[i].co.y+=delta
 m.update()
 normals=[n.vector.copy() for n in m.corner_normals];sums=collections.defaultdict(Vector)
 for p in m.polygons:
  if p.material_index==2:
   for i in p.vertices:sums[i]+=p.normal*p.area
 for loop in m.loops:
  if loop.vertex_index in changes:normals[loop.index]=sums[loop.vertex_index].normalized()
 m.normals_split_custom_set(normals)
 for i,code in enumerate(normal_codes):
  if m.loops[i].vertex_index not in changes:m.attributes['custom_normal'].data[i].value=code
 assert 0<len(changes)<len(adj)
 assert all(v.co==before[v.index] for v in m.vertices if v.index not in changes)
 s.render.filepath=str(out/'brow-current-after.png');bpy.ops.render.render(write_still=True)
 bpy.data.libraries.write(str(out/'brow-current-fit-study.blend'),{s},fake_user=True,compress=True)
 (out/'brow-current-fit.json').write_text(json.dumps({'changed_vertices':len(changes),'max_delta_m':max(abs(v) for v in changes.values()),'skipped_rings':skipped,'non_brow_positions_exact':True,'status':'Native candidate; inspect against before'},indent=2))
finally:
 b.data=original;rig.data.pose_position=pose;hair.hide_render=hidden
