"""Export only original guards/thread plus their existing skeleton, in rest space."""
import bpy,json
from pathlib import Path
out=Path(__file__).resolve().parent;s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE');pose=rig.data.pose_position;rig.data.pose_position='REST';bpy.context.view_layer.update()
source=[o for o in s.objects if o.name.startswith(('Link | fitted forearm guard','Link | guard stitching'))];assert len(source)==4
isolated=bpy.data.scenes.new('Guard addition export');copies=[];corrected=0;r=rig.copy();r.data=rig.data.copy();r.animation_data_clear();isolated.collection.objects.link(r)
try:
 deps=bpy.context.evaluated_depsgraph_get()
 for o in source:
  c=o.copy();c.data=bpy.data.meshes.new_from_object(o.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
  c.modifiers.clear();c.parent=r;c.hide_render=False;c.hide_viewport=False
  c.modifiers.new('Existing rig weights','ARMATURE').object=r;isolated.collection.objects.link(c);copies.append(c)
  assert len(c.vertex_groups)==len(o.vertex_groups)
  for v in c.data.vertices:
   weights=[(g.group,g.weight) for g in v.groups];assert abs(sum(w for g,w in weights)-1)<1e-5
   if any(w<0 for g,w in weights):
    assert all(w>=-1e-6 for g,w in weights);corrected+=1;total=sum(max(0,w) for g,w in weights)
    for group,w in weights:
     if w<=0:c.vertex_groups[group].remove([v.index])
     else:c.vertex_groups[group].add([v.index],w/total,'REPLACE')
  assert not c.data.validate(verbose=True),'Unexpected evaluated mesh validation repair'
 bpy.context.window.scene=isolated
 bpy.ops.export_scene.gltf(filepath=str(out/'guard-addition.glb'),export_format='GLB',use_active_scene=True,export_animations=False,export_skins=True,export_apply=False)
 (out/'guard-export.json').write_text(json.dumps({'meshes':len(copies),'evaluated_vertices':sum(len(c.data.vertices) for c in copies),'weights_normalized':True,'bevel_roundoff_vertices_corrected':corrected,'status':'Addon export only; procedural leather bump not baked; original runtime not changed'},indent=2))
finally:
 bpy.context.window.scene=s;rig.data.pose_position=pose
 for c in copies:bpy.data.objects.remove(c,do_unlink=True)
 bpy.data.objects.remove(r,do_unlink=True);bpy.data.scenes.remove(isolated)
