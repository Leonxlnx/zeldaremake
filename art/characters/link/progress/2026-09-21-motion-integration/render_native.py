"""One matched Blender CPU render; SCENE, GAIT, PHASE and VIEW may be supplied by MCP."""
import bpy, json
from pathlib import Path
from mathutils import Vector

out = Path(__file__).resolve().parent
s = bpy.data.scenes[globals().get('SCENE', 'Link | September20 natural run baseline')]
bpy.context.window.scene = s
s.render.fps = 24
r = next(o for o in s.objects if o.type == 'ARMATURE')
gait = globals().get('GAIT', 'idle')
phase = globals().get('PHASE', 0)
view = globals().get('VIEW', 'front')
strip = r.animation_data.nla_tracks[gait].strips[0]
r.animation_data.action = strip.action
r.animation_data.action_slot = strip.action_slot
for track in r.animation_data.nla_tracks:
    track.mute = True
frame = strip.action.frame_range[0] + phase * (strip.action.frame_range[1] - strip.action.frame_range[0])
s.frame_set(int(frame), subframe=frame-int(frame))
positions = {'front': (0, -3, .65), 'side': (3, 0, .65), 'threequarter': (2, -3, .7)}
s.camera.location = positions[view]
s.camera.rotation_euler = (Vector((0, 0, .60)) - s.camera.location).to_track_quat('-Z', 'Y').to_euler()
s.view_layers[0].update()
label = globals().get('LABEL', 'baseline')
file = out / f'{label}-{gait}-{phase:.2f}-{view}.png'
s.render.filepath = str(file)
bpy.ops.render.render(write_still=True)
print(json.dumps({'image': str(file), 'frame': frame, 'gait': gait, 'phase': phase, 'scene': s.name}))
