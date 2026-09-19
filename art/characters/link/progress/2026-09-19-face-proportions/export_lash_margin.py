"""Split only selected eyelid triangles into a material primitive; retain all original bytes."""
import copy, hashlib, json, struct
from pathlib import Path

out=Path(__file__).resolve().parent
source=Path('E:/zeldaremake-integrated-review/public/models/link/link-runtime.glb').read_bytes()
assert hashlib.sha256(source).hexdigest()=='2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4'
n=struct.unpack_from('<I',source,12)[0];doc=json.loads(source[20:20+n]);original=copy.deepcopy(doc)
binary=bytearray(source[28+n:28+n+doc['buffers'][0]['byteLength']]);prefix=bytes(binary)
study=json.loads((out/'lash-margin.json').read_text())
key=lambda tri:tuple(sorted(tuple(round(v,6) for v in p) for p in tri))
selected={key(t) for t in study['triangles']};assert len(selected)==len(study['triangles'])
primitive=doc['meshes'][2]['primitives'][1];assert primitive['material']==2

def values(index,fmt,size):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    assert not a.get('sparse')
    return [struct.unpack_from(fmt,binary,v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',size)) for i in range(a['count'])]

position=values(primitive['attributes']['POSITION'],'<3f',12)
acc=doc['accessors'][primitive['indices']];kind=acc['componentType'];assert kind in [5123,5125]
indices=[v[0] for v in values(primitive['indices'],'<H' if kind==5123 else '<I',2 if kind==5123 else 4)]
keep=[];margin=[];found=set()
for i in range(0,len(indices),3):
    tri=indices[i:i+3];k=key([position[j] for j in tri])
    if k in selected:margin.extend(tri);found.add(k)
    else:keep.extend(tri)
assert found==selected,(len(found),len(selected))
assert len(keep)+len(margin)==len(indices)

def append_indices(data):
    binary.extend(b'\0'*((-len(binary))%4));start=len(binary)
    binary.extend(struct.pack('<'+'I'*len(data),*data))
    vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(data)*4,'target':34963})
    ai=len(doc['accessors']);doc['accessors'].append({'bufferView':vi,'componentType':5125,'count':len(data),'type':'SCALAR','min':[min(data)],'max':[max(data)]})
    return ai

extra=copy.deepcopy(primitive);primitive['indices']=append_indices(keep);extra['indices']=append_indices(margin)
extra['material']=len(doc['materials'])
doc['materials'].append({'name':'Original warm upper lash margin','pbrMetallicRoughness':{'baseColorFactor':study['base_color'],'roughnessFactor':study['roughness'],'metallicFactor':0}})
doc['meshes'][2]['primitives'].append(extra);doc['buffers'][0]['byteLength']=len(binary)
assert bytes(binary[:len(prefix)])==prefix
for field in ['animations','skins','nodes','images','textures']:assert doc[field]==original[field]
assert extra['targets']==original['meshes'][2]['primitives'][1]['targets']
assert extra['attributes']==original['meshes'][2]['primitives'][1]['attributes']
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=struct.pack('<4sIII4s',b'glTF',2,28+len(j)+len(binary),len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(out/'lash-margin-candidate.glb').write_bytes(result)
report={'sha256':hashlib.sha256(result).hexdigest(),'selected_triangles':len(margin)//3,'original_binary_exact':True,'rig_clips_morph_accessors_unchanged':True,'added_primitives':1,'status':'Runtime material review pending'}
(out/'lash-export.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
