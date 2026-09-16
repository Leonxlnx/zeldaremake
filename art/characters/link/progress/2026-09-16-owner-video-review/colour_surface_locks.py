"""Transfer sampled hair colour, avoiding UV interpolation across source-atlas seams."""
import bpy,numpy as np,json
from pathlib import Path
out=Path(__file__).resolve().parent;s=bpy.context.scene
hair=next(o for o in s.objects if o.name.startswith('Link | secondary hair locks'))
mat=hair.data.materials[0];p=mat.node_tree.nodes['Principled BSDF'];tex=p.inputs['Base Color'].links[0].from_node;image=tex.image
pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);w,h=image.size;pixels=pixels.reshape(h,w,4)
colour=hair.data.color_attributes.new(name='HairAlbedo',type='FLOAT_COLOR',domain='CORNER')
uv=hair.data.uv_layers.active.data
for loop in hair.data.loops:
 u,v=uv[loop.index].uv;x=max(0,min(w-1,int(u*w)));y=max(0,min(h-1,int(v*h)))
 colour.data[loop.index].color_srgb=(*pixels[y,x,:3],1)
node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name=colour.name;mat.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
s.render.filepath=str(out/'locks-colour-after.png');bpy.ops.render.render(write_still=True)
rig.data.pose_position='POSE';bpy.data.libraries.write(str(out/'hair-locks-colour-study.blend'),{s},fake_user=True,compress=True)
(out/'locks-colour.json').write_text(json.dumps({'status':'Native colour transfer candidate','attribute':'HairAlbedo','domain':'CORNER','source_image':image.name,'interpolates_colours_not_atlas_coordinates':True,'game_export_pending':True},indent=2))
