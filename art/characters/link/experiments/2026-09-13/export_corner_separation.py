"""Apply the measured Blender corner correction while retaining reviewed blink normals."""
import ast, json, struct, hashlib
from pathlib import Path
root=Path(__file__).resolve().parent/'source-runtime'
helper=Path(__file__).with_name('check_hand_bake.py')
exec(compile(ast.Module(body=[n for n in ast.parse(helper.read_text()).body if isinstance(n,ast.FunctionDef) and n.name in ('load','values')],type_ignores=[]),str(helper),'exec'))
model=load('blink-normal-field');raw,doc,offset=model
binary=bytearray(raw[offset:offset+doc['buffers'][0]['byteLength']])
patch=json.loads((root/'closed-corner-separation-study.json').read_text())['patch']
matched=set();changes=0
for mesh in doc['meshes']:
 for primitive in mesh['primitives']:
  if primitive['material']!=2:continue
  assert mesh['extras']['targetNames']==['blink','blinkHalf']
  positions=values(model,primitive['attributes']['POSITION'])
  mapping={}
  for i,p in enumerate(positions):
   hits=[v for v in patch if max(abs(a-b) for a,b in zip(p,v['base']))<1e-7]
   assert len(hits)<=1
   if hits:mapping[i]=hits[0]['delta'];matched.add(hits[0]['vertex'])
  for target,factor in zip(primitive['targets'],(1,.5)):
   data=[list(v) for v in values(model,target['POSITION'])]
   for i,dz in mapping.items():data[i][1]+=factor*dz;changes+=1
   while len(binary)%4:binary.append(0)
   start=len(binary)
   for v in data:binary.extend(struct.pack('<3f',*v))
   view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':12*len(data)})
   target['POSITION']=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(data),'type':'VEC3','min':[min(v[k] for v in data) for k in range(3)],'max':[max(v[k] for v in data) for k in range(3)]})
assert len(matched)==len(patch)==17
doc['buffers'][0]['byteLength']=len(binary)
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);binary.extend(b'\0'*((-len(binary))%4))
result=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(root/'closed-corner-separation-candidate.glb').write_bytes(result)
old=load('blink-normal-field');new=load('closed-corner-separation')
assert new[0][new[2]:new[2]+old[1]['buffers'][0]['byteLength']]==old[0][old[2]:old[2]+old[1]['buffers'][0]['byteLength']]
comparison=json.loads(json.dumps(new[1]))
for a,b in zip(old[1]['meshes'],comparison['meshes']):
 for p,q in zip(a['primitives'],b['primitives']):
  for t,u in zip(p.get('targets',[]),q.get('targets',[])):u['POSITION']=t['POSITION']
comparison['accessors']=comparison['accessors'][:len(old[1]['accessors'])];comparison['bufferViews']=comparison['bufferViews'][:len(old[1]['bufferViews'])];comparison['buffers']=old[1]['buffers'];assert comparison==old[1]
report={'sha256':hashlib.sha256(result).hexdigest(),'vertices':len(matched),'exported_target_updates':changes,'original_binary_exact':True,'only_morph_position_accessors_changed':True,'maximum_native_delta_m':max(p['delta'] for p in patch),'status':'Runtime visual review pending'}
(root/'closed-corner-separation-export.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
