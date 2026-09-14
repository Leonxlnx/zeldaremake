"""Rebuild the smaller socket's exposed skin from the complete, uncut source map."""
import bpy,json
from pathlib import Path

root=Path(__file__).resolve().parent/'source-runtime'
scene=bpy.data.scenes['Link | almond socket study'];bpy.context.window.scene=scene
body=scene.objects['Link | almond face'];material=body.data.materials[0]
nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
assert 'Complete source skin' not in nodes,'Colour restoration already applied'
previous=shader.inputs['Base Color'].links[0].from_socket
source=bpy.data.objects['Link | source candidate'].data.materials[0]
source_image=source.node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
skin_uv=json.loads((root/'eye-study.json').read_text())['skin_sample_uv']
points=[e['point'] for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]

# The older atlas has no texels for faces removed by its larger cuts. Rebuild
# the eye-region colour from the full source; retain the reviewed atlas elsewhere.
full=nodes.new('ShaderNodeTexImage');full.name='Complete source skin';full.image=source_image
skin=nodes.new('ShaderNodeTexImage');skin.image=source_image
uv=nodes.new('ShaderNodeCombineXYZ');uv.inputs['X'].default_value=skin_uv[0];uv.inputs['Y'].default_value=skin_uv[1]
links.new(uv.outputs[0],skin.inputs['Vector'])
coord=nodes.new('ShaderNodeTexCoord');masks=[];outer_masks=[]
for point in points:
    distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE';distance.inputs[1].default_value=point
    links.new(coord.outputs['Object'],distance.inputs[0])
    for minimum,maximum,outputs in [(.040,.052,masks),(.052,.065,outer_masks)]:
        fade=nodes.new('ShaderNodeMapRange');fade.interpolation_type='SMOOTHSTEP';fade.clamp=True
        for key,value in [('From Min',minimum),('From Max',maximum),('To Min',1),('To Max',0)]:fade.inputs[key].default_value=value
        links.new(distance.outputs['Value'],fade.inputs['Value']);outputs.append(fade.outputs['Result'])
combined=[]
for pair in (masks,outer_masks):
    maximum=nodes.new('ShaderNodeMath');maximum.operation='MAXIMUM'
    for i,mask in enumerate(pair):links.new(mask,maximum.inputs[i])
    combined.append(maximum.outputs[0])
paint=nodes.new('ShaderNodeMixRGB');links.new(combined[0],paint.inputs[0]);links.new(full.outputs['Color'],paint.inputs[1]);links.new(skin.outputs['Color'],paint.inputs[2])
restore=nodes.new('ShaderNodeMixRGB');links.new(combined[1],restore.inputs[0]);links.new(previous,restore.inputs[1]);links.new(paint.outputs[0],restore.inputs[2]);links.new(restore.outputs[0],shader.inputs['Base Color'])
assert full.image==source_image and len(points)==2 and all(.9<p[2]<1.01 for p in points)
scene.render.filepath=str(root/'face-almond-colour-restored.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'almond-colour-restored.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted colour-restored almond study; not exported','source_image':source_image.name,'skin_sample_uv':skin_uv,'paint_fade_metres':[.040,.052],'restore_fade_metres':[.052,.065],'reason':'Three lower-lid probes in the reused atlas were RGB 0,0,0 while the complete source contained skin colour; smaller openings expose previously removed faces.'}
(root/'almond-colour-restoration.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
