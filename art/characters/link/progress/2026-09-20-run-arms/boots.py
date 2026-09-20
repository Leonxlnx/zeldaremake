"""Slightly shorter/narrower boots, fading to the unchanged cuff; Blender and GLB share this field."""
import copy,hashlib,json,math,struct,sys
from pathlib import Path

def field(p):
    x,y,z=p # Blender axes: Z up, -Y forward.
    t=max(0,min(1,(z-.10)/.10));f=1-t*t*(3-2*t)
    df=-6*t*(1-t)/.10 if .10<z<.20 else 0
    sx=1-.10*f;sy=1-.12*f;cx=.077 if x>=0 else -.077
    return ((cx+(x-cx)*sx,y*sy,z),(sx,sy,-.10*df*(x-cx),-.12*df*y))

def normal(n,j):
    sx,sy,dx,dy=j;v=(n[0]/sx,n[1]/sy,n[2]-dx*n[0]/sx-dy*n[1]/sy)
    length=math.sqrt(sum(x*x for x in v));return tuple(x/length for x in v)

def native_job(out):
    import bpy
    s=bpy.data.scenes['Link | September19 run contact baseline'];bpy.context.window.scene=s
    body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
    before=body.data;after=before.copy();after.name='Link | smaller boots September20';after.use_fake_user=True
    rows=[]
    for i,v in enumerate(before.vertices):
        p=tuple(v.co);q,_=field(p)
        if p==q:continue
        for key in after.shape_keys.key_blocks:
            for axis in range(3):key.data[i].co[axis]+=q[axis]-p[axis]
        after.vertices[i].co=q
        rows.append({'before':[p[0],p[2],-p[1]],'after':[q[0],q[2],-q[1]]})
    assert rows and all(a['before'][1]==a['after'][1] for a in rows)
    after.update();(out/'boots-native.json').write_text(json.dumps(rows),encoding='utf-8')
    body.data=after
    try:bpy.data.libraries.write(str(out/'smaller-boots-study.blend'),{s},fake_user=True,compress=True)
    finally:body.data=before
    print(json.dumps({'native_changed':len(rows),'height_preserved':True}))

def export(source,target):
    raw=source.read_bytes();assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
    size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);old=copy.deepcopy(doc)
    binary=bytearray(raw[28+size:28+size+doc['buffers'][0]['byteLength']]);prefix=bytes(binary)
    def values(index):
        a=doc['accessors'][index];assert a['componentType']==5126 and 'sparse' not in a
        count={'VEC3':3,'VEC4':4}[a['type']];v=doc['bufferViews'][a['bufferView']]
        start=v.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+'f'*count,binary,start+i*v.get('byteStride',count*4)) for i in range(a['count'])]
    def append(rows,old_index):
        assert all(math.isfinite(x) for row in rows for x in row)
        binary.extend(b'\0'*(-len(binary)%4));start=len(binary)
        for row in rows:binary.extend(struct.pack('<'+'f'*len(row),*row))
        a=copy.deepcopy(doc['accessors'][old_index]);a['bufferView']=len(doc['bufferViews']);a.pop('byteOffset',None)
        a['min']=[min(r[k] for r in rows) for k in range(len(rows[0]))];a['max']=[max(r[k] for r in rows) for k in range(len(rows[0]))]
        doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start,'target':34962})
        index=len(doc['accessors']);doc['accessors'].append(a);return index
    changed=0;native=json.loads((target.parent/'boots-native.json').read_text())
    native_lookup={tuple(round(v,6) for v in r['before']):r['after'] for r in native};error=0
    for m in doc['meshes']:
        for p in m['primitives']:
            attrs=p['attributes'];positions=values(attrs['POSITION'])
            if min(v[1] for v in positions)>=.20:continue
            normals=values(attrs['NORMAL']);tangents=values(attrs['TANGENT']) if 'TANGENT' in attrs else None
            outp=[];outn=[];outt=[]
            for i,(x,z,minus_y) in enumerate(positions):
                q,j=field((x,-minus_y,z));new=(q[0],q[2],-q[1]);outp.append(new)
                if z>=.20:
                    outn.append(normals[i])
                    if tangents:outt.append(tangents[i])
                    continue
                if new!=positions[i]:
                    expected=native_lookup[tuple(round(v,6) for v in positions[i])]
                    error=max(error,*[abs(a-b) for a,b in zip(new,expected)]);changed+=1
                nx,nz,minus_ny=normals[i];n=normal((nx,-minus_ny,nz),j);outn.append((n[0],n[2],-n[1]))
                if tangents:
                    tx,tz,minus_ty,w=tangents[i];sx,sy,dx,dy=j;t=(sx*tx+dx*tz,sy*(-minus_ty)+dy*tz,tz)
                    dot=sum(a*b for a,b in zip(t,n));t=tuple(a-dot*b for a,b in zip(t,n));length=math.sqrt(sum(v*v for v in t))
                    outt.append((t[0]/length,t[2]/length,-t[1]/length,w))
            attrs['POSITION']=append(outp,attrs['POSITION']);attrs['NORMAL']=append(outn,attrs['NORMAL'])
            if tangents:attrs['TANGENT']=append(outt,attrs['TANGENT'])
    assert changed>0 and error<1e-6 and binary[:len(prefix)]==prefix
    for key in old:
        if key not in ['meshes','accessors','bufferViews','buffers']:assert doc[key]==old[key],key
    doc['buffers'][0]['byteLength']=len(binary);js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*(-len(js)%4);binary+=b'\0'*(-len(binary)%4)
    result=struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    target.write_bytes(result)
    report={'source_sha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(result).hexdigest(),'changed_vertices':changed,'native_error_m':error,'width_scale':.90,'length_scale':.88,'fade_height_m':[.10,.20],'rest_height_preserved':True,'rig_clips_weights_uvs_textures_morphs_unchanged':True}
    target.with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

if __name__=='__main__':export(Path(sys.argv[1]),Path(sys.argv[2]))
