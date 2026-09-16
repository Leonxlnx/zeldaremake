"""Add fitted edge stitching and a laced overlap to the original guard shells."""
import bpy,math,json,collections
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import barycentric_transform
from mathutils.bvhtree import BVHTree
out=Path(__file__).resolve().parent;s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE');body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
guards=[o for o in s.objects if o.type=='MESH' and o.name.startswith('Link | fitted forearm guard')];assert len(guards)==2
for old in list(s.objects):
 if old.name.startswith('Link | guard stitching'):bpy.data.objects.remove(old,do_unlink=True)
thread=bpy.data.materials.new('Original waxed flax guard thread');thread.use_nodes=True
p=thread.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.28,.17,.08,1);p.inputs['Roughness'].default_value=.82
objects=[]
for guard in guards:
 side=guard.name[-1];m=guard.data;assert len(m.vertices)==256
 centers=[sum((m.vertices[i*32+j].co for j in range(32)),Vector())/32 for i in range(8)]
 curve=bpy.data.curves.new('Guard sewn edges '+side,'CURVE');curve.dimensions='3D';curve.bevel_depth=.00033;curve.bevel_resolution=1;curve.resolution_u=1
 m.calc_loop_triangles();shell=BVHTree.FromPolygons([v.co for v in m.vertices],[t.vertices[:] for t in m.loop_triangles],all_triangles=True)
 def point(i,j):
  p=m.vertices[i*32+j%32].co;return p+(p-centers[i]).normalized()*.002
 def line(points):
  fitted=[]
  for a,b in zip(points,points[1:]):
   for step in range(9):
    hit,normal,_,_=shell.find_nearest(a.lerp(b,step/8));fitted.append(hit+normal*.0024)
  spline=curve.splines.new('POLY');spline.points.add(len(fitted)-1)
  for p,co in zip(spline.points,fitted):p.co=(*co,1)
 for row in [1,6]:
  for j in range(32):
   a=point(row,j);b=point(row,j+1);line([a.lerp(b,.15),a.lerp(b,.70)])
 front=min(range(32),key=lambda j:m.vertices[4*32+j].co.y)
 for row in range(2,6):
  line([point(row,front-1),point(row+1,front+1)])
  line([point(row,front+1),point(row+1,front-1)])
 o=bpy.data.objects.new('Link | guard stitching '+side,curve);s.collection.objects.link(o);curve.materials.append(thread)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 o=bpy.context.object;o.parent=rig;o.vertex_groups.new(name='elbow'+side).add(list(range(len(o.data.vertices))),1,'REPLACE');o.modifiers.new('Existing forearm rig','ARMATURE').object=rig;objects.append(o)
pose=rig.data.pose_position;basis={b.name:b.matrix_basis.copy() for b in rig.pose.bones};modes={b.name:b.rotation_mode for b in rig.pose.bones};rig.data.pose_position='REST'
body.data.calc_loop_triangles();triangles=body.data.loop_triangles
skin_tree=BVHTree.FromPolygons([v.co for v in body.data.vertices],[t.vertices[:] for t in triangles],all_triangles=True)
for o in guards+objects:
 o.vertex_groups.clear()
 for g in body.vertex_groups:o.vertex_groups.new(name=g.name)
 for vertex in o.data.vertices:
  hit,_,index,distance=skin_tree.find_nearest(vertex.co);assert distance<.015,distance
  tri=triangles[index];coords=[body.data.vertices[i].co for i in tri.vertices]
  bary=barycentric_transform(hit,*coords,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)));weights=collections.defaultdict(float)
  for factor,i in zip(bary,tri.vertices):
   for g in body.data.vertices[i].groups:weights[g.group]+=max(0,factor)*g.weight
  total=sum(weights.values());assert total>.9
  for group,weight in weights.items():
   if weight>1e-8:o.vertex_groups[group].add([vertex.index],weight/total,'REPLACE')
camera=s.camera;matrix=camera.matrix_world.copy();scale=camera.data.ortho_scale
hair=next(o for o in s.objects if o.type=='MESH' and 'secondary hair' in o.name);hidden=hair.hide_render;hair.hide_render=True
def evaluated_tree(o,deps):
 e=o.evaluated_get(deps);m=e.to_mesh();m.calc_loop_triangles()
 tree=BVHTree.FromPolygons([e.matrix_world@v.co for v in m.vertices],[t.vertices[:] for t in m.loop_triangles],all_triangles=True);count=len(m.loop_triangles);e.to_mesh_clear();return tree,count
records=[]
try:
 for o in guards+objects:o.hide_render=False
 focus=Vector((.23,-.025,.58));camera.location=focus+Vector((.12,-1,.12));camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.28;s.cycles.samples=24;s.render.threads=4
 for label,visible in [('plain',False),('sewn',True)]:
  for o in objects:o.hide_render=not visible
  s.render.filepath=str(out/('guard-detail-'+label+'.png'));bpy.ops.render.render(write_still=True)
 # Stress poses supplement later game-clip tests; they are not claimed as authored animation.
 rig.data.pose_position='POSE'
 for angle in [0,.4,.8,1.2]:
  for bone in rig.pose.bones:bone.matrix_basis.identity()
  for side in ['L','R']:
   bone=rig.pose.bones['elbow'+side];bone.rotation_mode='XYZ';bone.rotation_euler.x=angle
  bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();skin,_=evaluated_tree(body,deps);row={'elbow_x_radians':angle,'guards':[]}
  for o in guards:
   tree,tris=evaluated_tree(o,deps);row['guards'].append({'side':o.name[-1],'evaluated_triangles':tris,'intersecting_triangles':len({i for i,j in tree.overlap(skin)})})
  records.append(row)
 for bone in rig.pose.bones:bone.rotation_mode=modes[bone.name];bone.matrix_basis=basis[bone.name]
 rig.data.pose_position='REST';bpy.context.view_layer.update()
 bpy.data.libraries.write(str(out/'forearm-guards-detailed-study.blend'),{s},fake_user=True,compress=True)
 (out/'guard-detail.json').write_text(json.dumps({'status':'Native stitched guard candidate; game motion/export pending','stress_poses':records,'stitch_objects':len(objects)},indent=2))
finally:
 for bone in rig.pose.bones:bone.rotation_mode=modes[bone.name];bone.matrix_basis=basis[bone.name]
 rig.data.pose_position=pose;camera.matrix_world=matrix;camera.data.ortho_scale=scale;hair.hide_render=hidden
 for o in guards+objects:o.hide_render=True
