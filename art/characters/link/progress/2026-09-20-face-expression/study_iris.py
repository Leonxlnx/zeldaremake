"""Native eye-UV study; reuse the existing iris texture, geometry and blink shapes."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

out = Path(__file__).resolve().parent
job = globals().get('JOB', {})
s = bpy.data.scenes['Link | September19 run contact baseline']
bpy.context.window.scene = s
body = next(o for o in s.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
keys = body.data.shape_keys.key_blocks
saved_keys = {k.name:k.value for k in keys}
eyes = [o for o in s.objects if o.type == 'MESH' and 'anatomical eye' in o.name]
assert len(eyes) == 2
originals = [o.data for o in eyes]
candidates = [m.copy() for m in originals]
rig = next(o for o in s.objects if o.type == 'ARMATURE')
pose = rig.data.pose_position
camera = s.camera
matrix, scale = camera.matrix_world.copy(), camera.data.ortho_scale
resolution = (s.render.resolution_x, s.render.resolution_y)
rows = []

def remap(uv, factor):
    delta = uv - Vector((.25, .5))
    radius = math.hypot(delta.x / .12, delta.y / .24)
    t = min(1., max(0., radius - 1.))
    weight = 1 - t*t*(3-2*t)
    return uv + delta * ((factor-1)*weight)

try:
    rig.data.pose_position = 'REST'
    s.cycles.device = 'CPU'; s.cycles.samples = 24
    s.render.threads_mode = 'FIXED'; s.render.threads = 4
    s.render.resolution_x = 720; s.render.resolution_y = 820
    focus = Vector((0, -.025, .97))
    for view, offset in [('front', (0,-3,.04)), ('three-quarter', (1.6,-3,.06))]:
        camera.location = focus + Vector(offset)
        camera.rotation_euler = (focus-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale = .42
        for factor in job.get('factors', [1., 1.14, 1.25]):
            keys['blinkHalf'].value = job.get('rest_half', 0.)
            for eye, original, candidate in zip(eyes, originals, candidates):
                for src, dst in zip(original.uv_layers.active.data, candidate.uv_layers.active.data):
                    dst.uv = remap(src.uv, factor)
                    assert all(-1e-6 <= x <= 1.000001 for x in dst.uv)
                assert all(a.co == b.co for a,b in zip(original.vertices,candidate.vertices))
                eye.data = original if factor == 1 else candidate
                eye.data.update()
            bpy.context.view_layer.update()
            name = f'{view}-{job.get("prefix", "iris")}-{factor:.2f}.png'
            s.render.filepath = str(out/name); bpy.ops.render.render(write_still=True)
            rows.append({'view':view, 'uv_scale':factor, 'file':name})
    for eye,candidate in zip(eyes,candidates): eye.data = candidate
    bpy.data.libraries.write(str(out/(job.get('prefix','iris-scale')+'-study.blend')), {s}, fake_user=True, compress=True)
    (out/(job.get('prefix','iris')+'-study.json')).write_text(json.dumps({'scope':'Existing iris UVs and optional resting blinkHalf influence only; no default asset changes. Native review only.', 'job':job, 'views':rows}, indent=2), encoding='utf-8')
finally:
    for name,value in saved_keys.items(): keys[name].value = value
    for eye,original in zip(eyes,originals): eye.data = original
    rig.data.pose_position = pose
    camera.matrix_world = matrix; camera.data.ortho_scale = scale
    s.render.resolution_x, s.render.resolution_y = resolution
    bpy.context.view_layer.update()
