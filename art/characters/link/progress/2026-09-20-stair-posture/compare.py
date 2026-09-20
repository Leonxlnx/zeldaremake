"""Compare the same actual-player stair path with the retained and upright clips."""
import json, math, sys
from pathlib import Path

root = Path(__file__).resolve().parent
before = json.loads((root.parent/'2026-09-20-run-arms/game-stairs/manifest.json').read_text())
after = json.loads(Path(sys.argv[1]).read_text())
assert before['complete'] and after['complete'] and before['errors'] == after['errors'] == []
for key in ['bundles', 'character_source_sha256', 'capture_script_sha256', 'render_profile']:
    assert before[key] == after[key], key
assert before['glb_sha256'] == '382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb'
assert after['glb_sha256'] == json.loads((root/'stairs-upright-export.json').read_text())['sha256']
assert len(before['samples']) == len(after['samples']) == 1320
for a,b in zip(before['samples'], after['samples']):
    assert (a['scenario'], a['frame']) == (b['scenario'], b['frame'])
    assert all(a['root'][k] == b['root'][k] for k in [0,2])

def metrics(manifest, scenario):
    rows = [r for r in manifest['samples'] if r['scenario'] == scenario]
    pelvis = [r['bodyPoints']['hips'][1] for r in rows]
    travel = 0
    for a,b in zip(rows, rows[1:]):
        for s in ['L','R']:
            x,y = [next(f for f in row['feet'] if f['foot']==s) for row in [a,b]]
            if not x['stance'] and not y['stance'] and x['minShoeGapM'] < .012 and y['minShoeGapM'] < .012:
                travel += math.hypot(x['soleX']-y['soleX'], x['soleZ']-y['soleZ'])
    return {**manifest['summary'][scenario], 'near_floor_unplanted_travel_m': travel,
        'max_knee_deg': max(r['legAngles'][s]['kneeFlexDeg'] for r in rows for s in ['L','R']),
        'max_hip_deg': max(r['legAngles'][s]['hipFlexDeg'] for r in rows for s in ['L','R']),
        'max_pelvis_step_m': max(abs(b-a) for a,b in zip(pelvis,pelvis[1:])),
        'max_pelvis_second_difference_m': max(abs(c-2*b+a) for a,b,c in zip(pelvis,pelvis[1:],pelvis[2:]))}

report = {s: {'before': metrics(before,s), 'after': metrics(after,s)} for s in ['stairs-up','stairs-down']}
for pair in report.values():
    a,b = pair['before'], pair['after']
    assert b['max_knee_deg'] < a['max_knee_deg']
    assert b['maxRootStepM'] < a['maxRootStepM'] + .001
    assert b['minRenderedStairGapM'] >= a['minRenderedStairGapM'] - .001
    assert b['reachClampedFrames'] == 0
print(json.dumps(report, indent=2))
(root/'comparison.json').write_text(json.dumps(report, indent=2))
