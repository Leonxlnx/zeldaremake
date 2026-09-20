"""Verify matched image evidence and report the same-build gameplay comparison."""
import hashlib,json,math
from pathlib import Path
root=Path(__file__).resolve().parent
a,b=[json.loads((root/f/'manifest.json').read_text()) for f in ['studio-before','studio-after']]
assert a['complete'] and b['complete'] and a['errors']==b['errors']==[]
assert b['glb_sha256']==json.loads((root/'relaxed-run-boots.json').read_text())['sha256']
assert a['render']==b['render']
for name in ['01-body','06-boots','run-0','run-0.25','run-0.5','run-0.75']:
    for folder,d in [('studio-before',a),('studio-after',b)]:
        assert hashlib.sha256((root/folder/(name+'.png')).read_bytes()).hexdigest()==d['views'][name]['sha256']
    assert [a['views'][name][k] for k in ['gait','t','view']]==[b['views'][name][k] for k in ['gait','t','view']]
before,after=[json.loads((root/f/'manifest.json').read_text()) for f in ['game-before','game-after']]
assert before['complete'] and after['complete'] and before['errors']==after['errors']==[]
assert before['glb_sha256']==a['glb_sha256'] and after['glb_sha256']==b['glb_sha256']
assert before['bundles']==after['bundles'] and before['character_source_sha256']==after['character_source_sha256']
assert before['world_commit']==after['world_commit'] and before['render_profile']==after['render_profile']
assert len(before['samples'])==len(after['samples'])==300
assert all(x['root'][k]==y['root'][k] for x,y in zip(before['samples'],after['samples']) for k in [0,2])
def metrics(d):
    rows=d['samples'];skim=0;drift=0
    steady=[r for r in rows if 165<=r['frame']<235]
    for x,y in zip(steady,steady[1:]):
        for side in ['L','R']:
            a=next(f for f in x['feet'] if f['foot']==side);b=next(f for f in y['feet'] if f['foot']==side)
            distance=math.hypot(a['soleX']-b['soleX'],a['soleZ']-b['soleZ'])
            if a['stance'] and b['stance']:drift=max(drift,distance)
            if not a['stance'] and not b['stance'] and a['minShoeGapM']<.012 and b['minShoeGapM']<.012:skim+=distance
    return {**d['summary']['flat-transitions'],'steady_unplanted_near_floor_travel_m':skim,'steady_max_planted_drift_m':drift,
        'steady_max_root_step_m':max(abs(r['rootStepY'] or 0) for r in steady),
        'minimum_audited_shoe_gap_m':min(f['minShoeGapM'] for r in rows for f in r['feet'])}
report={'same_build_and_player_horizontal_path':True,'studio_render':b['render'],'before':metrics(before),'after':metrics(after),
    'scope':'Foot audit markers, not full mesh collision depth; steady run frames 165–234. Near-floor threshold 12 mm.'}
fixed=json.loads((root/'game-fixed/manifest.json').read_text())
assert fixed['complete'] and fixed['errors']==[] and fixed['glb_sha256']==after['glb_sha256']
assert fixed['character_source_sha256']!=after['character_source_sha256']
assert fixed['world_commit']==after['world_commit'] and fixed['render_profile']==after['render_profile']
assert len(fixed['samples'])==300
assert all(x['root'][k]==y['root'][k] for x,y in zip(after['samples'],fixed['samples']) for k in [0,2])
report['release_coordinate_fix']=metrics(fixed)
assert report['release_coordinate_fix']['maxRootStepM']<report['after']['maxRootStepM']
assert report['release_coordinate_fix']['reachClampedFrames']==0
(root/'comparison.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
