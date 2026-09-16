"""Bounded upper-forearm clearance, with matching displacement of attached thread."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
out=Path(__file__).resolve().parent;s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE');body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
guards=[o for o in s.objects if o.name.startswith('Link | fitted forearm guard')];threads=[o for o in s.objects if o.name.startswith('Link | guard stitching')]
assert len(guards)==len(threads)==2
objects=guards+threads;original={o.name:o.data for o in objects};before={o.name:[v.co.copy() for v in o.data.vertices] for o in objects};deltas={}
for o in objects:o.data=o.data.copy()
for g in guards:
 points=before[g.name];centers=[sum(points[i*32:(i+1)*32],Vector())/32 for i in range(8)]
 delta=[(p-centers[i//32]).normalized()*[1,1,.75,.25,0,0,0,0][i//32] for i,p in enumerate(points)];deltas[g.name]=delta
 g.data.calc_loop_triangles();triangles=g.data.loop_triangles;tree=BVHTree.FromPolygons(points,[t.vertices[:] for t in triangles],all_triangles=True)
 thread=next(t for t in threads if t.name[-1]==g.name[-1]);deltas[thread.name]=[]
 for p in before[thread.name]:
  hit,_,index,_=tree.find_nearest(p);tri=triangles[index]
  d=barycentric_transform(hit,*[points[i] for i in tri.vertices],*[delta[i] for i in tri.vertices]);deltas[thread.name].append(d)
saved={b.name:(b.rotation_mode,b.matrix_basis.copy()) for b in r.pose.bones};pose=r.data.pose_position
def tree(o,deps):
 e=o.evaluated_get(deps);m=e.to_mesh();m.calc_loop_triangles();t=BVHTree.FromPolygons([e.matrix_world@v.co for v in m.vertices],[f.vertices[:] for f in m.loop_triangles],all_triangles=True);e.to_mesh_clear();return t
history=[];accepted=False
try:
 r.data.pose_position='POSE'
 for amount in [0,.0005,.001,.0015,.002]:
  for o in objects:
   for v,p,d in zip(o.data.vertices,before[o.name],deltas[o.name]):v.co=p+d*amount
   o.data.update()
  checks=[]
  for angle in [0,.2,.4,.6,.8,1,1.2]:
   for b in r.pose.bones:b.matrix_basis.identity()
   for side in ['L','R']:b=r.pose.bones['elbow'+side];b.rotation_mode='XYZ';b.rotation_euler.x=angle
   bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();skin=tree(body,deps)
   counts={o.name:len({i for i,j in tree(o,deps).overlap(skin)}) for o in objects};checks.append({'angle':angle,'contacts':counts})
  history.append({'upper_radial_increase_m':amount,'checks':checks})
  if all(not any(c['contacts'].values()) for c in checks):accepted=True;break
 for b in r.pose.bones:b.rotation_mode=saved[b.name][0];b.matrix_basis=saved[b.name][1]
 r.data.pose_position='REST';bpy.context.view_layer.update()
 if accepted:bpy.data.libraries.write(str(out/'forearm-guards-clearance-study.blend'),{s},fake_user=True,compress=True)
 (out/'guard-clearance.json').write_text(json.dumps({'resolved':accepted,'history':history,'scope':'Evaluated leather and thread against body, seven isolated elbow-flexion poses; game clips not yet checked'},indent=2))
 print('Resolved',accepted,'radial increase',amount)
finally:
 for b in r.pose.bones:b.rotation_mode=saved[b.name][0];b.matrix_basis=saved[b.name][1]
 r.data.pose_position=pose
 if not accepted:
  for o in objects:o.data=original[o.name]
