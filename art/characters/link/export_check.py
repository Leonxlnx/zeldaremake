"""Validate the actual evaluated model, then export a static GLB art candidate."""
import bpy
import json
import math
import struct
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent
bpy.context.window.scene=bpy.data.scenes['Link | Blender art study']
collection=next((c for c in bpy.context.scene.collection.children if c.name.startswith('LINK | original model')),None)
assert collection and len(collection.objects)>100, 'Missing character parts'
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
triangles=0
lo=Vector((math.inf,math.inf,math.inf));hi=-lo
for ob in collection.objects:
    assert ob.type in {'MESH','CURVE'}, (ob.name,ob.type)
    evaluated=ob.evaluated_get(deps)
    geo=evaluated.to_mesh()
    try:
        assert geo and len(geo.vertices)>0, ob.name
        geo.calc_loop_triangles()
        triangles+=len(geo.loop_triangles)
        strand_z=None
        if ob.name.startswith('Hair | strand'):
            controls=[(ob.matrix_world@p.co).z for s in ob.data.splines for p in s.bezier_points]
            strand_z=(min(controls)-.012,max(controls)+.012)
        for v in geo.vertices:
            p=ob.matrix_world@v.co
            assert all(math.isfinite(c) for c in p), ob.name
            if strand_z:
                assert strand_z[0]<=p.z<=strand_z[1], ('Hair handle overshoot',ob.name,p.z,strand_z)
            for a in range(3):
                lo[a]=min(lo[a],p[a]);hi[a]=max(hi[a],p[a])
    finally:
        evaluated.to_mesh_clear()
size=hi-lo
assert 1.0<size.z<1.4, ('Unexpected model height',size.z)
assert .3<size.x<.75 and .20<size.y<.8, ('Unexpected bounds',list(size))
assert -.025<lo.z<.04, ('Feet not at ground',lo.z)
assert 0<triangles<800_000, ('Art mesh too large',triangles)

target=root/'link-study.glb'
source_scene=bpy.context.scene
export_scene=bpy.data.scenes.new('Temporary static export')
bpy.context.window.scene=export_scene
copies=[]
review_materials=[]
try:
    # Evaluate curves too: exporting only meshes would silently omit stitches and hair fibres.
    for ob in collection.objects:
        data=bpy.data.meshes.new_from_object(ob.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
        data.transform(ob.matrix_world)
        copy=bpy.data.objects.new(ob.name,data);export_scene.collection.objects.link(copy)
        copies.append(copy)
        copy.select_set(True)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    bpy.context.object.name='Link | static art review only'
    # Triplanar/procedural shaders cannot travel in glTF. Export honest flat colours
    # until a UV bake exists, instead of image textures attached to missing UVs.
    for slot in bpy.context.object.material_slots:
        mat=slot.material.copy();review_materials.append(mat);slot.material=mat
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        for name in ['Base Color','Roughness','Normal']:
            for link in list(bsdf.inputs[name].links):
                if link.from_node.type != 'VERTEX_COLOR':
                    mat.node_tree.links.remove(link)
    triangulate=bpy.context.object.modifiers.new('Explicit export triangulation','TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    export_triangles=len(bpy.context.object.data.polygons)
    assert all(len(p.vertices)==3 for p in bpy.context.object.data.polygons)
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,
        export_apply=True,export_cameras=False,export_lights=False,export_animations=False,
        export_yup=True,export_extras=True)
finally:
    bpy.context.window.scene=source_scene
    for ob in list(export_scene.objects):
        data=ob.data
        bpy.data.objects.remove(ob,do_unlink=True)
        if data.users==0:
            bpy.data.meshes.remove(data)
    bpy.data.scenes.remove(export_scene)
    for mat in review_materials:
        if mat.users==0:
            bpy.data.materials.remove(mat)
data=target.read_bytes()
magic,version,length=struct.unpack_from('<4sII',data)
assert magic==b'glTF' and version==2 and length==len(data), 'Invalid GLB header'
json_length,json_type=struct.unpack_from('<II',data,12)
assert json_type==0x4e4f534a
gltf=json.loads(data[20:20+json_length])
assert gltf.get('meshes') and not gltf.get('animations')
assert len(gltf['meshes'])==1 and len(gltf['scenes'])==1, 'Export included another scene'
assert not gltf.get('cameras')
assert all('uri' not in b for b in gltf['buffers']), 'GLB has external buffers'
assert all('uri' not in im for im in gltf.get('images',[])), 'GLB has external images'
assert not gltf.get('images'), 'Unbaked textures leaked into flat-colour review export'
exported_triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert exported_triangles==export_triangles, ('Export changed triangulated geometry',export_triangles,exported_triangles)
report={'pass':True,'objects':len(collection.objects),'evaluated_triangles':triangles,
    'exported_triangles':exported_triangles,
    'bounds_metres':{'min':list(lo),'max':list(hi),'size':list(size)},
    'glb_bytes':len(data),'glb_meshes':len(gltf['meshes']),
    'glb_materials':len(gltf.get('materials',[])),'glb_images':len(gltf.get('images',[])),
    'runtime_ready':False,'runtime_target_triangles':25000,'runtime_target_materials':4,
    'status':'Static flat-colour art study, unrigged; Blender material detail awaits UV baking.'}
(root/'validation.json').write_text(json.dumps(report,indent=2))
bpy.ops.object.select_all(action='DESELECT')
print(json.dumps(report))
