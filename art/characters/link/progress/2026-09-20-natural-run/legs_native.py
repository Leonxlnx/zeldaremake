"""Native leg alignment study; preserves the rig, skin weights, UVs and shape-key deltas."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

out = Path(__file__).resolve().parent
name = 'Link | September20 aligned legs'
assert name not in bpy.data.scenes, 'Inspect the existing candidate; do not deform twice'
source = bpy.data.scenes['Link | September20 natural run baseline']
scene = bpy.data.scenes.new(name)
scene.render.fps = 24
scene.world = source.world
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x, scene.render.resolution_y = 640, 760
scene.render.resolution_percentage = 100
copies = {}
for obj in source.objects:
    clone = obj.copy()
    if obj.type in ('MESH', 'ARMATURE', 'CAMERA'):
        clone.data = obj.data.copy()
    scene.collection.objects.link(clone)
    copies[obj] = clone
for obj, clone in copies.items():
    if obj.parent in copies:
        clone.parent = copies[obj.parent]
    for modifier in clone.modifiers:
        if modifier.type == 'ARMATURE':
            modifier.object = copies[modifier.object]
scene.camera = copies[source.camera]
body = next(o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
mesh = body.data

def fade(z, low, high):
    t = max(0, min(1, (z-low)/(high-low)))
    return 1-t*t*(3-2*t), -6*t*(1-t)/(high-low) if low < z < high else 0

rows, derivatives = [], {}
for vertex in mesh.vertices:
    x, y, z = vertex.co
    if z >= .40 or abs(x) >= .22:
        continue
    a, da = fade(z, .18, .40)
    b, db = fade(z, .08, .18)
    sign = 1 if x >= 0 else -1
    shift = sign * (.035*a + .010*b)
    derivatives[vertex.index] = sign * (.035*da + .010*db)
    new = x-shift
    assert new*x > 0, 'Leg correction crossed the midline'
    for key in mesh.shape_keys.key_blocks:
        key.data[vertex.index].co.x -= shift
    vertex.co.x = new
    rows.append({'before': [x, z, -y], 'after': [new, z, -y]})
normals = []
for loop in mesh.loops:
    n = mesh.corner_normals[loop.index].vector.copy()
    n.z += derivatives.get(loop.vertex_index, 0) * n.x
    normals.append(n.normalized())
mesh.normals_split_custom_set(normals)
mesh.update()
assert rows
(out/'legs-native.json').write_text(json.dumps(rows), encoding='utf-8')
bpy.context.window.scene = scene
bpy.data.libraries.write(str(out/'aligned-legs-study.blend'), {scene}, fake_user=True, compress=True)
print(json.dumps({'scene': name, 'changed_vertices': len(rows), 'height_and_depth_preserved': True}))
