"""Import the exact delivered asset into a separate Blender study scene."""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector

out = Path(__file__).resolve().parent
asset = Path(globals().get('SOURCE_ASSET', out.parents[4] / 'public/models/link/link-runtime.glb'))
assert hashlib.sha256(asset.read_bytes()).hexdigest() == '382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb'
name = 'Link | September20 natural run baseline'
assert name not in bpy.data.scenes, 'Baseline already imported; inspect it instead of duplicating it'
scene = bpy.data.scenes.new(name)
bpy.context.window.scene = scene
bpy.ops.import_scene.gltf(filepath=str(asset))
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
# The importer used the new scene's default 24 fps when converting clip seconds to frames.
scene.render.fps = 24
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x = 640
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new(name + ' world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.16, .18, .21, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
for label, position, power, size in [('Key', (-2, -3, 3), 230, 3), ('Fill', (2, -1, 2), 90, 2), ('Rim', (0, 2, 3), 180, 2)]:
    light = bpy.data.lights.new(name + label, 'AREA')
    light.energy, light.shape, light.size = power, 'DISK', size
    obj = bpy.data.objects.new(light.name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, .65)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.objects.new(name + ' camera', bpy.data.cameras.new(name + ' camera'))
scene.collection.objects.link(camera)
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.5
camera.location = (0, -3, .7)
camera.rotation_euler = (Vector((0, 0, .65)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
scene.frame_set(0)
report = {'scene': name, 'rig': rig.name, 'objects': [{'name': o.name, 'type': o.type} for o in scene.objects],
          'tracks': [{'name': t.name, 'strips': [{'name': s.name, 'action': s.action.name, 'range': list(s.action.frame_range)} for s in t.strips]} for t in rig.animation_data.nla_tracks],
          'bones': [{'name': b.name, 'head': list(b.head_local), 'tail': list(b.tail_local)} for b in rig.data.bones]}
out.mkdir(parents=True, exist_ok=True)
(out / 'baseline.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.data.libraries.write(str(out / 'natural-run-baseline.blend'), {scene}, fake_user=True, compress=True)
print(json.dumps(report))
