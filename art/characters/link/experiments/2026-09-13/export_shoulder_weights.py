"""Transfer reviewed native shoulder weights without re-exporting the face or clips."""
import ast, collections, hashlib, json, struct
from pathlib import Path
root=Path(__file__).resolve().parent/'source-runtime'
helper=Path(__file__).with_name('check_hand_bake.py')
exec(compile(ast.Module(body=[n for n in ast.parse(helper.read_text()).body if isinstance(n,ast.FunctionDef) and n.name in ('load','values')],type_ignores=[]),str(helper),'exec'))
old=load('closed-corner-separation');raw,doc,offset=old
assert hashlib.sha256(raw).hexdigest()=='4741cf3ec4fd1f8635a1bf980fc40ce5bc7722403076967b797cf2c2e4df1768'
assert len(doc['skins'])==1
joints=[doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']]
patch=json.loads((root/'remaining-shoulders-weight-patch.json').read_text())
lookup=collections.defaultdict(list)
for row in patch:lookup[tuple(round(v,6) for v in row['position'])].append(row)
result=bytearray(raw);allowed=set();matched=set();count=0;baseline_roundoff=0
def location(index,vertex):
    a=doc['accessors'][index];assert 'sparse' not in a
    view=doc['bufferViews'][a['bufferView']]
    size={5121:1,5126:4}[a['componentType']]*4
    return offset+view.get('byteOffset',0)+a.get('byteOffset',0)+vertex*view.get('byteStride',size),size
for mesh in doc['meshes']:
 for primitive in mesh['primitives']:
  if primitive['material']!=1:continue
  attrs=primitive['attributes'];positions=values(old,attrs['POSITION']);indices=values(old,attrs['JOINTS_0']);weights=values(old,attrs['WEIGHTS_0'])
  assert doc['accessors'][attrs['JOINTS_0']]['componentType']==5121
  assert doc['accessors'][attrs['WEIGHTS_0']]['componentType']==5126
  for i,p in enumerate(positions):
   hits=[r for r in lookup.get(tuple(round(v,6) for v in p),[]) if max(abs(a-b) for a,b in zip(p,r['position']))<1e-7]
   if not hits:continue
   existing={joints[j]:w for j,w in zip(indices[i],weights[i]) if w>1e-8}
   position_hits=hits
   hits=[r for r in hits if max(abs(existing.get(k,0)-r['before'].get(k,0)) for k in set(existing)|set(r['before']))<.00011]
   assert hits,('Position matched but original skin weights did not',p,existing,position_hits)
   assert all(r['after']==hits[0]['after'] for r in hits),'Ambiguous coincident vertices'
   baseline_roundoff=max(baseline_roundoff,max(abs(existing.get(k,0)-hits[0]['before'].get(k,0)) for k in set(existing)|set(hits[0]['before'])))
   after=sorted(((joints.index(k),v) for k,v in hits[0]['after'].items() if v>1e-8),key=lambda item:-item[1])
   assert 1<=len(after)<=4
   total=sum(w for _,w in after);assert abs(total-1)<1e-5
   after=[(j,w/total) for j,w in after]+[(0,0)]*(4-len(after))
   for key,fmt,data in [('JOINTS_0','<4B',[j for j,_ in after]),('WEIGHTS_0','<4f',[w for _,w in after])]:
    at,size=location(attrs[key],i);result[at:at+size]=struct.pack(fmt,*data);allowed.update(range(at,at+size))
   matched.update(r['vertex'] for r in hits);count+=1
assert len(matched)==len(patch)==202,(len(matched),len(patch))
assert all(a==b or i in allowed for i,(a,b) in enumerate(zip(raw,result)))
(root/'remaining-shoulders-candidate.glb').write_bytes(result)
new=load('remaining-shoulders');assert new[1]==doc
report={'sha256':hashlib.sha256(result).hexdigest(),'native_vertices':len(matched),'exported_vertices':count,'changed_bytes':sum(a!=b for a,b in zip(raw,result)),'only_joint_weight_bytes_changed':True,'maximum_native_baseline_weight_roundoff':baseline_roundoff,'status':'Actual game visual review pending'}
(root/'remaining-shoulders-export.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
