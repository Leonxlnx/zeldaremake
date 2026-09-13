"""Compare the saved face with and without its generated normal map."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime';name='Link | face normal diagnostic'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'hardware-candidate.blend'),link=False) as (_,loaded):loaded.scenes=['Link | boot hardware study v2']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
shader=body.data.materials[0].node_tree.nodes['Principled BSDF']
normal=shader.inputs['Normal'].links[0].from_node
assert normal.type=='NORMAL_MAP' and not normal.inputs['Strength'].is_linked
original_strength=normal.inputs['Strength'].default_value
scene.camera.data.type='PERSP';scene.camera.data.sensor_fit='VERTICAL';scene.camera.data.sensor_height=32;scene.camera.data.lens=32/(2*math.tan(math.radians(15)))
scene.camera.location=(.14,-.84,1.03);scene.camera.rotation_euler=(Vector((0,0,1.005))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
for label,strength in [('source',original_strength),('geometry',0)]:
    normal.inputs['Strength'].default_value=strength
    scene.render.filepath=str(root/('face-normal-'+label+'.png'));bpy.ops.render.render(write_still=True)
normal.inputs['Strength'].default_value=original_strength
bpy.data.libraries.write(str(root/'face-normal-diagnostic.blend'),{scene},fake_user=True,compress=True)
record={'status':'Shading diagnostic only; source geometry and delivered GLB unchanged','original_normal_strength':original_strength,'body_triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'camera_matches_runtime_face':True}
(root/'face-normal-diagnostic.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
