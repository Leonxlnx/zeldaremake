"""Check that the hand candidate preserves rig, clips and unrelated geometry."""
import json,struct,hashlib,sys
from pathlib import Path
root=Path(__file__).resolve().parent/'source-runtime'
def load(name):
    raw=(root/(name+'-candidate.glb')).read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
    return raw,json.loads(raw[20:20+length]),28+length
def values(model,index):
    raw,doc,offset=model;a=doc['accessors'][index]
    fmt='<'+{5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]*{'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    size=struct.calcsize(fmt)
    result=[struct.unpack(fmt,bytes(size)) for _ in range(a['count'])]
    if 'bufferView' in a:
        v=doc['bufferViews'][a['bufferView']];start=offset+v.get('byteOffset',0)+a.get('byteOffset',0)
        result=[struct.unpack_from(fmt,raw,start+i*v.get('byteStride',size)) for i in range(a['count'])]
    if 'sparse' in a:
        sparse=a['sparse'];indices=sparse['indices'];patch=sparse['values']
        index_fmt='<'+{5121:'B',5123:'H',5125:'I'}[indices['componentType']];index_size=struct.calcsize(index_fmt)
        begin=offset+doc['bufferViews'][indices['bufferView']].get('byteOffset',0)+indices.get('byteOffset',0)
        data=offset+doc['bufferViews'][patch['bufferView']].get('byteOffset',0)+patch.get('byteOffset',0)
        for i in range(sparse['count']):
            at=struct.unpack_from(index_fmt,raw,begin+i*index_size)[0];assert at<len(result)
            result[at]=struct.unpack_from(fmt,raw,data+i*size)
    return result
upper='--upper' in sys.argv;belt=upper or '--belt' in sys.argv;shared='--shared' in sys.argv;margin=shared or '--margin' in sys.argv;projected=margin or '--projected' in sys.argv;residual=belt or '--residual' in sys.argv;garment=residual or '--garment' in sys.argv;delivery=garment or '--delivery' in sys.argv;hem=delivery or '--hem' in sys.argv;fabric='--fabric' in sys.argv;fair='--blink-fair' in sys.argv;blink=projected or delivery or fair or '--blink' in sys.argv;brow='--brow' in sys.argv;pupil='--pupil' in sys.argv;rim=hem or blink or brow or pupil or '--rim' in sys.argv;face=rim or '--face' in sys.argv;assert not (fabric and face)
old=load('belt-side' if upper else 'residual-seams' if belt or projected else 'garment' if residual else 'combined-delivery' if garment else 'back-hem' if delivery else 'brow-fine' if hem or blink else 'pupil-balanced' if brow else 'lid-rim' if pupil else 'face-runtime' if rim else 'hand-baked' if fabric or face else 'arm-followthrough');new=load('upper-seams' if upper else 'belt-side' if belt else 'blink-shared' if shared else 'blink-margin' if margin else 'blink-projected24' if projected else 'residual-seams' if residual else 'garment' if garment else 'combined-delivery' if delivery else 'back-hem' if hem else 'blink-fair' if fair else 'blink-staged' if blink else 'brow-fine' if brow else 'pupil-balanced' if pupil else 'lid-rim' if rim else 'face-runtime' if face else 'fabric-baked' if fabric else 'hand-baked');a,b=old[1],new[1]
assert len(a['meshes'])==len(b['meshes'])==3 and len(a['materials'])==len(b['materials'])==4
assert len(a['animations'])==len(b['animations'])==4 and len(a['skins'])==len(b['skins'])
assert len(a['images'])==(5 if rim else 4) and len(b['images'])==(5 if face else 4)
def image_bytes(model,index):
    raw,doc,offset=model;v=doc['bufferViews'][doc['images'][index]['bufferView']];start=offset+v.get('byteOffset',0)
    return raw[start:start+v['byteLength']]
normal_image=a['textures'][a['materials'][1]['normalTexture']['index']]['source']
assert normal_image==b['textures'][b['materials'][1]['normalTexture']['index']]['source']
for i in range(len(a['images'])):
    if rim or i!=normal_image:assert image_bytes(old,i)==image_bytes(new,i)
ignored={'name','weights'} if blink else {'name'}
assert [{k:v for k,v in n.items() if k not in ignored} for n in a['nodes']]==[{k:v for k,v in n.items() if k not in ignored} for n in b['nodes']]
if blink:assert all(all(w==0 for w in n.get('weights',[])) for n in b['nodes']+b['meshes'])
for x,y in zip(a['skins'],b['skins']):
    assert x['joints']==y['joints'] and values(old,x['inverseBindMatrices'])==values(new,y['inverseBindMatrices'])
animation_error=0
for x,y in zip(a['animations'],b['animations']):
    assert x['name']==y['name'] and x['channels']==y['channels'] and len(x['samplers'])==len(y['samplers'])
    for s,t in zip(x['samplers'],y['samplers']):
        assert values(old,s['input'])==values(new,t['input'])
        u,v=values(old,s['output']),values(new,t['output']);assert len(u)==len(v)
        animation_error=max(animation_error,max(abs(c-d) for p,q in zip(u,v) for c,d in zip(p,q)))
assert animation_error<1e-6,animation_error
if projected:
    changed=set();tangent_error=0;position_error=0
    for x,y in zip(a['meshes'],b['meshes']):
        assert len(x['primitives'])==len(y['primitives'])
        assert x.get('extras',{}).get('targetNames')==y.get('extras',{}).get('targetNames')
        for p,q in zip(x['primitives'],y['primitives']):
            assert p['material']==q['material'] and p['attributes'].keys()==q['attributes'].keys()
            ii=[v[0] for v in values(old,p['indices'])];jj=[v[0] for v in values(new,q['indices'])];assert len(ii)==len(jj)
            for key in p['attributes']:
                u,v=values(old,p['attributes'][key]),values(new,q['attributes'][key])
                for i,j in zip(ii,jj):
                    if key=='TANGENT':tangent_error=max(tangent_error,max(abs(c-d) for c,d in zip(u[i],v[j])))
                    else:assert u[i]==v[j],key
            assert len(p.get('targets',[]))==len(q.get('targets',[]))
            for t,u in zip(p.get('targets',[]),q.get('targets',[])):
                assert t.keys()==u.keys()
                before,after=values(old,t['POSITION']),values(new,u['POSITION'])
                pos=values(old,p['attributes']['POSITION'])
                for i,j in zip(ii,jj):
                    assert (before[i][0]==after[j][0]) if margin else (before[i][:2]==after[j][:2]), 'Unexpected lateral morph change'
                    delta=max(abs(c-d) for c,d in zip(before[i],after[j]));position_error=max(position_error,delta)
                    if delta>1e-8:
                        assert margin or any(abs(c)>1e-9 for c in before[i]), 'Unrelated morph position changed'
                        changed.add(pos[i])
    assert 0<len(changed)<=1100 and 0<position_error<.008 and tangent_error<.0002
    report={'candidate_sha256':hashlib.sha256(new[0]).hexdigest(),'changed_morph_positions':len(changed),'max_morph_depth_delta_m':position_error,'max_rest_tangent_component_delta':tangent_error,'all_other_rest_attributes_exact':True,'images_exact':True,'binds_exact':True,'clips_exact':animation_error==0,'morph_x_exact':True,'morph_xy_exact':not margin}
    (root/('blink-shared-validation.json' if shared else 'blink-margin-validation.json' if margin else 'blink-projected24-validation.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));sys.exit(0)
if hem:
    patch={tuple(round(c,6) for c in p) for p in json.loads((root/('upper-seams-patch.json' if upper else 'belt-side-patch.json' if belt else 'residual-seams-patch.json' if residual else 'garment-patch.json' if garment else 'combined-delivery-patch.json' if delivery else 'back-hem-patch.json')).read_text())}
    changed=set()
    for x,y in zip(a['meshes'],b['meshes']):
        assert len(x['primitives'])==len(y['primitives'])
        for p,q in zip(x['primitives'],y['primitives']):
            assert p['material']==q['material'] and p['attributes'].keys()==q['attributes'].keys()
            ii=[v[0] for v in values(old,p['indices'])];jj=[v[0] for v in values(new,q['indices'])];assert len(ii)==len(jj)
            pos=values(old,p['attributes']['POSITION'])
            for key in p['attributes']:
                u=values(old,p['attributes'][key]);v=values(new,q['attributes'][key])
                for i,j in zip(ii,jj):
                    if key in ('JOINTS_0','WEIGHTS_0') and u[i]!=v[j]:
                        point=tuple(round(c,6) for c in pos[i]);assert point in patch,point;changed.add(point)
                    else:assert u[i]==v[j],key
            weights=values(new,q['attributes']['WEIGHTS_0']);assert max(abs(sum(w)-1) for w in weights)<1e-5
    assert changed
    report={'source_sha256':hashlib.sha256(old[0]).hexdigest(),'candidate_sha256':hashlib.sha256(new[0]).hexdigest(),'changed_weight_positions':len(changed),'allowed_patch_positions':len(patch),'outside_weights_exact':True,'all_other_vertex_attributes_exact':True,'all_images_exact':True,'clips_exact':animation_error==0,'binds_exact':True}
    if delivery:
        morph_source=load('blink-fair')
        assert b['meshes'][2]['extras']['targetNames']==['blink','blinkHalf']
        for x,y in zip(morph_source[1]['meshes'],b['meshes']):
            for p,q in zip(x['primitives'],y['primitives']):
                assert len(p.get('targets',[]))==len(q.get('targets',[]))
                ii=[v[0] for v in values(morph_source,p['indices'])];jj=[v[0] for v in values(new,q['indices'])]
                for t,u in zip(p.get('targets',[]),q.get('targets',[])):
                    assert t.keys()==u.keys()
                    for key in t:
                        old_values,new_values=values(morph_source,t[key]),values(new,u[key])
                        assert [old_values[i] for i in ii]==[new_values[j] for j in jj],('morph',key)
        report['exported_morphs_exact_to_blink_fair']=True
    (root/('upper-seams-validation.json' if upper else 'belt-side-validation.json' if belt else 'residual-seams-validation.json' if residual else 'garment-validation.json' if garment else 'combined-delivery-validation.json' if delivery else 'back-hem-validation.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report));sys.exit(0)
if face:
    from collections import defaultdict
    def states(model):
        result=defaultdict(list);count=0
        for mesh in model[1]['meshes']:
            for primitive in mesh['primitives']:
                attrs={k:values(model,v) for k,v in primitive['attributes'].items()}
                for i in {x[0] for x in values(model,primitive['indices'])}:
                    if attrs['POSITION'][i][1]>=.8:continue
                    # One-micrometre matching tolerates float round trips, not visible deformation.
                    key=(primitive['material'],)+tuple((k,tuple(round(x,6) for x in attrs[k][i])) for k in sorted(attrs) if k not in ('NORMAL','TANGENT'))
                    result[key].append(attrs['NORMAL'][i]);count+=1
        return result,count
    before,old_count=states(old);after,new_count=states(new)
    assert before.keys()==after.keys(),(len(before.keys()-after.keys()),len(after.keys()-before.keys()))
    error=max(min(max(abs(x-y) for x,y in zip(n,m)) for m in before[k]) for k,ns in after.items() for n in ns)
    assert error<.001,error
    report={'source_sha256':hashlib.sha256(old[0]).hexdigest(),'candidate_sha256':hashlib.sha256(new[0]).hexdigest(),'clip_max_error':animation_error,'outside_head_states':len(before),'outside_head_normal_max_error':error,'outside_head_positions_uvs_weights_joints_match_at_1um':True,'binds_preserved':True,'non_normal_source_images_byte_exact':True}
    if rim:report['all_source_images_byte_exact']=True
    if pupil or brow or blink:
        for x,y in zip(a['meshes'][:2],b['meshes'][:2]):
            p,q=x['primitives'][0],y['primitives'][0]
            for key in ('POSITION','NORMAL','JOINTS_0','WEIGHTS_0'):
                assert values(old,p['attributes'][key])==values(new,q['attributes'][key]),key
        report['eye_geometry_normals_weights_exact']=True
    if brow or blink:
        for x,y in zip(a['meshes'],b['meshes']):
            for p,q in zip(x['primitives'],y['primitives']):
                assert p['material']==q['material']
                ii=[v[0] for v in values(old,p['indices'])];jj=[v[0] for v in values(new,q['indices'])];assert len(ii)==len(jj)
                for key in ('POSITION','TEXCOORD_0','JOINTS_0','WEIGHTS_0'):
                    if brow and key=='POSITION' and p['material']==3:continue
                    u=values(old,p['attributes'][key]);v=values(new,q['attributes'][key]);assert [u[i] for i in ii]==[v[i] for i in jj],key
        report['non_brow_positions_and_all_uvs_weights_joints_exact']=True
    if blink:
        assert b['meshes'][2]['extras']['targetNames']==['blink','blinkHalf']
        assert all(len(p.get('targets',[]))==2 for p in b['meshes'][2]['primitives'])
        report.update(all_base_positions_uvs_weights_joints_exact=True,morph_targets=['blink','blinkHalf'],default_weights_zero=True)
    (root/('blink-fair-validation.json' if fair else 'blink-export-validation.json' if blink else 'brow-export-validation.json' if brow else 'pupil-export-validation.json' if pupil else 'lid-rim-export-validation.json' if rim else 'face-runtime-validation.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report));sys.exit(0)
changed=0;outside_normal=0
for x,y in zip(a['meshes'],b['meshes']):
    assert len(x['primitives'])==len(y['primitives'])
    for p,q in zip(x['primitives'],y['primitives']):
        assert p['material']==q['material']
        # glTF renumbers shared vertices after hand normals change. Compare the
        # ordered triangle corners so that equivalent indexing is accepted.
        ii=[v[0] for v in values(old,p['indices'])];jj=[v[0] for v in values(new,q['indices'])];assert len(ii)==len(jj)
        def corners(model,primitive,key,indices):
            data=values(model,primitive['attributes'][key]);return [data[i] for i in indices]
        assert p['attributes'].keys()==q['attributes'].keys()
        pos=corners(old,p,'POSITION',ii);target=corners(new,q,'POSITION',jj);assert len(pos)==len(target)
        for u,v in zip(pos,target):
            if u!=v:
                assert not fabric,'Fabric bake moved geometry'
                assert abs(u[0])>.245 and u[1]<.476,(u,v)
                changed+=1
        for key in p['attributes']:
            if key in ('POSITION','NORMAL','TANGENT'):continue
            assert corners(old,p,key,ii)==corners(new,q,key,jj),key
        for point,u,v in zip(pos,corners(old,p,'NORMAL',ii),corners(new,q,'NORMAL',jj)):
            if fabric:assert u==v,'Fabric bake changed mesh normals'
            if abs(point[0])<=.235 or point[1]>=.55:outside_normal=max(outside_normal,max(abs(c-d) for c,d in zip(u,v)))
assert (changed==0 if fabric else changed>0) and outside_normal<1e-6,(changed,outside_normal)
report={'source_sha256':hashlib.sha256(old[0]).hexdigest(),'candidate_sha256':hashlib.sha256(new[0]).hexdigest(),'changed_triangle_corner_positions':changed,'positions_changed_only_in_fingers':True,'outside_normal_max_error':outside_normal,'clip_max_error':animation_error,'triangle_corner_uvs_weights_joints_binds_preserved':True}
if fabric:report.update(geometry_and_normals_exact=True)
(root/('fabric-baked-validation.json' if fabric else 'hand-baked-validation.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
