"""Map cut orbital surfaces to neighbouring skin instead of a flat sampled skin tint."""
import bpy,json
from pathlib import Path

root=Path(__file__).resolve().parent/'source-runtime';name='Link | orbital UV study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'lid-fit-candidate.blend'),link=False) as (available,loaded):loaded.scenes=['Link | eyelid lattice study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
before=sum(len(p.vertices)-2 for p in body.data.polygons)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
selected=[p for p in body.data.polygons if p.material_index==1];assert 100<len(selected)<5000,len(selected)
for p in selected:p.select=True
existing=set(scene.objects);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
created=set(scene.objects)-existing;assert len(created)==1;orbital=created.pop()
bpy.ops.object.select_all(action='DESELECT');orbital.select_set(True);bpy.context.view_layer.objects.active=orbital
transfer=orbital.modifiers.new('Neighbouring skin UVs','DATA_TRANSFER');transfer.object=body
transfer.use_loop_data=True;transfer.data_types_loops={'UV'};transfer.loop_mapping='POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier=transfer.name)
material=body.data.materials[0].copy();material.name='Original mapped orbital skin'
bs=material.node_tree.nodes['Principled BSDF']
for link in list(bs.inputs['Normal'].links):material.node_tree.links.remove(link)
orbital.data.materials.clear();orbital.data.materials.append(material)
for p in orbital.data.polygons:p.material_index=0;p.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);orbital.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
assert sum(len(p.vertices)-2 for p in body.data.polygons)==before
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/'face-orbital-uv-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'orbital-uv-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted native UV transfer study; not exported','orbital_triangles':len(selected),'body_triangles':before,'source':'Existing corrected body albedo; nearest adjacent skin UV via native Data Transfer'}
(root/'orbital-uv-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
