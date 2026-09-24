"""ROOT ONLY: copied 35-degree finger study; no export or production write.

Requires scene 'Link | September24 run repair baseline' imported from exact
46dcbcc3 and CONFIRMED_SEEDS matching the previously inspected long fingers.
Reuses the September23 selection, curve, and native preservation checks.
"""
import ast, hashlib, importlib.util, inspect, json, math
from pathlib import Path

out = Path(__file__).resolve().parent
old = out.parent/'2026-09-23-hand-curl'
confirmed = {'L': [75512, 75592, 78323, 76365], 'R': [78136, 78015, 77299, 76829]}
assert globals().get('CONFIRMED_SEEDS') == confirmed, 'Root must confirm both native long-digit selections'

# Import before changing HERE: the existing GLB reader remains resolved beside
# the original preparation helper. Only the new output/source contract differs.
spec = importlib.util.spec_from_file_location('hand35_profile', old/'prepare.py')
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)
profile.SOURCE = '46dcbcc36490ee5c86f6d9eb28d58d1743f60cfab02bb0c899b8388b6eda3de0'
profile.ANGLE_DEG = 35
profile.HERE = out
code = inspect.getsource(profile.prepare)
old_source = "asset = HERE.parents[4]/'public/models/link/link-runtime.glb'"
assert code.count(old_source) == 1
exec(compile(code.replace(old_source, "asset = HERE/'baseline-46.glb'"),
             str(out/'hand_native.py')+' [pinned preparation]', 'exec'), vars(profile))
plan = profile.prepare()
assert plan['seeds'] == confirmed and plan['angleDeg'] == 35
assert plan['sourceSha256'] == profile.SOURCE
plan_path = out/'hand35-plan.json'

# Reuse the complete native mutation/check body. Every replacement is exact
# and fails closed if the original helper changes; no original file is edited.
source = old/'native.py'
original_code = source.read_text()
prefix, marker, code = original_code.partition('\nimport bpy\n')
assert marker and original_code.count('\nimport bpy\n') == 1
code = 'import bpy\n'+code
replacements = {
    "name = 'Link | September23 loose fingers study'": "name = 'Link | September24 relaxed hands35'",
    "out/('hand-curl-'+suffix)": "out/('hand35-'+suffix)",
    "bpy.data.scenes['Link | September22 chest posture both straps']": "bpy.data.scenes['Link | September24 run repair baseline']",
    "'Source native hand differs from7f'": "'Source native hand differs from46d'",
    'copied native18-degree distal-finger study': 'copied native35-degree distal-finger study',
}
for before, after in replacements.items():
    assert code.count(before) == 1, ('Original native helper changed', before)
    code = code.replace(before, after)
assert source.read_text() == original_code

import bpy
assert 'Link | September24 run repair baseline' in bpy.data.scenes
assert 'Link | September24 relaxed hands35' not in bpy.data.scenes
assert not plan_path.exists() and all(not (out/('hand35-'+suffix)).exists()
    for suffix in ('study.blend', 'native.json', 'native-rows.json')), 'Preserve prior native evidence'
with plan_path.open('x', encoding='utf-8') as stream:
    json.dump(plan, stream, separators=(',', ':'), allow_nan=False)
    stream.write('\n')
assert plan == json.loads(plan_path.read_text()), 'Stored preparation contract differs'
exec(compile(code, str(source)+' [35-degree study adapter]', 'exec'), globals())
