"""Bake the eye/eyelid study into standard glTF materials and bind eyes to the existing head."""
import bpy,json,hashlib,struct
from pathlib import Path

job=globals().get('JOB',{})
folder=job.get('folder','generated-runtime');assert folder in {'generated-runtime','lid-runtime','source-runtime'}
root=Path(__file__).resolve().parent/folder
stem=job.get('stem','eye-candidate');assert stem in {'eye-candidate','eye-depth-candidate','iris-plane-candidate','iris-material-candidate','hair-candidate','material-candidate'}
scene=bpy.data.scenes[job.get('scene','Link | generated eye study')];bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE')
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name and not o.name.startswith('Link_hair_detail'))
body.name='Link_skin_eye_study_body'
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name]
detail=[o for o in scene.collection.objects if o.type=='MESH' and o.name.startswith('Link_hair_detail')]
assert len(detail)==(1 if stem=='hair-candidate' else 0)
meshes=[body,*eyes,*detail]
assert len(eyes)==2 and len(rig.data.bones)==19
scene.render.fps=60;rig.data.pose_position='REST';bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
if any(len(p.vertices)>3 for p in body.data.polygons):
    triangulate=body.modifiers.new('Triangulate orbital cuts for tangent export','TRIANGULATE')
    triangulate.keep_custom_normals=True
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
body.data.calc_tangents(uvmap=body.data.uv_layers.active.name)
scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.bake.use_selected_to_active=False;scene.render.bake.margin=12;scene.render.bake.use_clear=True
# New cavity UVs overlap the body atlas; their separate flat material gets a disposable bake target.
for material in list(body.data.materials)[1:]:
    node=material.node_tree.nodes.new('ShaderNodeTexImage')
    node.image=bpy.data.images.new('Unused orbital bake target',width=4,height=4)
    material.node_tree.nodes.active=node

def bake_colour(ob,name,size):
    material=ob.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
    bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    colour=bsdf.inputs['Base Color'].links[0].from_socket
    path=root/(name+'.png')
    if colour.node.type=='TEX_IMAGE' and Path(colour.node.image.filepath_raw)==path and path.is_file():
        return hashlib.sha256(path.read_bytes()).hexdigest()
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    emission=nodes.new('ShaderNodeEmission');links.new(colour,emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
    image=bpy.data.images.new(name,width=size,height=size,alpha=False);image.colorspace_settings.name='sRGB'
    node=nodes.new('ShaderNodeTexImage');node.image=image;nodes.active=node
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.bake(type='EMIT')
    links.new(node.outputs['Color'],bsdf.inputs['Base Color']);links.new(bsdf.outputs[0],output.inputs['Surface'])
    nodes.remove(emission)
    image.filepath_raw=str(root/(name+'.png'));image.file_format='PNG';image.save();image.pack()
    assert tuple(image.size)==(size,size)
    return hashlib.sha256(Path(image.filepath_raw).read_bytes()).hexdigest()

bakes={}
if stem=='material-candidate':
    material=body.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
    for label,kind,size in [('normal','NORMAL',4096),('roughness','ROUGHNESS',2048)]:
        texture=bpy.data.images.new('Scanned body '+label,width=size,height=size,alpha=False);texture.colorspace_settings.name='Non-Color'
        node=nodes.new('ShaderNodeTexImage');node.image=texture;nodes.active=node
        bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.bake(type=kind)
        texture.filepath_raw=str(root/('scanned-body-'+label+'.png'));texture.file_format='PNG';texture.save();texture.pack()
        assert tuple(texture.size)==(size,size)
        bakes[label]=hashlib.sha256(Path(texture.filepath_raw).read_bytes()).hexdigest()
        if kind=='NORMAL':
            normal=nodes.new('ShaderNodeNormalMap');links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
        else:links.new(node.outputs['Color'],shader.inputs['Roughness'])
bakes.update(body_color=bake_colour(body,'scanned-body-color' if stem=='material-candidate' else 'body-eye-edit-color',4096),
    eye_color=bake_colour(eyes[0],'iris-material-color' if stem in {'iris-material-candidate','hair-candidate','material-candidate'} else 'anatomical-eye-color',1024))
for eye in eyes:
    bpy.ops.object.select_all(action='DESELECT');eye.select_set(True);bpy.context.view_layer.objects.active=eye
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    assert set(g.name for g in eye.vertex_groups)<={'head'}
    group=eye.vertex_groups.get('head') or eye.vertex_groups.new(name='head')
    group.add(list(range(len(eye.data.vertices))),1,'REPLACE')
    eye.parent=rig
    modifier=next((m for m in eye.modifiers if m.type=='ARMATURE'),None) or eye.modifiers.new('Existing head bone','ARMATURE')
    modifier.object=rig
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
missing=[v for v in body.data.vertices if sum(g.weight for g in v.groups)<1e-6]
assert all(.94<v.co.z<1.01 and abs(v.co.x)<.10 and -.16<v.co.y<-.07 for v in missing), 'Unweighted geometry outside the new sockets'
if missing:body.vertex_groups['head'].add([v.index for v in missing],1,'REPLACE')
# Boolean socket faces inherited unrelated limb groups. Reapply the original rigid face region,
# including weighted vertices: checking only weight sums misses this animation failure.
face=[v.index for v in body.data.vertices if v.co.z>.895 and v.co.y<.10]
head=body.vertex_groups['head']
wrong_face=sum(any(g.group!=head.index and g.weight>1e-6 for g in body.data.vertices[i].groups) for i in face)
for group in body.vertex_groups:group.remove(face)
head.add(face,1,'REPLACE')
assert all(len(body.data.vertices[i].groups)==1 and body.data.vertices[i].groups[0].group==head.index for i in face)
bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
error=max(abs(sum(g.weight for g in v.groups)-1) for ob in meshes for v in ob.data.vertices)
assert error<1e-5,error
rig.data.pose_position='POSE';rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
scene.frame_set(0)
# Saved studies need only the live shader graph, not every previous bake image.
for material in {m for ob in meshes for m in ob.data.materials}:
    nodes=material.node_tree.nodes
    keep={n for n in nodes if n.type=='OUTPUT_MATERIAL'};pending=list(keep)
    while pending:
        for socket in pending.pop().inputs:
            for link in socket.links:
                if link.from_node not in keep:keep.add(link.from_node);pending.append(link.from_node)
    for node in list(nodes):
        if node not in keep:nodes.remove(node)
    assert any(n.type=='BSDF_PRINCIPLED' for n in nodes)
bpy.data.libraries.write(str(root/(stem+'.blend')),{scene},fake_user=True,compress=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in [rig,*meshes]:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
target=root/(stem+'.glb')
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,
    export_cameras=False,export_lights=False,export_tangents=True,export_animations=True,export_animation_mode='NLA_TRACKS',
    export_force_sampling=True,export_frame_step=1,export_frame_range=False,export_rest_position_armature=True,
    export_yup=True,export_extras=False,export_all_influences=False,export_def_bones=True,export_vertex_color='NONE')
raw=target.read_bytes();assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
length,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
gltf=json.loads(raw[20:20+length]);binary_start=28+length
expected={'idle':3,'walk':.55,'run':34/60,'stairs':44/60};durations={}
for animation in gltf['animations']:
    duration=0
    for sampler in animation['samplers']:
        accessor=gltf['accessors'][sampler['input']];view=gltf['bufferViews'][accessor['bufferView']]
        assert accessor['componentType']==5126 and accessor['type']=='SCALAR'
        offset=binary_start+view.get('byteOffset',0)+accessor.get('byteOffset',0)+(accessor['count']-1)*view.get('byteStride',4)
        duration=max(duration,struct.unpack_from('<f',raw,offset)[0])
    assert animation['name'] in expected and abs(duration-expected[animation['name']])<1e-5
    durations[animation['name']]=duration
assert set(durations)==set(expected)
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert triangles<(55000 if folder=='source-runtime' else 27000) and len(gltf['materials'])<=4
assert all('TANGENT' in p['attributes'] for mesh in gltf['meshes'] for p in mesh['primitives'])
if any(next(n for n in eye.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Coat Normal'].is_linked for eye in eyes):
    assert any('clearcoatNormalTexture' in m.get('extensions',{}).get('KHR_materials_clearcoat',{}) for m in gltf['materials'])
assert all(len(skin['joints'])==19 for skin in gltf['skins'])
record={'status':'Baked anatomical eye candidate; actual GLB review required, not adopted',
    'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':triangles,
    'meshes':len(gltf['meshes']),'materials':len(gltf['materials']),'bones':19,'clip_durations':durations,
    'weight_sum_error':error,'new_socket_vertices_bound':len(missing),'wrong_face_weights_corrected':wrong_face,'rigid_face_vertices':len(face),'bakes':bakes,
    'source_candidate_sha256':json.loads((root.parent/('source-runtime' if folder=='source-runtime' else 'generated-runtime')/'validation.json').read_text())['sha256'],
    'provenance':'Generated body plus original native eyeballs/iris shader and socket/eyelid corrections. Existing409b603 skeleton/clips.'}
if stem=='material-candidate':record['material_detail_sources']=json.loads((root/'scanned-material-study.json').read_text())['sources']
(root/(stem.replace('-candidate','-validation')+'.json')).write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8');print(json.dumps(record))
