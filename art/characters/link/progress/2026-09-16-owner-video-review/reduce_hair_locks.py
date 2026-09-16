"""Test Blender's native decimator on a disposable copy of the hair addition."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=Path(__file__).resolve().parent;s=bpy.context.scene
h=next(o for o in s.objects if o.type=='MESH' and 'secondary hair' in o.name)
copy=h.copy();copy.data=h.data.copy();copy.modifiers.clear();copy.parent=None;copy.name='Review hair addition'
isolated=bpy.data.scenes.new('Reduced hair export');isolated.collection.objects.link(copy);bpy.context.window.scene=isolated
try:
 copy.select_set(True);bpy.context.view_layer.objects.active=copy
 mod=copy.modifiers.new('Reduce strand tessellation','DECIMATE');mod.ratio=.25;mod.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=mod.name);copy.data.calc_loop_triangles()
 count=len(copy.data.loop_triangles);assert 0<count<6000
 assert copy.data.color_attributes.get('HairAlbedo') is not None
 body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
 body.data.calc_loop_triangles()
 tree=BVHTree.FromPolygons([body.matrix_world@v.co for v in body.data.vertices],[t.vertices[:] for t in body.data.loop_triangles],all_triangles=True)
 direction=copy.matrix_world.to_3x3().inverted()@(s.camera.rotation_euler.to_matrix()@Vector((0,0,-1)))
 before=[v.co.copy() for v in copy.data.vertices];history=[]
 for attempt in range(13):
  overlay=BVHTree.FromPolygons([copy.matrix_world@v.co for v in copy.data.vertices],[t.vertices[:] for t in copy.data.loop_triangles],all_triangles=True)
  bad={a for a,b in overlay.overlap(tree)};history.append(len(bad))
  if not bad:break
  for i in {v for j in bad for v in copy.data.loop_triangles[j].vertices}:copy.data.vertices[i].co-=direction*.00025
  copy.data.update()
 assert history[-1]==0,history
 max_move=max((v.co-p).length for v,p in zip(copy.data.vertices,before));assert max_move<=.0031
 bpy.ops.export_scene.gltf(filepath=str(out/'hair-addition.glb'),export_format='GLB',use_active_scene=True,export_animations=False,export_skins=False,export_vertex_color='ACTIVE')
 bpy.data.libraries.write(str(out/'hair-locks-reduced-study.blend'),{isolated},fake_user=True,compress=True)
 (out/'hair-reduction.json').write_text(json.dumps({'triangles':count,'ratio':.25,'method':'Blender collapse decimation on copy, bounded local clearance correction','contact_history':history,'max_clearance_displacement_m':max_move,'status':'Contact resolved; visual review pending'},indent=2))
 print('Reduced triangles',count)
finally:
 bpy.context.window.scene=s;bpy.data.objects.remove(copy,do_unlink=True);bpy.data.scenes.remove(isolated)
