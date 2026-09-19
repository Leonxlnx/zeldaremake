"""Check the retained character outside run, and the real Three.js draw cost."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
a=json.loads((root/'studio-before/manifest.json').read_text());b=json.loads((root/'studio-after/manifest.json').read_text())
assert a['complete'] and b['complete']
assert a['glb_sha256']=='2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4'
assert b['glb_sha256']=='3218b16423aa2c1f8cf4e03f8bb63c25c719f21a3bcef30bbf70800e0ff81c41'
same=[];changed=[]
for name,x in b['views'].items():
 eq=x['sha256']==a['views'][name]['sha256']
 if x['gait']!='run':assert eq,name
 (same if eq else changed).append(name)
assert len(same)==14 and len(changed)==4
for folder,report in [('studio-before',a),('studio-after',b)]:
 for name in changed:assert hashlib.sha256((root/folder/(name+'.png')).read_bytes()).hexdigest()==report['views'][name]['sha256']
for gait in ['walk','stairs']:assert a['motion_clearance'][gait]==b['motion_clearance'][gait]
assert a['render']==b['render']
r={'unchanged_images':same,'changed_images':changed,'unchanged_walk_and_stairs_clearance':True,'render':b['render'],'baseline_run_clearance':a['motion_clearance']['run'],'candidate_run_clearance':b['motion_clearance']['run'],'scope':'Studio Three.js GLB only, no world IK.'}
(root/'studio-comparison.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
