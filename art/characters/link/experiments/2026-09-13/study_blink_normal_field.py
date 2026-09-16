"""Diagnostic: smooth only animated orbital normals, preserving geometry and rest shading."""
import ast, json, struct, math, hashlib
from pathlib import Path

root = Path(__file__).resolve().parent / 'source-runtime'
helper = Path(__file__).with_name('check_hand_bake.py')
tree = ast.parse(helper.read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('load', 'values')], type_ignores=[]), str(helper), 'exec'))
model = load('alert-eyelid')
raw, doc, offset = model
binary = bytearray(raw[offset:offset + doc['buffers'][0]['byteLength']])
report = []

def unit(v):
    length = math.sqrt(sum(x*x for x in v))
    assert length > 1e-8
    return tuple(x/length for x in v)

for mesh in doc['meshes']:
    for primitive in mesh['primitives']:
        if primitive['material'] != 2:
            continue
        assert mesh['extras']['targetNames'] == ['blink', 'blinkHalf']
        normals = values(model, primitive['attributes']['NORMAL'])
        indices = [x[0] for x in values(model, primitive['indices'])]
        neighbors = [set() for _ in normals]
        for start in range(0, len(indices), 3):
            triangle = indices[start:start+3]
            for i in triangle:
                neighbors[i].update(j for j in triangle if j != i)
        for target in primitive['targets']:
            original = values(model, target['NORMAL'])
            move = values(model, target['POSITION'])
            weights = [min(1, math.sqrt(sum(x*x for x in v))/.004) for v in move]
            field = [unit(tuple(a+b for a,b in zip(n,d))) for n,d in zip(normals,original)]
            before = list(field)
            for _ in range(12):
                updated = list(field)
                for i, weight in enumerate(weights):
                    if weight <= 1e-5 or not neighbors[i]:
                        continue
                    average = unit(tuple(sum(field[j][k] for j in neighbors[i])/len(neighbors[i]) for k in range(3)))
                    updated[i] = unit(tuple((1-.5*weight)*a+.5*weight*b for a,b in zip(field[i],average)))
                field = updated
            delta = [tuple(a-b for a,b in zip(n,base)) if w>1e-5 else old for n,base,w,old in zip(field,normals,weights,original)]
            angles = [math.degrees(math.acos(max(-1,min(1,sum(a*b for a,b in zip(u,v)))))) for u,v in zip(before,field)]
            while len(binary)%4: binary.append(0)
            start = len(binary)
            for v in delta: binary.extend(struct.pack('<3f',*v))
            view = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(delta)*12})
            target['NORMAL'] = len(doc['accessors'])
            doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(delta),'type':'VEC3'})
            report.append({'vertices':sum(w>1e-5 for w in weights),'maximum_normal_rotation_degrees':max(angles)})
doc['buffers'][0]['byteLength'] = len(binary)
encoded = json.dumps(doc,separators=(',',':')).encode()
encoded += b' '*((-len(encoded))%4)
binary.extend(b'\0'*((-len(binary))%4))
result = struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary
path = root/'blink-normal-field-candidate.glb'
path.write_bytes(result)
checked=load('blink-normal-field')
original_model=load('alert-eyelid')
assert checked[0][checked[2]:checked[2]+original_model[1]['buffers'][0]['byteLength']] == original_model[0][original_model[2]:original_model[2]+original_model[1]['buffers'][0]['byteLength']]
comparison=json.loads(json.dumps(checked[1]))
for old_mesh,new_mesh in zip(original_model[1]['meshes'],comparison['meshes']):
    for old_primitive,new_primitive in zip(old_mesh['primitives'],new_mesh['primitives']):
        for old_target,new_target in zip(old_primitive.get('targets',[]),new_primitive.get('targets',[])):
            new_target['NORMAL']=old_target['NORMAL']
comparison['accessors']=comparison['accessors'][:len(original_model[1]['accessors'])]
comparison['bufferViews']=comparison['bufferViews'][:len(original_model[1]['bufferViews'])]
comparison['buffers']=original_model[1]['buffers']
assert comparison == original_model[1], 'Unexpected change outside morph normal accessors'
for a,b in zip(model[1]['meshes'],checked[1]['meshes']):
    for p,q in zip(a['primitives'],b['primitives']):
        for attribute in p['attributes']: assert values(model,p['attributes'][attribute]) == values(checked,q['attributes'][attribute])
        for t,u in zip(p.get('targets',[]),q.get('targets',[])): assert values(model,t['POSITION']) == values(checked,u['POSITION'])
report={'sha256':hashlib.sha256(result).hexdigest(),'targets':report,'status':'Normal-only diagnostic; not promoted','rest_attributes_and_morph_positions_exact':True,'original_binary_preserved':True,'only_morph_normal_accessors_changed':True}
(root/'blink-normal-field-study.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
