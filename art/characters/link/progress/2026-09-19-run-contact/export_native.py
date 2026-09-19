"""Export a native animation carrier; the patcher selects reviewed leg channels."""
import bpy,json,struct
from pathlib import Path
job=globals().get('JOB',{});stem=job.get('stem','run-contact-low')
out=Path(job.get('out',Path(__file__).resolve().parent))
scene=bpy.data.scenes[job.get('scene','Link | September19 low flight run')];bpy.context.window.scene=scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
assert rig.animation_data.action is None and all(t.mute for t in rig.animation_data.nla_tracks)
scene.frame_set(0);bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
bpy.context.view_layer.objects.active=rig
target=out/(stem+'-native.glb')
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,
 export_cameras=False,export_lights=False,export_animations=True,export_animation_mode='NLA_TRACKS',
 export_force_sampling=True,export_frame_step=1,export_frame_range=False,export_rest_position_armature=True,
 export_yup=True,export_extras=False,export_def_bones=True)
raw=target.read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
assert any(a['name']==job.get('gait','run') for a in doc['animations'])
assert {b+s for b in ['thigh','knee','ankle'] for s in ['L','R']} <= {n.get('name') for n in doc['nodes']}
print(json.dumps({'file':str(target),'bytes':len(raw),'clips':[a['name'] for a in doc['animations']]}))
