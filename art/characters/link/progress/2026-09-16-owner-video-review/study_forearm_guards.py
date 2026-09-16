"""Original leather guard shells fitted to the current forearms, not cylinders over empty space."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=Path(__file__).resolve().parent;s=bpy.context.scene
body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000);rig=next(o for o in s.objects if o.type=='ARMATURE')
pose=rig.data.pose_position;rig.data.pose_position='REST';body.data.calc_loop_triangles()
tree=BVHTree.FromPolygons([v.co for v in body.data.vertices],[t.vertices[:] for t in body.data.loop_triangles],all_triangles=True)
material=bpy.data.materials.new('Original leather forearm guards');material.use_nodes=True
p=material.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.105,.042,.021,1);p.inputs['Roughness'].default_value=.68
noise=material.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1800;noise.inputs['Detail'].default_value=2
bump=material.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.00012
material.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);material.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
trim=material.copy();trim.name='Original darker guard binding';trim.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.043,.017,.008,1)
objects=[];reports=[]
for side in ['L','R']:
 bone=rig.data.bones['elbow'+side];a=bone.head_local;b=bone.tail_local;axis=(b-a).normalized();u=axis.cross(Vector((0,1,0))).normalized();v=axis.cross(u).normalized()
 group=body.vertex_groups['elbow'+side].index
 skin=[p.co for p in body.data.vertices if any(g.group==group and g.weight>.3 for g in p.groups)]
 vertices=[];faces=[];radii=[];steps=[.25,.29,.35,.48,.62,.76,.83,.87];segments=32
 for t in steps:
  center=a.lerp(b,t)
  section=[p-center for p in skin if abs((p-center).dot(axis))<.014]
  assert len(section)>=4,(side,t,len(section))
  center+=u*((min(p.dot(u) for p in section)+max(p.dot(u) for p in section))/2)+v*((min(p.dot(v) for p in section)+max(p.dot(v) for p in section))/2)
  for j in range(segments):
   angle=j*2*math.pi/segments;d=u*math.cos(angle)+v*math.sin(angle);hit=tree.ray_cast(center,d,.075)[0]
   assert hit is not None,(side,t,j)
   radius=(hit-center).length;assert .008<radius<.065,(side,t,radius)
   radii.append(radius);vertices.append(center+d*(radius+.003))
 for i in range(len(steps)-1):
  for j in range(segments):faces.append((i*segments+j,i*segments+(j+1)%segments,(i+1)*segments+(j+1)%segments,(i+1)*segments+j))
 m=bpy.data.meshes.new('Fitted forearm leather '+side);m.from_pydata(vertices,[],faces);m.update();m.materials.append(material);m.materials.append(trim)
 for f in m.polygons:
  f.use_smooth=True;f.material_index=1 if f.index//segments in [0,len(steps)-2] else 0
 o=bpy.data.objects.new('Link | fitted forearm guard '+side,m);s.collection.objects.link(o)
 o.parent=rig;o.vertex_groups.new(name='elbow'+side).add(list(range(len(vertices))),1,'REPLACE')
 shell=o.modifiers.new('Leather thickness','SOLIDIFY');shell.thickness=.0015;shell.offset=1
 edge=o.modifiers.new('Rounded leather binding','BEVEL');edge.width=.0005;edge.segments=2
 o.modifiers.new('Existing forearm rig','ARMATURE').object=rig
 m.calc_loop_triangles();overlap=BVHTree.FromPolygons(vertices,[t.vertices[:] for t in m.loop_triangles],all_triangles=True).overlap(tree)
 reports.append({'side':side,'shell_triangles':len(m.loop_triangles),'body_intersecting_shell_triangles':len({i for i,j in overlap}),'radial_clearance_m':.003,'forearm_radius_range_m':[min(radii),max(radii)]});objects.append(o)
camera=s.camera;matrix=camera.matrix_world.copy();scale=camera.data.ortho_scale
hair=next(o for o in s.objects if o.type=='MESH' and 'secondary hair' in o.name);hidden=hair.hide_render;hair.hide_render=True
try:
 focus=Vector((0,0,.64));camera.location=(.45,-3,.85);camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.25;s.cycles.samples=16;s.render.threads=4
 for label,visible in [('before',False),('after',True)]:
  for o in objects:o.hide_render=not visible
  s.render.filepath=str(out/('forearm-guards-'+label+'.png'));bpy.ops.render.render(write_still=True)
 bpy.data.libraries.write(str(out/'forearm-guards-study.blend'),{s},fake_user=True,compress=True)
 (out/'forearm-guards.json').write_text(json.dumps({'status':'Native first guard-shell study; seams/straps and animated fit pending','guards':reports},indent=2))
finally:
 camera.matrix_world=matrix;camera.data.ortho_scale=scale;hair.hide_render=hidden;rig.data.pose_position=pose
 for o in objects:o.hide_render=True
