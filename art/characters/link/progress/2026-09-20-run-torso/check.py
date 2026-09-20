"""Verify native isolation and same-world gameplay evidence for the torso-only edit."""
import hashlib, json, math, struct
from pathlib import Path

root = Path(__file__).resolve().parent
study = json.loads((root/'run-torso-study.json').read_text())
export = json.loads((root/'run-torso-export.json').read_text())
raw = (root/'run-torso-native.glb').read_bytes()
carrier = json.loads(raw[20:20+struct.unpack_from('<I', raw, 12)[0]])
assert not carrier.get('meshes') and not carrier.get('images')
assert export['changed'] == [['chest','rotation'], ['head','rotation']]
assert study['protected_curves_exact'] and study['leg_matrix_error'] == 0
assert study['head_orientation_error'] < 1e-6
assert study['rows'][0]['chest_yaw_rad'] == study['rows'][-1]['chest_yaw_rad']
before = json.loads((root.parent/'2026-09-20-world-integration/game/manifest.json').read_text())
after = json.loads((root/'game/manifest.json').read_text())
assert before['complete'] and after['complete'] and before['errors'] == after['errors'] == []
assert before['glb_sha256'] == export['source_sha256'] and after['glb_sha256'] == export['sha256']
for key in ['bundles','character_source_sha256','capture_script_sha256','render_profile']:
    assert before[key] == after[key], key
a = [r for r in before['samples'] if r['scenario'] == 'flat-transitions']
b = after['samples']; assert len(a) == len(b) == 300
root_error = foot_error = angle_error = 0
for x,y in zip(a,b):
    assert x['frame'] == y['frame'] and x['gait'] == y['gait']
    root_error = max(root_error, math.dist(x['root'],y['root']))
    for left,right in zip(x['feet'],y['feet']):
        assert left['foot'] == right['foot'] and left['stance'] == right['stance']
        foot_error = max(foot_error, *(abs(left[k]-right[k]) for k in ['soleX','soleY','soleZ','minShoeGapM']))
    angle_error = max(angle_error, *(abs(x['legAngles'][s][k]-y['legAngles'][s][k])
        for s in ['L','R'] for k in ['hipFlexDeg','kneeFlexDeg']))
assert root_error < 1e-5 and foot_error < 1e-5 and angle_error < .001
assert after['summary']['flat-transitions']['reachClampedFrames'] == 0
video = after['video']; assert int(video['nb_read_frames']) == video['frames'] == 150
assert video['r_frame_rate'] == '30/1'
assert hashlib.sha256((root/'game'/video['file']).read_bytes()).hexdigest() == video['sha256']
report = {'frames':300,'max_root_difference_m':root_error,'max_foot_difference_m':foot_error,
    'max_leg_angle_difference_degrees':angle_error,'summary':after['summary'],'video':video}
(root/'comparison.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
