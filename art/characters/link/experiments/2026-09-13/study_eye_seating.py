"""Compare globe seating against the measured orbital rim, with existing lid geometry."""
import bpy,json
from pathlib import Path

root=Path(__file__).resolve().parent/'source-runtime';name='Link | eye seating study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'lid-fit-candidate.blend'),link=False) as (available,loaded):loaded.scenes=['Link | eyelid lattice study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name];assert len(eyes)==2
for eye in eyes:
    before=[v.co.copy() for v in eye.data.vertices]
    for vertex in eye.data.vertices:vertex.co.y-=.010
    assert all(abs((vertex.co-old).length-.010)<1e-7 for vertex,old in zip(eye.data.vertices,before))
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/'face-eye-seating-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'eye-seating-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted seating study; not exported','eye_y_shift_metres':-.010,'body_changed':False,
    'reason':'Measured current iris plane y=-.104 versus upper rim-.127 and lower rim-.115; compare reduced socket depth visually.'}
(root/'eye-seating-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
