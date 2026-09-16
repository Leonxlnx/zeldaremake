"""Measure hip-relative hand motion and require unchanged locomotion records."""
import json,math,sys,copy
from pathlib import Path
data=[json.loads(Path(p).read_text()) for p in sys.argv[1:3]]
assert len(data)==2 and all(d['complete'] and not d['errors'] and len(d['samples'])==300 for d in data)
for a,b in zip(*(d['samples'] for d in data)):
 a,b=copy.deepcopy(a),copy.deepcopy(b)
 for row in [a,b]:
  for side in ['L','R']:del row['bodyPoints']['hand'+side]
 assert a==b,('Non-arm game state changed',a['frame'])
reports=[]
for d in data:
 report={}
 for label,lo,hi in [('walk',2,119),('start_run',120,139),('run',140,239),('stop',241,270)]:
  report[label]={}
  for side in ['L','R']:
   points=[[r['bodyPoints']['hand'+side][j]-r['bodyPoints']['hips'][j] for j in range(3)] for r in d['samples']]
   steps=[math.dist(points[i],points[i-1])*1000 for i in range(lo,hi+1)]
   second=[math.sqrt(sum((points[i][j]-2*points[i-1][j]+points[i-2][j])**2 for j in range(3)))*1000 for i in range(lo,hi+1)]
   assert all(map(math.isfinite,steps+second))
   report[label][side]={'max_step_mm':max(steps),'p95_step_mm':sorted(steps)[int(.95*(len(steps)-1))],'max_second_difference_mm':max(second)}
 reports.append(report)
print(json.dumps({'scope':'300 actual game frames at 60Hz; hands relative to hips. Lower step size alone does not establish natural motion.','nonarm_gameplay_exact':True,'before':reports[0],'after':reports[1]},indent=2))
