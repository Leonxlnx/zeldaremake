"""Transport original eyelid normals with the actual blink surface, in native Blender math."""
import copy,json,struct,hashlib,math
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
raw=Path('E:/zeldaremake-integrated-review/public/models/link/link-runtime.glb').read_bytes()
assert hashlib.sha256(raw).hexdigest()=='2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4'
n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);old=copy.deepcopy(doc)
binary=bytearray(raw[28+n:28+n+doc['buffers'][0]['byteLength']]);prefix=bytes(binary)
p=doc['meshes'][2]['primitives'][1];assert p['material']==2
def values(index,size=3):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];assert not a.get('sparse')
    fmt={5126:'f',5123:'H',5125:'I'}[a['componentType']];step=struct.calcsize('<'+fmt)*size
    return [struct.unpack_from('<'+fmt*size,binary,v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',step)) for i in range(a['count'])]
pos=[Vector(v) for v in values(p['attributes']['POSITION'])]
norm=[Vector(v) for v in values(p['attributes']['NORMAL'])]
indices=[v[0] for v in values(p['indices'],1)]
def geometric(points):
    sums=[Vector() for _ in points]
    for j in range(0,len(indices),3):
        a,b,c=indices[j:j+3];area=(points[b]-points[a]).cross(points[c]-points[a])
        for i in (a,b,c):sums[i]+=area
    assert all(v.length>1e-12 for v in sums)
    return [v.normalized() for v in sums]
rest=geometric(pos);reports=[]
for target in p['targets']:
    movement=[Vector(v) for v in values(target['POSITION'])]
    previous=[Vector(v) for v in values(target['NORMAL'])]
    closed=geometric([a+b for a,b in zip(pos,movement)])
    normals=[];angles=[];touched=0
    for i,(base,delta) in enumerate(zip(norm,previous)):
        weight=min(1,movement[i].length/.003)
        if weight<1e-6:normals.append(delta);continue
        transported=rest[i].rotation_difference(closed[i])@base
        before=(base+delta).normalized()
        after=before.lerp(transported,weight).normalized()
        assert abs(after.length-1)<1e-5
        angles.append(math.degrees(before.angle(after)));touched+=1
        normals.append(after-base)
    binary.extend(b'\0'*((-len(binary))%4));offset=len(binary)
    for v in normals:binary.extend(struct.pack('<3f',*v))
    vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(normals)*12})
    target['NORMAL']=len(doc['accessors']);doc['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(normals),'type':'VEC3'})
    reports.append({'changed_vertices':touched,'mean_rotation_degrees':sum(angles)/len(angles),'max_rotation_degrees':max(angles)})
assert bytes(binary[:len(prefix)])==prefix
check=copy.deepcopy(doc)
for a,b in zip(old['meshes'][2]['primitives'][1]['targets'],check['meshes'][2]['primitives'][1]['targets']):b['NORMAL']=a['NORMAL']
check['accessors']=check['accessors'][:len(old['accessors'])];check['bufferViews']=check['bufferViews'][:len(old['bufferViews'])]
assert check==old,'Unexpected document change'
doc['buffers'][0]['byteLength']=len(binary)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=struct.pack('<4sIII4s',b'glTF',2,28+len(j)+len(binary),len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(out/'blink-geometric-candidate.glb').write_bytes(result)
report={'sha256':hashlib.sha256(result).hexdigest(),'targets':reports,'only_morph_normal_accessors_changed':True,'original_binary_preserved':True,'status':'Geometric normal transport candidate; runtime review pending'}
(out/'export.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
