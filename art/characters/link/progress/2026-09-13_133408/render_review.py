"""Render one review view per MCP call; six calls complete a dated checkpoint.

One view stays below the addon's socket timeout. An incomplete matching checkpoint
resumes; a changed source/blend or a completed checkpoint starts a fresh directory.
"""
import bpy
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from mathutils import Vector

root = Path(bpy.data.filepath).parent
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x = 720
scene.render.resolution_y = 820
scene.render.resolution_percentage = 100
camera = scene.camera
camera.data.ortho_scale = 1.38
views = {
    '01-three-quarter': (1.7,-3.7,1.53),
    '02-front': (0,-4,1.25),
    '03-side': (4,-.10,1.25),
    '04-back': (1.4,4,1.5),
    '05-face': (.6,-3,1.25),
    '06-boots': (.7,-2,.55),
}
manifest = {'at': datetime.now(timezone.utc).isoformat(),
            'kind':'actual Blender renders, not game captures',
            'blend':str(bpy.data.filepath),
            'blend_sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
            'generator_sha256':hashlib.sha256((root/'build_link.py').read_bytes()).hexdigest(),
            'views':{}}
previous=sorted((root/'progress').glob('*/manifest.json'))
out=None
if previous:
    prior=json.loads(previous[-1].read_text())
    if (all(prior.get(k)==manifest[k] for k in ['blend_sha256','generator_sha256'])
            and set(prior['views']) < set(views)):
        manifest=prior;out=previous[-1].parent
if out is None:
    out=root/'progress'/datetime.now(timezone.utc).strftime('%Y-%m-%d_%H%M%S')
    out.mkdir(parents=True)
    (out/'build_link.py').write_bytes((root/'build_link.py').read_bytes())
    (out/'render_review.py').write_bytes(Path(__file__).read_bytes())
for name, location in views.items():
    if name in manifest['views']:
        continue
    target = (0,0,.995) if name == '05-face' else ((0,-.02,.18) if name == '06-boots' else (0,0,.585))
    camera.data.ortho_scale = .47 if name == '05-face' else (.43 if name == '06-boots' else 1.38)
    camera.location = location
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    manifest['views'][name] = {'position':location,'target':target,'ortho_scale':camera.data.ortho_scale,
        'sha256':hashlib.sha256((out/(name+'.png')).read_bytes()).hexdigest()}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    break
print('RENDER_CHECKPOINT',out)
