"""Compare actual-player stair traces; retain regressions alongside improvements."""
import json,math,sys
from pathlib import Path

a,b=[json.loads(Path(p).read_text(encoding='utf-8')) for p in sys.argv[1:3]]
assert a['complete'] and b['complete']
for key in ['world_commit','bundles','character_source_sha256','capture_script_sha256','render_profile']:
    assert a[key]==b[key],('Mismatched comparison',key)
assert len(a['samples'])==len(b['samples'])==1320
assert all(x['scenario']==y['scenario'] and x['frame']==y['frame'] for x,y in zip(a['samples'],b['samples']))
assert all(abs(x['root'][k]-y['root'][k])<1e-9 for x,y in zip(a['samples'],b['samples']) for k in [0,2]),'Player path changed'

def metrics(report,scenario):
    rows=[r for r in report['samples'] if r['scenario']==scenario]
    drift=[];skim=[]
    for side in ['L','R']:
        for prev,cur in zip(rows,rows[1:]):
            x=next(f for f in prev['feet'] if f['foot']==side);y=next(f for f in cur['feet'] if f['foot']==side)
            d=math.hypot(x['soleX']-y['soleX'],x['soleZ']-y['soleZ'])
            if x['stance'] and y['stance']:drift.append(d)
            if x['minShoeGapM']<.012 and y['minShoeGapM']<.012 and not x['stance'] and not y['stance']:skim.append(d)
    return {**report['summary'][scenario],
        'max_hip_step_m':max(abs(x['bodyPoints']['hips'][1]-y['bodyPoints']['hips'][1]) for x,y in zip(rows,rows[1:])),
        'max_planted_drift_m_per_frame':max(drift,default=0),
        'near_floor_unplanted_travel_m':sum(skim),'near_floor_unplanted_intervals':len(skim),
        'min_audited_shoe_gap_m':min(f['minShoeGapM'] for r in rows for f in r['feet'])}

result={'scope':'1320 matched actual-player frames at 60 Hz. Raycasts sample four skinned sole vertices per foot every ten frames, not complete mesh collision. Near-floor movement uses adjacent unplanted audit markers below12mm and is summed over the whole trace, not per step.',
    'player_horizontal_travel_exact':True,'baseline_asset':a['glb_sha256'],'candidate_asset':b['glb_sha256'],
    'scenarios':{s:{'baseline':metrics(a,s),'candidate':metrics(b,s)} for s in ['stairs-up','stairs-down']}}
Path(__file__).with_name('comparison.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
