"""Test Blender's native decimator on a disposable copy of the hair addition."""
import bpy,json
from pathlib import Path
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
 bpy.ops.export_scene.gltf(filepath=str(out/'hair-addition.glb'),export_format='GLB',use_active_scene=True,export_animations=False,export_skins=False,export_vertex_color='ACTIVE')
 bpy.data.libraries.write(str(out/'hair-locks-reduced-study.blend'),{isolated},fake_user=True,compress=True)
 (out/'hair-reduction.json').write_text(json.dumps({'triangles':count,'ratio':.25,'method':'Blender collapse decimation on copy','status':'Visual and body-contact review pending'},indent=2))
 print('Reduced triangles',count)
finally:
 bpy.context.window.scene=s;bpy.data.objects.remove(copy,do_unlink=True);bpy.data.scenes.remove(isolated)
