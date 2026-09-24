"""Run in Blender: four CC0-derived walk rotations, separate imported/copy scenes.

exec(compile(Path(PATH).read_text(), PATH, 'exec'), {'__file__': PATH})
Then export_candidate.py BASELINE_GLB walk-natural THIS_DIRECTORY. No production write.
"""
import bpy, hashlib, json, math
from pathlib import Path
from mathutils import Matrix, Vector

out = Path(__file__).resolve().parent
delivery = out / 'baseline-7f.glb'
source = Path('E:/zeldaremake/reference/animations/quaternius-standard/AnimationLibrary_Godot_Standard.gltf')
expected = {
    delivery: '7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda',
    source: '0ff075c7ad6855c5c2c37a171592ee8f0d6ab2f58259e2be77a9b63dd8027765',
    source.with_suffix('.bin'): '6e65377d81558333c4093dbb144a48fd19019343d82b1a3a7992a98ec0e0543c',
}
for file, digest in expected.items():
    assert hashlib.sha256(file.read_bytes()).hexdigest() == digest, str(file)
stem = 'walk-natural'
scene_name = 'Link | September24 natural walk'
source_name = 'Quaternius | September24 natural walk donor'
base_name = 'Link | September24 natural walk baseline'
carrier_name = 'Link | September24 natural walk carrier 240Hz'
assert all(n not in bpy.data.scenes for n in [scene_name, source_name, base_name, carrier_name])
assert all(not (out / (stem + suffix)).exists() for suffix in ['-study.blend', '-study.json', '-native.glb'])
mapping = {a+s: 'DEF-'+b+'.'+s for s in ['L', 'R']
           for a, b in [('shoulder', 'upper_arm'), ('elbow', 'forearm')]}
names = list(mapping)
paths = {'pose.bones["'+n+'"].rotation_quaternion' for n in names}
period, count = .55, 133
y = Vector((0, 1, 0))

def curves(action):
    return [f for layer in action.layers for st in layer.strips for bag in st.channelbags for f in bag.fcurves]

def fingerprint(action, protected=False):
    return [(f.data_path, f.array_index, [(tuple(k.co), tuple(k.handle_left), tuple(k.handle_right),
            k.interpolation, k.handle_left_type, k.handle_right_type) for k in f.keyframe_points])
            for f in curves(action) if not protected or f.data_path not in paths]

def activate(rig, action):
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    for track in rig.animation_data.nla_tracks:
        track.mute = True

def sample(scene, rig, frame):
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        scene.frame_set(int(frame), subframe=frame-int(frame))
        scene.view_layers[0].update()
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        er = rig.evaluated_get(dg)
        return {'object': er.matrix_world.copy(),
                'world': {b.name: er.matrix_world @ b.matrix for b in er.pose.bones},
                'basis': {b.name: (b.location.copy(), b.rotation_quaternion.copy(), b.scale.copy()) for b in er.pose.bones}}

def import_scene(name, file):
    scene = bpy.data.scenes.new(name)
    scene.render.fps, scene.render.fps_base = 24, 1
    bpy.context.window.scene = scene
    bpy.ops.import_scene.gltf(filepath=str(file))
    return scene, next(o for o in scene.objects if o.type == 'ARMATURE')

base, original_rig = import_scene(base_name, delivery)
original = original_rig.animation_data.nla_tracks['walk'].strips[0].action
original_fingerprint = fingerprint(original)
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = scene_name
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
baseline = rig.animation_data.nla_tracks['walk'].strips[0].action
assert fingerprint(baseline) == original_fingerprint
end = float(baseline.frame_range[1])
assert abs(baseline.frame_range[0]) < 1e-6 and abs(end/24-period) < 1e-6
activate(rig, baseline)

src, donor_rig = import_scene(source_name, source)
donor_original = donor_rig.animation_data.nla_tracks['Walk_Loop'].strips[0].action
donor_fingerprint = fingerprint(donor_original)
donor_action = donor_original.copy()
donor_action.name = 'Walk_Loop | hemisphere-safe donor'
# Preserve full orientation. Blender interpolates four scalar curves, so align signs first.
for data_path in sorted({f.data_path for f in curves(donor_action) if f.data_path.endswith('.rotation_quaternion')}):
    fs = sorted((f for f in curves(donor_action) if f.data_path == data_path), key=lambda f: f.array_index)
    assert [f.array_index for f in fs] == [0, 1, 2, 3]
    times = [k.co.x for k in fs[0].keyframe_points]
    assert all([k.co.x for k in f.keyframe_points] == times for f in fs)
    previous = None
    for i in range(len(times)):
        q = tuple(f.keyframe_points[i].co.y for f in fs)
        sign = -1 if previous is not None and sum(a*b for a, b in zip(previous, q)) < 0 else 1
        q = tuple(sign*v for v in q)
        for f, value in zip(fs, q):
            f.keyframe_points[i].co.y = value
            f.keyframe_points[i].interpolation = 'LINEAR'
        previous = q
    for f in fs:
        f.update()
activate(donor_rig, donor_action)
source_start, source_end = map(float, donor_action.frame_range)
assert abs((source_end-source_start)/24-4/3) < 1e-5

# Match the same-side thighs of retained locomotion to the donor. Never reuse the run offset.
# Blender world is Z up, -Y forward; both import object transforms are included above.
phase_samples = 128
traces = []
for sc, r, first, last, prefix in [(scene, rig, 0, end, ''), (src, donor_rig, source_start, source_end, 'DEF-')]:
    sides = [[], []]
    for i in range(phase_samples):
        pose = sample(sc, r, first+(last-first)*i/phase_samples)
        for j, side in enumerate(['L', 'R']):
            n = 'thigh'+side if not prefix else 'DEF-thigh.'+side
            axis = pose['world'][n].to_quaternion() @ y
            sides[j].append(math.atan2(-axis.y, -axis.z))
    for values in sides:
        mean = sum(values)/len(values)
        spread = math.sqrt(sum((v-mean)**2 for v in values))
        assert spread > 1e-6
        values[:] = [(v-mean)/spread for v in values]
    traces.append(sides)
correlations = [sum(traces[0][j][i]*traces[1][j][(i+k) % phase_samples]
                    for j in range(2) for i in range(phase_samples))/2 for k in range(phase_samples)]
offset = max(range(phase_samples), key=lambda k: correlations[k])/phase_samples

def rest_world(r, n):
    return (r.matrix_world @ r.data.bones[n].matrix_local).to_quaternion().normalized()

rs, rt = ({n: rest_world(r, lookup[n]) for n in names}
          for r, lookup in [(donor_rig, mapping), (rig, {n: n for n in names})])
source_chest_rest, target_chest_rest = rest_world(donor_rig, 'DEF-spine.003'), rest_world(rig, 'chest')
calibration = {n: rs[n].inverted() @ (rt[n] @ y).rotation_difference(rs[n] @ y) @ rt[n] for n in names}
snapshots = [(sample(scene, rig, end*i/(count-1)),
              sample(src, donor_rig, source_start+(source_end-source_start)*((i/(count-1)+offset) % 1)))
             for i in range(count)]
rows, max_axis_residual = [], 0.
# Transfer the reference's non-sinusoidal shoulder/elbow motion into this model's
# established bend plane. Its pack and sleeve weights cannot accept the donor's
# axial roll without new intersections. Wrist tracks remain the relaxed originals.
def desired_orientation(target, donor, n):
    correction = (target['world']['chest'].to_quaternion().normalized() @ target_chest_rest.inverted()
                  @ (donor['world']['DEF-spine.003'].to_quaternion().normalized() @ source_chest_rest.inverted()).inverted())
    rearward = Matrix.Rotation(math.radians(8 if n.startswith('shoulder') else 23), 4, 'X').to_quaternion()
    full = (rearward @ correction @ donor['world'][mapping[n]].to_quaternion().normalized() @ calibration[n]).normalized()
    axis, rest_axis = full @ y, rt[n] @ y
    angle = math.atan2(-rest_axis.y, -rest_axis.z) - math.atan2(-axis.y, -axis.z)
    # The right inner sleeve needs clearance; abducting the left pinches its strap seam.
    outward = Matrix.Rotation(math.radians(0 if n.endswith('L') else 2.5), 4, 'Y').to_quaternion()
    return (outward @ Matrix.Rotation(angle, 4, 'X').to_quaternion() @ rt[n]).normalized()
for target, donor in snapshots:
    row, actual_world = {}, {}
    inv_object = target['object'].inverted()
    for n in names:
        # Fit the adult donor's carriage to this short rig: the unadjusted transfer keeps
        # both wrists in front of the body. Preserve its cycle, with a modest rearward
        # shoulder centre and softer elbows; descendants inherit the same adjustment.
        uncentred = desired_orientation(target, donor, n)
        q_world = uncentred
        bone = rig.data.bones[n]
        parent = actual_world.get(bone.parent.name, target['world'][bone.parent.name])
        desired = Matrix.LocRotScale(target['world'][n].translation, q_world, target['world'][n].to_scale())
        local = bone.convert_local_to_pose(inv_object @ desired, bone.matrix_local,
                    parent_matrix=inv_object @ parent, parent_matrix_local=bone.parent.matrix_local, invert=True)
        q = local.to_quaternion().normalized()
        if rows and q.dot(rows[-1][n]) < 0:
            q.negate()
        loc, _, scale = target['basis'][n]
        actual = bone.convert_local_to_pose(Matrix.LocRotScale(loc, q, scale), bone.matrix_local,
                    parent_matrix=inv_object @ parent, parent_matrix_local=bone.parent.matrix_local)
        actual_world[n] = target['object'] @ actual
        max_axis_residual = max(max_axis_residual, (actual_world[n].to_quaternion().normalized() @ y-uncentred @ y).length)
        row[n] = q
    rows.append(row)
assert max_axis_residual < 3e-6, max_axis_residual
loop = max(abs(a-b) for n in names for a, b in zip(rows[0][n], rows[-1][n]))
assert loop < 1e-5, loop
rows[-1] = {n: rows[0][n].copy() for n in names}
action = baseline.copy()
action.name = 'walk | reference shoulder and elbow curves with sleeve clearance'
for layer in action.layers:
    for st in layer.strips:
        for bag in st.channelbags:
            for f in list(bag.fcurves):
                if f.data_path in paths:
                    bag.fcurves.remove(f)
bag = action.layers[0].strips[0].channelbag(action.slots[0])
for n in names:
    for axis in range(4):
        f = bag.fcurves.new('pose.bones["'+n+'"].rotation_quaternion', index=axis)
        f.keyframe_points.add(count)
        for i, row in enumerate(rows):
            f.keyframe_points[i].co = (end*i/(count-1), row[n][axis])
            f.keyframe_points[i].interpolation = 'LINEAR'
        f.update()
assert fingerprint(action, True) == fingerprint(baseline, True)
assert fingerprint(original) == original_fingerprint and fingerprint(donor_original) == donor_fingerprint
strip = rig.animation_data.nla_tracks['walk'].strips[0]
strip.action, strip.action_slot = action, action.slots[0]
activate(rig, action)
bpy.context.window.scene = scene
scene.frame_set(0)
bpy.data.libraries.write(str(out/(stem+'-study.blend')), {scene}, fake_user=True, compress=True)
report = {'scene': scene_name, 'source_sha256': expected[delivery], 'donor_sha256': expected[source],
          'donor_bin_sha256': expected[source.with_suffix('.bin')], 'donor_clip': 'Walk_Loop',
          'cycle_s': period, 'stride_m': .88, 'preserve_hips': True, 'gait': 'walk',
          'edited_bones': names, 'rotation_only_bones': names, 'phase_offset': offset,
          'same_side_thigh_phase_correlation': max(correlations), 'phase_search_samples': phase_samples,
          'method': 'Reference shoulder/elbow curves fitted to the existing arm bend plane; retained target chest and wrist tracks',
          'shoulder_rearward_degrees': 8, 'elbow_opening_degrees': 15,
          'outward_clearance_degrees': {'L': 0, 'R': 2.5},
          'wrist_tracks': 'Unchanged; hands inherit the moving forearms',
          'all_other_action_curves_exact': True, 'source_actions_unchanged': True,
          'max_unit_axis_residual': max_axis_residual, 'loop_component_error_before_exact_closure': loop,
          'rows': [{'phase': i/(count-1), 'rotations': {n: list(row[n]) for n in names}} for i, row in enumerate(rows)]}
(out/(stem+'-study.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')

# Existing carrier/append pipeline preserves the current mesh, all lower body and every other clip.
carrier = bpy.data.scenes.new(carrier_name)
carrier.render.fps, carrier.render.fps_base = 240, 1
crig = rig.copy()
crig.data = rig.data.copy()
crig.animation_data_clear()
carrier.collection.objects.link(crig)
crig.animation_data_create()
export_action = action.copy()
for f in curves(export_action):
    assert not f.modifiers
    data = [(float(k.co.x), float(k.co.y), k.interpolation) for k in f.keyframe_points]
    f.keyframe_points.clear()
    f.keyframe_points.add(len(data))
    for k, (x, value, interpolation) in zip(f.keyframe_points, data):
        k.co, k.interpolation = (round(x*10, 5), value), interpolation
    f.update()
track = crig.animation_data.nla_tracks.new()
track.name = 'walk'
export_strip = track.strips.new('walk', 0, export_action)
export_strip.action_slot = export_action.slots[0]
export_strip.action_frame_start, export_strip.action_frame_end, export_strip.frame_end = 0, 132, 132
track.mute = True
for bone in crig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
helper = out.parent/'2026-09-19-run-contact/export_native.py'
exec(compile(helper.read_text(encoding='utf-8'), str(helper), 'exec'),
     {'__file__': str(helper), 'JOB': {'scene': carrier_name, 'out': str(out), 'stem': stem, 'gait': 'walk'}})
bpy.context.window.scene = scene
print(json.dumps({k: v for k, v in report.items() if k != 'rows'}))
