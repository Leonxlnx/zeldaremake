"""Review relaxed open lids using the authored native morph; no default asset edits."""
import bpy,json
from pathlib import Path
from mathutils import Vector

out=Path(__file__).resolve().parent
job=globals().get('JOB',{})
s=bpy.data.scenes['Link | September19 run contact baseline'];bpy.context.window.scene=s
body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
rig=next(o for o in s.objects if o.type=='ARMATURE');keys=body.data.shape_keys.key_blocks
camera=s.camera;saved_camera=camera.matrix_world.copy();scale=camera.data.ortho_scale
saved_values={k.name:k.value for k in keys};pose=rig.data.pose_position
resolution=(s.render.resolution_x,s.render.resolution_y);rows=[]
try:
    rig.data.pose_position='REST';s.cycles.device='CPU';s.cycles.samples=24
    s.render.threads_mode='FIXED';s.render.threads=4
    s.render.resolution_x=720;s.render.resolution_y=820;s.render.resolution_percentage=100
    focus=Vector((0,-.025,.97));keys['blink'].value=0
    for view,offset in [('front',(0,-3,.04)),('three-quarter',(1.6,-3,.06))]:
        camera.location=focus+Vector(offset);camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=.42
        for weight in job.get('weights',[0,.18,.32]):
            keys['blinkHalf'].value=weight;bpy.context.view_layer.update()
            file=f'{view}-rest-{weight:.2f}.png';s.render.filepath=str(out/file)
            bpy.ops.render.render(write_still=True);rows.append({'view':view,'blinkHalf':weight,'file':file})
    (out/job.get('report','study.json')).write_text(json.dumps({'scene':s.name,'scope':'Native expression preview using existing eyelid morph. No mesh, texture, action or default model changed. Runtime expression and blink compatibility not yet evaluated.','views':rows},indent=2),encoding='utf-8')
finally:
    for name,value in saved_values.items():keys[name].value=value
    rig.data.pose_position=pose;camera.matrix_world=saved_camera;camera.data.ortho_scale=scale
    s.render.resolution_x,s.render.resolution_y=resolution;bpy.context.view_layer.update()
