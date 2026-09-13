"""Compare a shallower globe while preserving the reviewed eye aperture and iris UVs."""
import bpy,json
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime'
name='Link | source eye depth study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'eye-candidate.blend'),link=False) as (available,loaded):
    assert 'Link | source eye study' in available.scenes
    loaded.scenes=['Link | source eye study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name];assert len(eyes)==2
for eye in eyes:
    centre=(min(v.co.y for v in eye.data.vertices)+max(v.co.y for v in eye.data.vertices))/2
    before=[(v.co.x,v.co.z) for v in eye.data.vertices]
    for vertex in eye.data.vertices:vertex.co.y=centre+(vertex.co.y-centre)*.7
    assert before==[(v.co.x,v.co.z) for v in eye.data.vertices]
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.46;scene.camera.location=(.5,-3,1.13)
scene.camera.rotation_euler=(Vector((0,0,1.015))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.filepath=str(root/'face-eye-depth-study.png');bpy.ops.render.render(write_still=True)
(root/'eye-depth-study.json').write_text(json.dumps({'status':'Unaccepted depth study; original scene and exported asset unchanged','depth_scale':.7,'centre_shift':0},indent=2)+'\n')
print('Saved eye-depth comparison',scene.render.filepath)
