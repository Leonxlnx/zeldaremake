"""Check the actual Three.js pair, preserved motion, and unchanged closed-lid silhouette."""
import hashlib, json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parent
a,b = [json.loads((root/folder/'manifest.json').read_text(encoding='utf-8')) for folder in ['studio-before','studio-after']]
assert a['complete'] and b['complete'] and not a['errors'] and not b['errors']
assert a['glb_sha256'] == '2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4'
assert b['glb_sha256'] == json.loads((root/'combined-export.json').read_text())['sha256']
assert a['render'] == b['render'] and a['motion_clearance'] == b['motion_clearance']
rows = []
for name in ['blink-0','blink-0.25','blink-0.5','blink-0.75','blink-1','05-face','04-back','06-boots']:
    paths = [root/folder/(name+'.png') for folder in ['studio-before','studio-after']]
    for p,manifest in zip(paths,[a,b]):
        entry = manifest['blink_views' if name.startswith('blink') else 'views'][name]
        assert hashlib.sha256(p.read_bytes()).hexdigest() == entry['sha256']
    diff = ImageChops.difference(Image.open(paths[0]).convert('RGB'),Image.open(paths[1]).convert('RGB'))
    r,g,bands = diff.split()
    histogram = ImageChops.lighter(ImageChops.lighter(r,g),bands).histogram()
    changed = sum(histogram[1:])
    if name in ['04-back','06-boots']: assert changed == 0
    if name == 'blink-1': assert changed <= 4, 'Closed-lid appearance regressed'
    rows.append({'view':name,'max_channel_delta':max(hi for lo,hi in diff.getextrema()),
        'mean_channel_delta':sum(ImageStat.Stat(diff).mean)/3,'pixels_changed':changed})
report = {'complete':True,'errors':[],'render':b['render'],'all_gait_clearance_exact':True,'image_differences':rows}
(root/'runtime-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))

before,after = [json.loads((root/folder/'manifest.json').read_text(encoding='utf-8')) for folder in ['game-before','game-after']]
assert before['complete'] and after['complete'] and before['errors'] == after['errors'] == []
for key in ['samples','summary','bundles','character_source_sha256','capture_script_sha256','render_profile','blinkCloseup']:
    assert before[key] == after[key], key
assert len(after['samples']) == 12 and len(after['blinkCloseup']) == 5
assert before['glb_sha256'] == a['glb_sha256'] and after['glb_sha256'] == b['glb_sha256']
print('Actual high-default world: 12 exact movement samples, five exact blink times and weight sets.')
