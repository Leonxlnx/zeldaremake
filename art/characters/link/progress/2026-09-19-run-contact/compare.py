"""Compare matched 300-frame player traces; report improvements and regressions separately."""
import json,math,sys
from pathlib import Path
a,b=[json.loads(Path(p).read_text()) for p in sys.argv[1:3]]
assert a['complete'] and b['complete'] and a['world_commit']==b['world_commit']
assert len(a['samples'])==len(b['samples'])==300
def metrics(report):
 rows=report['samples'];steady=[r for r in rows if 165<=r['frame']<235]
 drift=[];skim=[]
 for side in ['L','R']:
  for prev,cur in zip(steady,steady[1:]):
   x=next(f for f in prev['feet'] if f['foot']==side);y=next(f for f in cur['feet'] if f['foot']==side)
   d=math.hypot(x['soleX']-y['soleX'],x['soleZ']-y['soleZ'])
   if x['stance'] and y['stance']:drift.append(d)
   if x['minShoeGapM']<.012 and y['minShoeGapM']<.012 and not x['stance'] and not y['stance']:skim.append(d)
 return {'run_contract':next(c for c in report['setup']['character']['linkAsset']['clips'] if c['name']=='run'),
  'steady_planted_max_drift_m_per_frame':max(drift,default=0),'steady_planted_samples':len(drift),
  'steady_near_floor_unplanted_travel_m':sum(skim),'steady_near_floor_unplanted_frames':len(skim),
  'max_root_step_m':max(abs(r['rootStepY'] or 0) for r in rows),
  'max_hip_step_m':max(abs(x['bodyPoints']['hips'][1]-y['bodyPoints']['hips'][1]) for x,y in zip(rows,rows[1:])),
  'minimum_audited_shoe_gap_m':min(f['minShoeGapM'] for r in rows for f in r['feet']),
  'reach_clamped_frames':sum(bool(r['ik']['reachClamped']) for r in rows)}
assert all(x['bodyPoints']==y['bodyPoints'] and x['feet']==y['feet'] for x,y in zip(a['samples'][:120],b['samples'][:120])),'Walk changed before transition'
assert all(abs(x['root'][i]-y['root'][i])<1e-9 for x,y in zip(a['samples'],b['samples']) for i in [0,2]),'Player travel changed'
result={'scope':'Same build base, actual player and IK at fixed 60 Hz. Foot audit markers, not full skinned-mesh collision proof. Steady run frames165–234; near-floor means both adjacent minShoeGapM <12mm and not planted.',
 'baseline':metrics(a),'candidate':metrics(b),'walk_before_transition_exact':True,'player_horizontal_travel_exact':True}
Path(__file__).with_name('comparison.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
