"""Rebase authored eyelids and eye UVs; preserve all original asset bytes and blink endpoints."""
import copy, hashlib, json, math, struct, sys
from pathlib import Path

out = Path(__file__).resolve().parent
raw = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(raw).hexdigest() == '2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4'
n = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+n]); original = copy.deepcopy(doc)
binary = bytearray(raw[28+n:28+n+doc['buffers'][0]['byteLength']]); prefix = bytes(binary)

def values(index):
    # Same dense/sparse accessor handling as experiments/2026-09-13/check_hand_bake.py.
    a = doc['accessors'][index]
    assert a['componentType'] == 5126
    size = {'VEC2':2, 'VEC3':3}[a['type']]
    rows = [(0.,)*size for _ in range(a['count'])]
    if 'bufferView' in a:
        v = doc['bufferViews'][a['bufferView']]
        rows = [struct.unpack_from('<'+'f'*size, binary, v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',size*4)) for i in range(a['count'])]
    if 'sparse' in a:
        sparse = a['sparse']; ids = sparse['indices']; patch = sparse['values']
        fmt = '<'+{5121:'B',5123:'H',5125:'I'}[ids['componentType']]
        start = doc['bufferViews'][ids['bufferView']].get('byteOffset',0)+ids.get('byteOffset',0)
        data = doc['bufferViews'][patch['bufferView']].get('byteOffset',0)+patch.get('byteOffset',0)
        for i in range(sparse['count']):
            at = struct.unpack_from(fmt,binary,start+i*struct.calcsize(fmt))[0]
            assert at < len(rows)
            rows[at] = struct.unpack_from('<'+'f'*size,binary,data+i*size*4)
    return rows

def append(rows):
    assert rows and all(math.isfinite(x) for row in rows for x in row)
    binary.extend(b'\0' * (-len(binary)%4)); offset = len(binary)
    for row in rows: binary.extend(struct.pack('<'+'f'*len(row), *row))
    vi = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset,'target':34962})
    ai = len(doc['accessors'])
    doc['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(rows),'type':'VEC'+str(len(rows[0])),
        'min':[min(row[k] for row in rows) for k in range(len(rows[0]))],
        'max':[max(row[k] for row in rows) for k in range(len(rows[0]))]})
    return ai

changes = []; closure_error = 0.
native = {tuple(round(x,6) for x in row['base']):row for row in json.loads((out/'native-endpoints.json').read_text(encoding='utf-8'))}
native_error = 0.; native_matches = 0
for mesh in doc['meshes']:
    names = mesh.get('extras',{}).get('targetNames',[])
    if not names: continue
    assert names == ['blink','blinkHalf']
    for p in mesh['primitives']:
        if not any(any(x != 0 for x in row) for row in values(p['targets'][1]['POSITION'])): continue
        for base,half,closed in zip(values(p['attributes']['POSITION']),values(p['targets'][1]['POSITION']),values(p['targets'][0]['POSITION'])):
            if not any(half): continue
            row = native[tuple(round(x,6) for x in base)]
            native_matches += 1
            native_error = max(native_error,*(abs(a+b-c) for endpoint,delta in [('half',half),('closed',closed)] for a,b,c in zip(base,delta,row[endpoint])))
        assert native_error < 1e-7, 'Native Blender and GLB eyelid endpoints differ'
        for attr in ['POSITION','NORMAL']:
            before = values(p['attributes'][attr]); half = values(p['targets'][1][attr])
            if not any(any(x != 0 for x in row) for row in half): continue
            after = [tuple(x+.32*y for x,y in zip(a,h)) for a,h in zip(before,half)]
            if attr == 'NORMAL':
                after = [tuple(x/math.sqrt(sum(y*y for y in row)) for x in row) if any(h) else a for row,h,a in zip(after,half,before)]
            index = append(after); after = values(index) # Verify serialized float32, not Python doubles.
            p['attributes'][attr] = index
            for target in p['targets']:
                old_delta = values(target[attr])
                target[attr] = append([tuple(x+d-y for x,d,y in zip(a,delta,b)) for a,delta,b in zip(before,old_delta,after)])
                new_delta = values(target[attr])
                error = max(abs(x+d-y-e) for a,d0,b,d1 in zip(before,old_delta,after,new_delta) for x,d,y,e in zip(a,d0,b,d1))
                closure_error = max(closure_error,error)
                assert error < 1e-7, (attr,error)
            changes.append({'attribute':attr,'changed_vertices':sum(a!=b for a,b in zip(before,after))})

# The UV field is the native study's compact ellipse, with the glTF V flip about .5.
for mesh in doc['meshes'][:2]:
    assert mesh['name'].startswith('Sphere.') and len(mesh['primitives']) == 1
    p = mesh['primitives'][0]; before = values(p['attributes']['TEXCOORD_0']); after = []
    for u,v in before:
        du,dv = u-.25,v-.5
        radius = math.hypot(du/.12,dv/.24); t = min(1.,max(0.,radius-1.))
        weight = 1-t*t*(3-2*t)
        after.append((u+du*.14*weight,v+dv*.14*weight))
    assert all(-1e-6<=x<=1.000001 for row in after for x in row)
    p['attributes']['TEXCOORD_0'] = append(after)

assert changes and bytes(binary[:len(prefix)]) == prefix
check = copy.deepcopy(doc)
for field in ['meshes','accessors','bufferViews']: check[field] = original[field]
assert check == original, 'Unexpected document change'
for old_mesh,new_mesh in zip(original['meshes'],doc['meshes']):
    for a,b in zip(old_mesh['primitives'],new_mesh['primitives']):
        assert a['indices'] == b['indices'] and a['material'] == b['material']
        for attr in a['attributes']:
            if attr not in ['POSITION','NORMAL','TEXCOORD_0']: assert a['attributes'][attr] == b['attributes'][attr]
doc['buffers'][0]['byteLength'] = len(binary)
j = json.dumps(doc,separators=(',',':')).encode(); j += b' '*(-len(j)%4)
result = struct.pack('<4sIII4s',b'glTF',2,28+len(j)+len(binary),len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(out/'combined-candidate.glb').write_bytes(result)
report = {'sha256':hashlib.sha256(result).hexdigest(),'rest_half':.32,'iris_uv_scale':1.14,'changes':changes,
    'native_endpoint_matches':native_matches,'native_endpoint_max_error':native_error,
    'original_binary_preserved':True,'clips_rig_weights_textures_materials_indices_unchanged':True,
    'half_and_closed_endpoint_max_error':closure_error,'status':'Candidate only; native and runtime visual review required.'}
(out/'combined-export.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
