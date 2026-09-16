"""Lift continuous lock surfaces over underlying ridges without exploding tessellation."""
import bpy,json,collections
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=Path(__file__).resolve().parent;s=bpy.context.scene
body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000);hair=next(o for o in s.objects if o.name.startswith('Link | secondary hair locks'))
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
m=hair.data;m.calc_loop_triangles();body.data.calc_loop_triangles()
tree=BVHTree.FromPolygons([v.co for v in body.data.vertices],[t.vertices[:] for t in body.data.loop_triangles],all_triangles=True)
d=s.camera.rotation_euler.to_matrix()@Vector((0,0,-1));before=[v.co.copy() for v in m.vertices];adj=collections.defaultdict(set)
for edge in m.edges:
 a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
history=[]
for attempt in range(20):
 overlay=BVHTree.FromPolygons([v.co for v in m.vertices],[t.vertices[:] for t in m.loop_triangles],all_triangles=True)
 bad={a for a,b in overlay.overlap(tree)};history.append(len(bad))
 if not bad:break
 selected={v for i in bad for v in m.loop_triangles[i].vertices};neighbours={j for i in selected for j in adj[i]}-selected
 for i in selected|neighbours:m.vertices[i].co-=d*(.0005 if i in selected else .00025)
 m.update()
max_move=max((v.co-p).length for v,p in zip(m.vertices,before))
report={'status':'Native ridge-clearance study','intersections_per_iteration':history,'max_displacement_m':max_move,'triangles':len(m.loop_triangles),'resolved':history[-1]==0}
(out/'locks-clearance.json').write_text(json.dumps(report,indent=2))
s.render.filepath=str(out/'locks-clearance-after.png');bpy.ops.render.render(write_still=True)
rig.data.pose_position='POSE';bpy.data.libraries.write(str(out/'hair-locks-clearance-study.blend'),{s},fake_user=True,compress=True)
