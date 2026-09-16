"""Bake original procedural leather grain to ordinary tangent-space normal maps."""
import bpy,json,hashlib
from pathlib import Path
out=Path(__file__).resolve().parent;s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE');pose=r.data.pose_position;r.data.pose_position='REST'
guards=[o for o in s.objects if o.name.startswith('Link | fitted forearm guard')];assert len(guards)==2
visibility={o.name:o.hide_render for o in guards}
records=[]
try:
 s.render.engine='CYCLES';s.cycles.samples=16;s.render.threads_mode='FIXED';s.render.threads=4
 s.render.bake.use_selected_to_active=False;s.render.bake.use_clear=True;s.render.bake.margin=8
 for o in guards:
  o.hide_render=False
  side=o.name[-1];o.data=o.data.copy();positions=[tuple(v.co) for v in o.data.vertices]
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.035);bpy.ops.object.mode_set(mode='OBJECT')
  image=bpy.data.images.new('Original guard leather normal '+side,width=512,height=512,alpha=False);image.colorspace_settings.name='Non-Color'
  mats=[]
  for i,old in enumerate(list(o.data.materials)):
   m=old.copy();o.data.materials[i]=m;nodes=m.node_tree.nodes
   for n in nodes:
    if n.type=='TEX_NOISE':n.inputs['Scale'].default_value=240
   target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target;mats.append((m,target))
  bpy.ops.object.bake(type='NORMAL')
  image.filepath_raw=str(out/('guard-leather-'+side+'-normal.png'));image.file_format='PNG';image.save();image.pack()
  for m,target in mats:
   normal=m.node_tree.nodes.new('ShaderNodeNormalMap');m.node_tree.links.new(target.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],m.node_tree.nodes['Principled BSDF'].inputs['Normal'])
  assert positions==[tuple(v.co) for v in o.data.vertices]
  records.append({'side':side,'size':512,'sha256':hashlib.sha256(Path(image.filepath_raw).read_bytes()).hexdigest(),'positions_exact':True})
 bpy.data.libraries.write(str(out/'forearm-guards-baked-study.blend'),{s},fake_user=True,compress=True)
 (out/'guard-leather-bake.json').write_text(json.dumps({'status':'Baked candidate; inspect runtime normal response','maps':records},indent=2))
finally:
 if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
 r.data.pose_position=pose
 for o in guards:o.hide_render=visibility[o.name]
