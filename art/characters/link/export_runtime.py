"""Export and validate the actual skinned, textured GLB delivered to Fable."""
import bpy
import json
import struct
import math
import hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['Link | runtime'];bpy.context.window.scene=scene
record=json.loads(scene['pipeline']);assert record.get('rig') and len(record['bakes'])==13
bpy.ops.object.select_all(action='DESELECT')
rig=bpy.data.objects['LinkRig'];rig.select_set(True)
for info in record['groups'].values():bpy.data.objects[info['object']].select_set(True)
bpy.context.view_layer.objects.active=rig
target=ROOT/'link-runtime.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,
    export_cameras=False,export_lights=False,export_tangents=True,export_animations=True,export_animation_mode='ACTIONS',
    export_force_sampling=True,export_frame_step=1,export_frame_range=False,export_anim_single_armature=False,
    export_rest_position_armature=True,export_yup=True,export_extras=False,
    export_all_influences=False,export_def_bones=True,export_vertex_color='NONE',export_all_vertex_colors=False)
raw=target.read_bytes()
assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
jslen,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
gltf=json.loads(raw[20:20+jslen])
binlen,binkind=struct.unpack_from('<II',raw,20+jslen);assert binkind==0x004e4942
binary=raw[28+jslen:28+jslen+binlen]

def accessor(index):
    a=gltf['accessors'][index];assert 'sparse' not in a
    view=gltf['bufferViews'][a['bufferView']]
    components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    code={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]
    fmt='<'+code*components;size=struct.calcsize(fmt)
    offset=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',size)
    result=[struct.unpack_from(fmt,binary,offset+i*stride) for i in range(a['count'])]
    if a.get('normalized'):
        maximum={5121:255,5123:65535}[a['componentType']]
        result=[tuple(x/maximum for x in row) for row in result]
    assert all(math.isfinite(value) for row in result for value in row)
    return result

assert len(gltf['scenes'])==1 and len(gltf['meshes'])==4
assert len(gltf['materials'])==4 and not gltf.get('cameras')
assert all('uri' not in b for b in gltf['buffers'])
names={n.get('name') for n in gltf['nodes']}
assert set(record['rig']['bones'])<=names
assert not any('Studio' in (n or '') or 'Camera' in (n or '') for n in names)
assert len(gltf.get('skins',[]))>=1
triangles=0;vertices=[];max_weight_error=0
for mesh in gltf['meshes']:
    assert len(mesh['primitives'])==1
    for primitive in mesh['primitives']:
        attributes=primitive['attributes']
        assert {'POSITION','NORMAL','TANGENT','TEXCOORD_0','JOINTS_0','WEIGHTS_0'}<=set(attributes)
        triangles+=len(accessor(primitive['indices']))//3
        vertices.extend(accessor(attributes['POSITION']))
        for weights in accessor(attributes['WEIGHTS_0']):
            error=abs(sum(weights)-1);max_weight_error=max(max_weight_error,error)
            assert error<1e-5 and min(weights)>=0
        accessor(attributes['TEXCOORD_0'])
        for normal,tangent in zip(accessor(attributes['NORMAL']),accessor(attributes['TANGENT'])):
            assert abs(sum(v*v for v in tangent[:3])-1)<.001, 'Non-unit surface tangent'
            assert abs(sum(a*b for a,b in zip(normal,tangent)))<.001, 'Tangent must be perpendicular to normal'
            assert abs(abs(tangent[3])-1)<1e-6, 'Invalid tangent handedness'
assert triangles==sum(g['triangles'] for g in record['groups'].values()) and triangles<=25000
dimensions=[]
for im in gltf['images']:
    assert 'uri' not in im and im['mimeType']=='image/png'
    view=gltf['bufferViews'][im['bufferView']];offset=view.get('byteOffset',0)
    assert binary[offset:offset+8]==b'\x89PNG\r\n\x1a\n'
    width,height=struct.unpack_from('>II',binary,offset+16)
    assert 0<width<=2048 and 0<height<=2048
    dimensions.append([width,height])
for mat in gltf['materials']:
    assert mat.get('alphaMode','OPAQUE')=='OPAQUE'
    assert 'baseColorTexture' in mat['pbrMetallicRoughness'] and 'normalTexture' in mat
    assert 'metallicRoughnessTexture' in mat['pbrMetallicRoughness']
animations={a['name']:a for a in gltf['animations']}
assert set(animations)=={'idle','walk','run','stairs'},list(animations)
seams={}
for name,animation in animations.items():
    maximum=0;duration=0
    for channel in animation['channels']:
        sampler=animation['samplers'][channel['sampler']]
        times=accessor(sampler['input']);values=accessor(sampler['output'])
        interpolation=sampler.get('interpolation','LINEAR')
        assert interpolation=='LINEAR' or (interpolation=='STEP' and all(v==values[0] for v in values)),(name,interpolation)
        assert len(times)==len(values) and all(b[0]>a[0] for a,b in zip(times,times[1:]))
        duration=max(duration,times[-1][0])
        error=max(abs(a-b) for a,b in zip(values[0],values[-1]))
        if channel['target']['path']=='rotation':
            error=min(error,max(abs(a+b) for a,b in zip(values[0],values[-1])))
        maximum=max(maximum,error)
        assert error<2e-5,(name,channel,error)
        assert gltf['nodes'][channel['target']['node']].get('name') in record['rig']['bones'], 'Object root motion exported'
    assert abs(duration-record['rig']['clips'][name]['duration_seconds'])<.001,(name,duration)
    seams[name]=maximum
lo=[min(p[i] for p in vertices) for i in range(3)];hi=[max(p[i] for p in vertices) for i in range(3)]
assert abs(lo[1])<.025 and 1.1<hi[1]<1.3,(lo,hi)
report={'pass':True,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),
    'triangles':triangles,'meshes':len(gltf['meshes']),'materials':len(gltf['materials']),
    'textures':dimensions,'weight_sum_error':max_weight_error,'loop_errors':seams,
    'bounds_metres':{'min':lo,'max':hi},'status':'Technical contract passed; art and motion review still required.'}
(ROOT/'runtime/validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
