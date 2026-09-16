"""Opaque curved secondary hair locks, fitted to the current hair surface."""
import bpy,ast,json,math,random,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
out=Path(__file__).resolve().parent
with bpy.data.libraries.load('E:/zeldaremake/art/characters/link/experiments/2026-09-13/source-runtime/cc0-arm-narrow-study.blend',link=False) as (_,loaded):loaded.scenes=['Link | narrow CC0 arm study']
s=loaded.scenes[0];s.name='Link | secondary curved hair locks';bpy.context.window.scene=s
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>10000);mesh=body.data;mesh.calc_loop_triangles()
camera=s.camera;camera.data.type='ORTHO';camera.data.ortho_scale=.46;camera.data.dof.use_dof=False
camera.location=(.5,-3,1.13);camera.rotation_euler=(Vector((0,0,1.015))-camera.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
positions=[body.matrix_world@v.co for v in mesh.vertices];tree=BVHTree.FromPolygons(positions,[t.vertices[:] for t in mesh.loop_triangles],all_triangles=True)
albedo=mesh.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
pixels=np.empty(len(albedo.pixels),dtype=np.float32);albedo.pixels.foreach_get(pixels);width,height=albedo.size
right=camera.matrix_world.to_3x3()@Vector((1,0,0));up=camera.matrix_world.to_3x3()@Vector((0,1,0));direction=camera.matrix_world.to_3x3()@Vector((0,0,-1))
frame=camera.data.view_frame(scene=s);left=min(v.x for v in frame);right_edge=max(v.x for v in frame);bottom=min(v.y for v in frame);top=max(v.y for v in frame)
groom=True;wisps=False;dense=False
source=Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/study_hair_strands.py');parsed=ast.parse(source.read_text());parts=[n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name=='surface' or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='guides' for t in n.targets)]
assert len(parts)==2;exec(compile(ast.Module(body=parts,type_ignores=[]),str(source),'exec'))
vertices=[];uvs=[];faces=[];counts=[];rng=random.Random(161026)
for guide in guides:
 guide=[Vector(p) for p in guide];count=0
 for strand in range(8):
  offset=Vector(((strand-3.5)*4+rng.uniform(-1,1),rng.uniform(-4,4)));runs=[[]]
  for segment in range(len(guide)-1):
   a,b,c,d=guide[max(0,segment-1)],guide[segment],guide[segment+1],guide[min(len(guide)-1,segment+2)]
   for step in range(20):
    t=step/20;p=surface(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)+offset)
    if p is None or runs[-1] and (p-runs[-1][-1]).length>.008:
     if runs[-1]:runs.append([])
    if p is not None:runs[-1].append(p)
  points=max(runs,key=len)
  if len(points)<15:continue
  previous=None;count+=1
  for i,p in enumerate(points):
   t=i/(len(points)-1);taper=max(.03,math.sin(math.pi*t)**.55);tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized();normal=tree.find_nearest(p)[1];across=tangent.cross(normal).normalized();row=[]
   for u in [-1,-.5,0,.5,1]:
    q=p+across*(u*.0016*taper);hit,n,index,distance=tree.ray_cast(q-direction*.02,direction,.05)
    if hit is None:row=[];break
    tri=mesh.loop_triangles[index];uv=barycentric_transform(hit,*[positions[v] for v in tri.vertices],*[Vector((*mesh.uv_layers.active.data[j].uv,0)) for j in tri.loops])
    x=max(0,min(width-1,int(uv.x*width)));y=max(0,min(height-1,int(uv.y*height)));r,g,bl=pixels[(y*width+x)*4:(y*width+x)*4+3]
    if not(r>.25 and r>g*1.04 and bl/r<.64):row=[];break
    row.append((hit-direction*(.0007+.001*(1-u*u)*taper),(uv.x,uv.y)))
   if len(row)!=5:previous=None;continue
   start=len(vertices)
   for p,uv in row:vertices.append(p);uvs.append(uv)
   if previous is not None:
    for j in range(4):faces.append((previous+j,previous+j+1,start+j+1,start+j))
   previous=start
 counts.append(count)
assert len(faces)>2000 and len(faces)*2<50000,(counts,len(faces))
m=bpy.data.meshes.new('Curved hair lock surfaces');m.from_pydata(vertices,[],faces);m.update()
# All strips face the review-camera side; use their own curved geometry normals.
for f in m.polygons:
 if f.normal.dot(-direction)<0:f.flip()
 f.use_smooth=True
m.update();uv=m.uv_layers.new(name='UVMap')
for l in m.loops:uv.data[l.index].uv=uvs[l.vertex_index]
hair=bpy.data.objects.new('Link | secondary hair locks',m);s.collection.objects.link(hair)
mat=bpy.data.materials.new('Secondary locks | existing albedo');mat.use_nodes=True
shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.56
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=albedo;mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color']);m.materials.append(mat)
hair.parent=rig;hair.vertex_groups.new(name='head').add(list(range(len(vertices))),1,'REPLACE');hair.modifiers.new('Existing head bone','ARMATURE').object=rig
m.calc_loop_triangles();overlay=BVHTree.FromPolygons(vertices,[t.vertices[:] for t in m.loop_triangles],all_triangles=True);pairs=overlay.overlap(tree)
report={'status':'Native surface-lock study, visual review required','locks':sum(counts),'triangles':len(m.loop_triangles),'body_intersecting_triangles':len({a for a,b in pairs}),'additional_materials':1,'source_geometry_unchanged':True,'alpha_cards':False}
(out/'locks-review.json').write_text(json.dumps(report,indent=2))
s.render.resolution_x=720;s.render.resolution_y=820;s.render.resolution_percentage=100;s.cycles.samples=24;s.render.threads_mode='FIXED';s.render.threads=4
hair.hide_render=True;s.render.filepath=str(out/'locks-before.png');bpy.ops.render.render(write_still=True)
hair.hide_render=False;s.render.filepath=str(out/'locks-after.png');bpy.ops.render.render(write_still=True)
rig.data.pose_position='POSE';bpy.data.libraries.write(str(out/'hair-locks-study.blend'),{s},fake_user=True,compress=True)
