"""Lift the pelvis at stair mid-stance while preserving both authored ankle paths."""
import ast, bpy, json, math
from pathlib import Path
from mathutils import Matrix, Vector

out = Path(__file__).resolve().parent
root = out.parents[1]
source = root / 'experiments/2026-09-13/source-runtime/cc0-arm-narrow-study.blend'
with bpy.data.libraries.load(str(source), link=False) as (_, loaded):
    loaded.scenes = ['Link | narrow CC0 arm study']
scene = loaded.scenes[0]
scene.name = 'Link | September20 upright stair stance'
bpy.context.window.scene = scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
data = rig.data
solver = root / 'rig_runtime.py'
tree = ast.parse(solver.read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef)
    and n.name in {'orient_bone', 'solve_leg'}], type_ignores=[]), str(solver), 'exec'))
track = rig.animation_data.nla_tracks['stairs']
old = track.strips[0].action
assert all(t.mute for t in rig.animation_data.nla_tracks)
frames, fps = 176, 240
factor = frames / track.strips[0].action_frame_end
edited = {'hips'} | {j+s for j in ['thigh', 'knee', 'ankle'] for s in ['L', 'R']}
rig.animation_data.action = old
rig.animation_data.action_slot = old.slots[0]
rig.update_tag(); scene.frame_set(-1); scene.view_layers[0].update()
samples = []
for f in range(frames+1):
    native = f / factor
    scene.frame_set(int(native), subframe=native-int(native)); scene.view_layers[0].update()
    sample = {'hips': rig.pose.bones['hips'].matrix.copy(), 'feet': {}}
    for side in ['L', 'R']:
        ankle = rig.pose.bones['ankle'+side]
        rot = (ankle.matrix.to_3x3() @ data.bones['ankle'+side].matrix_local.to_3x3().inverted()).to_euler()
        assert abs(rot.y) < 1e-4 and abs(rot.z) < 1e-4
        sample['feet'][side] = (ankle.head.copy(), rot.x)
    samples.append(sample)
action = old.copy(); action.name = 'stairs | upright mid-stance September20'
for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in list(bag.fcurves):
                name = curve.data_path.split('"')[1]
                if name in edited and (name != 'hips' or curve.data_path.endswith('.location')):
                    bag.fcurves.remove(curve)
                else:
                    for key in curve.keyframe_points:
                        key.co.x *= factor; key.handle_left.x *= factor; key.handle_right.x *= factor
rig.animation_data.action = action; rig.animation_data.action_slot = action.slots[0]
scene.render.fps = fps
ends, rows = [], []
error = 0
for f, sample in enumerate(samples):
    scene.frame_set(f); scene.view_layers[0].update()
    lift = .04 * math.sin(math.tau*f/frames)**2
    m = sample['hips'].copy(); m.translation.z += lift
    rig.pose.bones['hips'].matrix = m; scene.view_layers[0].update()
    for side, (target, pitch) in sample['feet'].items():
        error = max(error, solve_leg(side, target, pitch))
    rig.pose.bones['hips'].keyframe_insert('location', frame=f, group='hips')
    for name in edited - {'hips'}:
        for prop in ['location', 'rotation_quaternion', 'scale']:
            rig.pose.bones[name].keyframe_insert(prop, frame=f, group=name)
    rows.append({'frame': f, 'lift_m': lift})
    if f in [0, frames]:
        ends.append({n: [v for row in rig.pose.bones[n].matrix for v in row] for n in edited})
loop = max(abs(a-b) for n in edited for a,b in zip(ends[0][n], ends[1][n]))
assert loop < 1e-5, loop
for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in bag.fcurves:
                for key in curve.keyframe_points: key.interpolation = 'LINEAR'
rig.animation_data.action = None
strip = track.strips[0]; strip.action = action; strip.action_slot = action.slots[0]
strip.action_frame_end = frames; strip.frame_end = frames
for b in rig.pose.bones: b.matrix_basis = Matrix.Identity(4)
scene.frame_set(0)
stem = 'stairs-upright'
bpy.data.libraries.write(str(out/(stem+'-study.blend')), {scene}, fake_user=True, compress=True)
report = {'scene': scene.name, 'gait': 'stairs', 'cycle_s': frames/fps,
    'source_sha256': '382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb',
    'stride_m': .8066667, 'preserve_hips': False, 'edited_bones': sorted(edited),
    'lift_peak_m': .04, 'bone_error_m': error, 'loop_error': loop,
    'ankle_targets_preserved': True, 'status': 'Native study; runtime acceptance pending', 'rows': rows}
(out/(stem+'-study.json')).write_text(json.dumps(report, indent=2))
print(json.dumps({k:v for k,v in report.items() if k != 'rows'}))
