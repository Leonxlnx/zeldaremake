"""Original leather colour/roughness variation and grain baked to standard PBR maps."""
import bpy,json,hashlib
from pathlib import Path
out=Path(__file__).resolve().parent;s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE');pose=r.data.pose_position;r.data.pose_position='REST'
guards=[o for o in s.objects if o.name.startswith('Link | fitted forearm guard')];visible={o.name:o.hide_render for o in guards};records=[]
try:
 s.cycles.samples=16;s.render.threads_mode='FIXED';s.render.threads=4;s.render.bake.use_selected_to_active=False;s.render.bake.use_clear=True;s.render.bake.margin=8
 for o in guards:
  o.hide_render=False;side=o.name[-1];mats=[]
  for i,old in enumerate(list(o.data.materials)):
   m=old.copy();o.data.materials[i]=m;nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes['Principled BSDF']
   grain=next(n for n in nodes if n.type=='BUMP');grain.inputs['Strength'].default_value=.35;grain.inputs['Distance'].default_value=.0003;links.new(grain.outputs['Normal'],p.inputs['Normal'])
   noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=9;noise.inputs['Detail'].default_value=3
   ramp=nodes.new('ShaderNodeValToRGB');base=tuple(p.inputs['Base Color'].default_value)
   ramp.color_ramp.elements[0].color=tuple(c*.8 for c in base[:3])+(1,);ramp.color_ramp.elements[1].color=tuple(c*1.2 for c in base[:3])+(1,);links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],p.inputs['Base Color'])
   rough=nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.56;rough.inputs['To Max'].default_value=.78;links.new(noise.outputs['Fac'],rough.inputs['Value']);links.new(rough.outputs['Result'],p.inputs['Roughness'])
   output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');emission=nodes.new('ShaderNodeEmission');target=nodes.new('ShaderNodeTexImage')
   mats.append((m,p,output,emission,target,ramp,rough))
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  images={}
  for kind in ['color','roughness','normal']:
   image=bpy.data.images.new('Guard '+side+' '+kind,width=512,height=512,alpha=False);image.colorspace_settings.name='sRGB' if kind=='color' else 'Non-Color';images[kind]=image
   for m,p,output,emission,target,ramp,rough in mats:
    target.image=image;m.node_tree.nodes.active=target;links=m.node_tree.links
    if kind=='normal':links.new(p.outputs['BSDF'],output.inputs['Surface'])
    else:
     links.new(ramp.outputs['Color'] if kind=='color' else rough.outputs['Result'],emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
   bpy.ops.object.bake(type='NORMAL' if kind=='normal' else 'EMIT')
   image.filepath_raw=str(out/('guard-pbr-'+side+'-'+kind+'.png'));image.file_format='PNG';image.save();image.pack()
   records.append({'side':side,'kind':kind,'sha256':hashlib.sha256(Path(image.filepath_raw).read_bytes()).hexdigest()})
  for m,p,output,emission,target,ramp,rough in mats:
   for kind,socket in [('color','Base Color'),('roughness','Roughness'),('normal','Normal')]:
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images[kind];signal=tex.outputs['Color']
    if kind=='normal':n=m.node_tree.nodes.new('ShaderNodeNormalMap');m.node_tree.links.new(signal,n.inputs['Color']);signal=n.outputs['Normal']
    m.node_tree.links.new(signal,p.inputs[socket])
   m.node_tree.links.new(p.outputs[0],output.inputs['Surface'])
 bpy.data.libraries.write(str(out/'forearm-guards-pbr-study.blend'),{s},fake_user=True,compress=True)
 (out/'guard-pbr-bake.json').write_text(json.dumps({'status':'PBR candidate; runtime visual check pending','maps':records,'geometry_unchanged':True},indent=2))
finally:
 r.data.pose_position=pose
 for o in guards:o.hide_render=visible[o.name]
