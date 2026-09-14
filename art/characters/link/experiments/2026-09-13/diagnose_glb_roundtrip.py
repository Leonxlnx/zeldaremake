"""Render the exported GLB in the same native studio to isolate export shading."""
import bpy,json,hashlib
from pathlib import Path

root=Path(__file__).resolve().parent/'source-runtime';name='Link | GLB roundtrip diagnostic'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'face-smooth-candidate.blend'),link=False) as (_,loaded):loaded.scenes=['Link | face smooth study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
for ob in scene.collection.objects:
    if ob.type=='ARMATURE':ob.data.pose_position='REST'
scene.render.filepath=str(root/'face-roundtrip-before.png');bpy.ops.render.render(write_still=True)
for ob in list(scene.collection.objects):
    if ob.type in {'MESH','ARMATURE'}:
        assert len(ob.users_scene)==1
        bpy.data.objects.remove(ob,do_unlink=True)
target=root/'face-smooth-candidate.glb'
bpy.ops.import_scene.gltf(filepath=str(target))
rigs=[ob for ob in scene.collection.objects if ob.type=='ARMATURE']
assert len(rigs)==1 and len(rigs[0].data.bones)==19
rigs[0].data.pose_position='REST'
scene.render.filepath=str(root/'face-roundtrip-after.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'face-roundtrip-diagnostic.blend'),{scene},fake_user=True,compress=True)
record={'status':'Native source versus GLB reimport diagnostic only','glb_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bones':19,'source_and_reimport_camera_identical':True}
(root/'face-roundtrip-diagnostic.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
