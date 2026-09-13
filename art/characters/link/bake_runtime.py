"""Bake one missing PBR map per MCP call, preserving the editable source shaders."""
import bpy
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['Link | runtime']
bpy.context.window.scene=scene
record=json.loads(scene['pipeline'])
jobs=[(group,kind) for group in record['groups'] for kind in ['color','roughness','normal']]
jobs.append(('outfit','metallic'))
pending=[job for job in jobs if '/'.join(job) not in record['bakes']]
assert pending, 'All PBR maps are already baked'
group,kind=pending[0]
if JOB:
    group,kind=JOB['group'],JOB['kind']
    assert (group,kind) in jobs
info=record['groups'][group]
low=bpy.data.objects[info['object']]
source_collection=next(c for c in scene.collection.children if c.name.startswith('LINK | original model'))
layer=scene.view_layers[0].layer_collection.children[source_collection.name]
layer.exclude=False
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
sources=[bpy.data.objects[name] for name in info['source_objects']]
for ob in sources:ob.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active=low
material=low.data.materials[0]
nodes,links=material.node_tree.nodes,material.node_tree.links
name=group+'_'+kind
size=2048 if group in {'skin','outfit'} else 1024
im=bpy.data.images.new(name,width=size,height=size,alpha=False)
im.colorspace_settings.name='sRGB' if kind=='color' else 'Non-Color'
image_node=nodes.new('ShaderNodeTexImage');image_node.image=im
for n in nodes:n.select=False
image_node.select=True;nodes.active=image_node
scene.render.bake.use_selected_to_active=True
scene.render.bake.use_cage=False
scene.render.bake.cage_extrusion=.009
scene.render.bake.max_ray_distance=.018
scene.render.bake.margin=12
scene.render.bake.use_clear=True
scene.render.bake.normal_space='TANGENT'
scene.render.bake.use_pass_direct=False
scene.render.bake.use_pass_indirect=False
scene.render.bake.use_pass_color=True
scene.cycles.samples=8
scene.render.threads_mode='FIXED';scene.render.threads=4
changed=[]
try:
    if kind=='metallic':
        # Cycles has no metallic bake pass. Emit the existing scalar metal values.
        materials={mat for ob in sources for mat in ob.data.materials if mat}
        for mat in materials:
            ns,ls=mat.node_tree.nodes,mat.node_tree.links
            output=next(n for n in ns if n.type=='OUTPUT_MATERIAL' and n.is_active_output)
            original=output.inputs['Surface'].links[0].from_socket
            value=ns.get('Principled BSDF').inputs['Metallic'].default_value
            emission=ns.new('ShaderNodeEmission');emission.inputs[0].default_value=(value,value,value,1)
            ls.new(emission.outputs[0],output.inputs['Surface'])
            changed.append((mat,output,original,emission))
    bpy.ops.object.bake(type={'color':'DIFFUSE','roughness':'ROUGHNESS','normal':'NORMAL','metallic':'EMIT'}[kind])
finally:
    for mat,output,original,emission in changed:
        mat.node_tree.links.new(original,output.inputs['Surface'])
        mat.node_tree.nodes.remove(emission)
    layer.exclude=True
directory=ROOT/'runtime/textures';directory.mkdir(parents=True,exist_ok=True)
im.filepath_raw=str(directory/(name+'.png'));im.file_format='PNG';im.save();im.pack()
bsdf=nodes.get('Principled BSDF')
if kind=='normal':
    normal=nodes.new('ShaderNodeNormalMap')
    links.new(image_node.outputs['Color'],normal.inputs['Color'])
    links.new(normal.outputs[0],bsdf.inputs['Normal'])
else:
    links.new(image_node.outputs['Color'],bsdf.inputs[{'color':'Base Color','roughness':'Roughness','metallic':'Metallic'}[kind]])
if group=='skin':
    bsdf.inputs['Subsurface Weight'].default_value=.08
    bsdf.inputs['Subsurface Scale'].default_value=.035
    bsdf.inputs['Roughness'].default_value=.46
key=group+'/'+kind
if key not in record['bakes']:record['bakes'].append(key)
record['stage']='PBR baked, awaiting rig' if len(record['bakes'])==len(jobs) else 'PBR baking in progress'
scene['pipeline']=json.dumps(record)
scene['status']=record['stage']
(ROOT/'runtime/pipeline.json').write_text(json.dumps(record,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-runtime.blend'),compress=True)
assert Path(im.filepath_raw).stat().st_size>1000
print(json.dumps({'baked':key,'resolution':size,'completed':len(record['bakes']),'total':len(jobs)}))
