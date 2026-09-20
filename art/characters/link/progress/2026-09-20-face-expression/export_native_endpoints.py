"""Record the native eyelid endpoints used to verify the portable GLB rebase."""
import bpy, json
from pathlib import Path

s = bpy.data.scenes['Link | September19 run contact baseline']
b = next(o for o in s.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
k = b.data.shape_keys.key_blocks
xyz = lambda p: [p.x,p.z,-p.y]
rows = [{'base':xyz(v.co),'half':xyz(k['blinkHalf'].data[i].co),'closed':xyz(k['blink'].data[i].co)}
        for i,v in enumerate(k['Basis'].data) if (k['blinkHalf'].data[i].co-v.co).length > 1e-8]
assert len(rows) == 1099
(Path(__file__).resolve().parent/'native-endpoints.json').write_text(json.dumps(rows,separators=(',',':')),encoding='utf-8')
