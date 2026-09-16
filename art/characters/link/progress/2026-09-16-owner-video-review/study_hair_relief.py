"""Reuse the existing supersampled native hair bake on the current character atlas."""
import bpy, json, numpy as np, hashlib
from pathlib import Path
from mathutils import Vector
out=Path('E:/zeldaremake/art/characters/link/progress/2026-09-16-owner-video-review')
root=Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/source-runtime')
s=bpy.context.scene
body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>10000)
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
material=body.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
normal=nodes['Principled BSDF'].inputs['Normal'].links[0].from_node
oldnode=normal.inputs['Color'].links[0].from_node
original=oldnode.image
assert tuple(original.size)==(4096,4096)
def pixels(image):
    a=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(a)
    return a.reshape(-1,4)
base=pixels(original)
donors=[]
for name in ['hair-existing-atlas-subtle-normal.png','hair-existing-atlas-filtered-normal.png']:
    image=bpy.data.images.load(str(root/name),check_existing=False)
    image.colorspace_settings.name='Non-Color';donors.append(pixels(image))
delta=donors[1][:,:3]-donors[0][:,:3]
# The same native bake exists at20% and100%. Use only meaningful hair differences;
# sub-2/255 changes can be PNG quantization outside the actual baked hair region.
mask=np.max(np.abs(delta),axis=1)>2/255
assert 10000<int(mask.sum())<1000000,int(mask.sum())
result=base.copy()
v=(base[mask,:3]+delta[mask]*.375)*2-1
v/=np.maximum(np.linalg.norm(v,axis=1,keepdims=True),1e-8)
result[mask,:3]=(v+1)/2
assert np.array_equal(result[~mask],base[~mask])
assert np.all(np.isfinite(result))
positions=[tuple(v.co) for v in body.data.vertices]
s.camera.location=(.5,-3,1.13)
s.camera.rotation_euler=(Vector((0,0,1.015))-s.camera.location).to_track_quat('-Z','Y').to_euler()
s.camera.data.type='ORTHO';s.camera.data.ortho_scale=.46;s.camera.data.dof.use_dof=False
s.cycles.samples=24;s.render.threads_mode='FIXED';s.render.threads=4
s.render.filepath=str(out/'hair-before.png');bpy.ops.render.render(write_still=True)
image=bpy.data.images.new('Current atlas | stronger filtered hair relief',width=4096,height=4096,alpha=False)
image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(result.ravel());image.update()
image.filepath_raw=str(out/'hair-normal.png');image.file_format='PNG';image.save();image.pack()
node=nodes.new('ShaderNodeTexImage');node.image=image
links.new(node.outputs['Color'],normal.inputs['Color'])
s.render.filepath=str(out/'hair-after.png');bpy.ops.render.render(write_still=True)
assert positions==[tuple(v.co) for v in body.data.vertices]
rig.data.pose_position='POSE'
bpy.data.libraries.write(str(out/'hair-relief-study.blend'),{s},fake_user=True,compress=True)
report={'status':'Native candidate, requires visual and game review','changed_pixels':int(mask.sum()),'unchanged_pixels_exact_before_png':True,'mesh_positions_exact':True,'donor_delta_fraction':.375,'approx_total_relief':.5,'normal_sha256':hashlib.sha256((out/'hair-normal.png').read_bytes()).hexdigest()}
(out/'hair-review.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
