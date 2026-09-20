"""Compare the complete native stair cycle and render matched mid-stance poses."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

out = Path(__file__).resolve().parent
candidate = json.loads((out/'stairs-upright-study.json').read_text())['scene']
results = {}
for label, name in [('before', 'Link | September19 run contact baseline'), ('after', candidate)]:
    scene = bpy.data.scenes[name]; bpy.context.window.scene = scene
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    strip = rig.animation_data.nla_tracks['stairs'].strips[0]
    old_action = rig.animation_data.action; old_frame = scene.frame_current
    rig.animation_data.action = strip.action; rig.animation_data.action_slot = strip.action.slots[0]
    rows = []
    try:
        rig.update_tag(); scene.frame_set(-1); scene.view_layers[0].update()
        for i in range(177):
            f = strip.action_frame_end*i/176
            scene.frame_set(int(f), subframe=f-int(f)); scene.view_layers[0].update()
            legs = {}
            for side in ['L', 'R']:
                h, k, a = [rig.pose.bones[j+side].head.copy() for j in ['thigh', 'knee', 'ankle']]
                legs[side] = {'ankle': list(a), 'knee_flex_deg': math.degrees((k-h).angle(a-k))}
            rows.append({'phase': i/176, 'hips': list(rig.pose.bones['hips'].head), 'legs': legs})
        scene.camera.data.type = 'ORTHO'; scene.camera.data.ortho_scale = 1.45
        scene.camera.location = (2.7, -2.0, 1.10)
        scene.camera.rotation_euler = (Vector((0,0,.59))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.resolution_x = 640; scene.render.resolution_y = 760
        scene.render.resolution_percentage = 100
        scene.cycles.device = 'CPU'; scene.cycles.samples = 16
        scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
        for phase in [.125, .25]:
            f = phase*strip.action_frame_end
            scene.frame_set(int(f), subframe=f-int(f)); scene.view_layers[0].update()
            scene.render.filepath = str(out/f'stairs-{phase}-{label}.png')
            bpy.ops.render.render(write_still=True)
    finally:
        rig.animation_data.action = old_action
        if old_action: rig.animation_data.action_slot = old_action.slots[0]
        scene.frame_set(old_frame)
    results[label] = rows
error = max(math.dist(a['legs'][s]['ankle'], b['legs'][s]['ankle'])
            for a,b in zip(results['before'],results['after']) for s in ['L','R'])
assert error < 1e-6, error
report = {'ankle_path_error_m': error, 'rows': results,
          'max_native_knee': {label: max(r['legs'][s]['knee_flex_deg'] for r in rows for s in ['L','R'])
                              for label,rows in results.items()}}
(out/'native-review.json').write_text(json.dumps(report, separators=(',',':')))
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
