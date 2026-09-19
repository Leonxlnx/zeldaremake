"""Append reviewed run leg channels to 24591126; preserve every other asset byte."""
import copy,hashlib,json,math,struct,sys
from pathlib import Path
out=Path(__file__).resolve().parent
stem=sys.argv[2] if len(sys.argv)>2 else 'run-contact-low'
study=json.loads((out/(stem+'-study.json')).read_text())
def load(path):
 raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
 return raw,json.loads(raw[20:20+length]),28+length
def values(model,index):
 # Same accessor read as check_hand_bake.py, narrowed to the native animation carrier.
 raw,doc,offset=model;a=doc['accessors'][index]
 assert a['componentType']==5126 and 'sparse' not in a
 fmt='<'+{'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]*'f';size=struct.calcsize(fmt)
 v=doc['bufferViews'][a['bufferView']];assert v.get('buffer',0)==0
 start=offset+v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(fmt,raw,start+i*v.get('byteStride',size)) for i in range(a['count'])]
old=load(Path(sys.argv[1]));native=load(out/(stem+'-native.glb'))
assert hashlib.sha256(old[0]).hexdigest()=='2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4'
original=old[1];doc=copy.deepcopy(original);binary=bytearray(old[0][old[2]:old[2]+original['buffers'][0]['byteLength']]);prefix=bytes(binary)
def append(rows,kind):
 assert rows and all(math.isfinite(v) for row in rows for v in row)
 while len(binary)%4:binary.append(0)
 start=len(binary);binary.extend(b''.join(struct.pack('<'+'f'*len(row),*row) for row in rows))
 view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start})
 a={'bufferView':view,'componentType':5126,'count':len(rows),'type':kind}
 if kind=='SCALAR':a.update(min=[min(x[0] for x in rows)],max=[max(x[0] for x in rows)])
 index=len(doc['accessors']);doc['accessors'].append(a);return index
run=next(a for a in doc['animations'] if a['name']=='run');source=next(a for a in native[1]['animations'] if a['name']=='run')
def key(model,c):return model[1]['nodes'][c['target']['node']]['name'],c['target']['path']
lookup={key(native,c):source['samplers'][c['sampler']] for c in source['channels']}
edited={'hips'}|{j+s for j in ['thigh','knee','ankle'] for s in ['L','R']};changed=[]
if study.get('preserve_hips'):edited.remove('hips')
native_nodes={n.get('name'):n for n in native[1]['nodes']}
for node in original['nodes']:
 if node.get('name') not in edited:continue
 for prop,default in [('translation',[0,0,0]),('rotation',[0,0,0,1]),('scale',[1,1,1])]:
  a=node.get(prop,default);b=native_nodes[node['name']].get(prop,default)
  error=max(abs(x-y) for x,y in zip(a,b))
  if prop=='rotation':error=min(error,max(abs(x+y) for x,y in zip(a,b)))
  assert error<1e-5,(node['name'],prop,a,b)
for c in run['channels']:
 bone,path=key(old,c)
 if bone not in edited or (bone=='hips' and path!='translation'):continue
 before=run['samplers'][c['sampler']];src=lookup[(bone,path)]
 times=values(native,src['input']);rows=values(native,src['output'])
 interpolation=src.get('interpolation','LINEAR')
 assert interpolation in ('LINEAR','STEP') and abs(times[-1][0]-28/60)<1e-6
 if interpolation=='STEP':assert all(row==rows[0] for row in rows)
 assert all(a[0]<b[0] for a,b in zip(times,times[1:]))
 sampler={'input':append(times,'SCALAR'),'output':append(rows,original['accessors'][before['output']]['type']),'interpolation':interpolation}
 c['sampler']=len(run['samplers']);run['samplers'].append(sampler);changed.append([bone,path])
assert changed and bytes(binary[:len(prefix)])==prefix
for k in original:
 if k not in ['accessors','bufferViews','buffers','animations']:assert doc[k]==original[k],k
for a,b in zip(doc['animations'],original['animations']):
 if a['name']!='run':assert a==b
 else:
  for c,d in zip(a['channels'],b['channels']):
   if list(key(old,d)) not in changed:assert c==d and a['samplers'][c['sampler']]==b['samplers'][d['sampler']]
doc['buffers'][0]['byteLength']=len(binary)
js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
result=struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(out/(stem+'-candidate.glb')).write_bytes(result)
report={'sha256':hashlib.sha256(result).hexdigest(),'source_sha256':hashlib.sha256(old[0]).hexdigest(),'original_binary_preserved':True,'rest_nodes_and_assets_exact':True,'other_clips_and_nonleg_run_channels_exact':True,'hips_preserved':study.get('preserve_hips',False),'changed':changed,'cycle_s':28/60,'stride_m':study['stride_m'],'status':'Export checked; game and visual acceptance pending'}
(out/(stem+'-export.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report))
