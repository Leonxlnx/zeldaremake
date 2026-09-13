"""Create the four UV-mapped runtime meshes from the current editable sculpt.

Run through Blender MCP after build_link.py. Only the generated runtime scene is replaced.
The source objects stay separate so their local procedural coordinates survive baking.
"""
import bpy
import json
import hashlib
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parent
source=bpy.data.scenes['Link | Blender art study']
source_collection=next(c for c in source.collection.children if c.name.startswith('LINK | original model'))
studio=next(c for c in source.collection.children if c.name.startswith('STUDIO |'))
bpy.context.window.scene=source
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()

def group_for(ob):
    n=ob.name
    if n.startswith(('Hair |','Eyebrow hair','Upper lash')):return 'hair'
    if n.startswith(('Eye white','Iris ','Pupil ','Eye catchlight')):return 'eyes'
    if any(m and m.name.startswith(('Skin |','Ear |','Lips |','Mouth |')) for m in ob.data.materials):return 'skin'
    return 'outfit'

def region_for(ob):
    n=ob.name
    if n.startswith('Arm wrist'):return 'armL' if n.endswith('L') else 'armR'
    if n.startswith(('Bare leg','Under shorts')):return 'legL' if n.endswith('L') else 'legR'
    if n.startswith(('Boot','Folded boot','Lace eyelet','Cross lace','Toe cap')):
        return 'bootL' if ob.location.x>0 or ' L' in n else 'bootR'
    if n.startswith(('Waist belt','Belt ','Pouch','Tunic pocket','Pocket')):return 'hips'
    if n=='Neck':return 'neck'
    if n.startswith('Cap |'):return 'cap'
    if n.startswith('Short sleeve'):return 'armL' if n.endswith('1') and not n.endswith('-1') else 'armR'
    if group_for(ob) in {'skin','hair','eyes'}:return 'head'
    return 'torso'

old=bpy.data.scenes.get('Link | runtime')
partial=JOB.get('group')
assert partial in {None,'skin','hair','eyes','outfit'}
if old and not partial:
    for c in list(old.collection.children):
        if c.name.startswith('LINK_RUNTIME'):
            for ob in list(c.objects):bpy.data.objects.remove(ob,do_unlink=True)
            bpy.data.collections.remove(c)
    bpy.data.scenes.remove(old)
if partial:
    assert old, 'A partial rebuild requires the existing runtime scene'
    runtime=old;target=bpy.data.collections['LINK_RUNTIME']
    for collection in [source_collection,studio]:
        if collection.name not in runtime.collection.children:runtime.collection.children.link(collection)
    record=json.loads(runtime['pipeline'])
    previous=bpy.data.objects[record['groups'][partial]['object']]
    bpy.data.objects.remove(previous,do_unlink=True)
    record['bakes']=[key for key in record['bakes'] if not key.startswith(partial+'/')]
    record.pop('rig',None)
else:
    runtime=bpy.data.scenes.new('Link | runtime')
    runtime.collection.children.link(source_collection)
    runtime.collection.children.link(studio)
    target=bpy.data.collections.new('LINK_RUNTIME')
    runtime.collection.children.link(target)
    record={'source_sha256':hashlib.sha256((ROOT/'link-study.blend').read_bytes()).hexdigest(),
            'generator_sha256':hashlib.sha256((ROOT/'build_link.py').read_bytes()).hexdigest(),
            'groups':{},'bakes':[]}
runtime.world=source.world
runtime.camera=source.camera
runtime.render.engine='CYCLES'
runtime.cycles.samples=8
runtime.render.threads_mode='FIXED';runtime.render.threads=4
runtime.view_settings.view_transform=source.view_settings.view_transform
runtime.unit_settings.system='METRIC'
budgets={'skin':9500,'hair':2700,'eyes':1400,'outfit':11200}
record['stage']='prepared, requires updated bakes and rig'
record['source_sha256']=hashlib.sha256((ROOT/'link-study.blend').read_bytes()).hexdigest()
record['generator_sha256']=hashlib.sha256((ROOT/'build_link.py').read_bytes()).hexdigest()
bpy.context.window.scene=runtime
for bucket,budget in budgets.items():
    if partial and bucket!=partial:continue
    bpy.ops.object.select_all(action='DESELECT')
    copies=[];originals=[]
    for ob in source_collection.objects:
        if group_for(ob)!=bucket:continue
        geo=bpy.data.meshes.new_from_object(ob.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
        geo.transform(ob.matrix_world)
        if 'eyelid surface' in ob.name or 'lip sculpt' in ob.name:
            assert sum(p.normal.y*p.area for p in geo.polygons)<0,('Facial patch points into the head',ob.name)
        copy=bpy.data.objects.new('Runtime copy '+ob.name,geo);target.objects.link(copy)
        region=region_for(ob)
        if region.startswith('boot'):
            mean_x=sum(v.co.x for v in geo.vertices)/len(geo.vertices)
            region='bootL' if mean_x>0 else 'bootR'
        copy.vertex_groups.new(name='region_'+region).add(list(range(len(geo.vertices))),1,'REPLACE')
        limit=None
        if bucket=='skin':
            # A shared collapse pass erased small eyelid and lip boundaries.
            # Reserve topology for each facial part before joining the skin atlas.
            limit=24
            for prefix,value in [('Face |',5500),('Arm wrist',850),('Bare leg',550),('Neck',150),
                                 ('Upper eyelid',300),('Lower eyelid',300),('Pointed ear',260),
                                 ('Ear inner',40),('Ear helix',70),('Upper lip',120),('Lower lip',120)]:
                if ob.name.startswith(prefix):limit=value;break
        elif bucket=='hair':
            # Spend geometry on the visible fringe rather than the mostly covered scalp.
            limit=4
            if ob.name.startswith('Hair | connected'):limit=200
            elif ob.name.startswith('Hair | swept layered clump'):
                limit=230 if int(ob.name.rsplit(' ',1)[-1])<6 else 110
            elif ob.name.startswith('Hair | overlapping'):limit=50
            elif ob.name.startswith('Hair | stray'):limit=25
            elif ob.name.startswith('Upper lash'):limit=45
        if limit is not None:
            geo.calc_loop_triangles()
            bpy.ops.object.select_all(action='DESELECT');copy.select_set(True);bpy.context.view_layer.objects.active=copy
            reduce=copy.modifiers.new('Preserve component topology','DECIMATE')
            reduce.ratio=min(1,limit/len(geo.loop_triangles));reduce.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=reduce.name)
        if ob.name.startswith('Face |'):
            # Preserve the sculpt's smooth surface directions after triangle reduction.
            normals=copy.modifiers.new('Sculpt facial normals','DATA_TRANSFER')
            normals.object=ob;normals.use_loop_data=True
            normals.data_types_loops={'CUSTOM_NORMAL'};normals.loop_mapping='POLYINTERP_NEAREST'
            bpy.ops.object.modifier_apply(modifier=normals.name)
            assert copy.data.has_custom_normals, 'Facial normal transfer was not applied'
        copies.append(copy);originals.append(ob.name)
    assert copies, bucket
    bpy.ops.object.select_all(action='DESELECT')
    for copy in copies:copy.select_set(True)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    low=bpy.context.object;low.name='Link_'+bucket
    low.data.calc_loop_triangles();before=len(low.data.loop_triangles)
    reduce=low.modifiers.new('Runtime triangle budget','DECIMATE')
    reduce.ratio=min(1,(budget-30)/before);reduce.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=reduce.name)
    triangulate=low.modifiers.new('Final triangle topology','TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    count=len(low.data.polygons)
    assert count<=budget,(bucket,count,budget)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    assert low.data.uv_layers and all(len(p.vertices)==3 for p in low.data.polygons)
    mat=bpy.data.materials.new('Link baked '+bucket);mat.use_nodes=True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.5
    low.data.materials.clear();low.data.materials.append(mat)
    for poly in low.data.polygons:poly.material_index=0
    record['groups'][bucket]={'object':low.name,'source_objects':originals,'source_triangles':before,'triangles':count}
    if bucket=='eyes' and all(bpy.data.objects[n].get('authored_almond') for n in originals if n.startswith('Eye white')):
        low['iris_refined']=True;low['iris_occlusion_refined']=True
    low.select_set(False)
if partial:
    # Existing atlases remain valid when the native collapse preserves their UV seams.
    # This transfers a little outfit geometry budget to the eyelids and lips.
    outfit=bpy.data.objects[record['groups']['outfit']['object']]
    if len(outfit.data.polygons)>budgets['outfit']:
        bpy.ops.object.select_all(action='DESELECT');outfit.select_set(True);bpy.context.view_layer.objects.active=outfit
        for modifier in list(outfit.modifiers):
            if modifier.type=='ARMATURE':outfit.modifiers.remove(modifier)
        reduce=outfit.modifiers.new('Transfer detail budget to face','DECIMATE')
        reduce.ratio=(budgets['outfit']-30)/len(outfit.data.polygons);reduce.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=reduce.name)
        record['groups']['outfit']['triangles']=len(outfit.data.polygons)
runtime.view_layers[0].layer_collection.children[source_collection.name].exclude=True
assert sum(g['triangles'] for g in record['groups'].values())<=25000
assert sum(len(g['source_objects']) for g in record['groups'].values())==len(source_collection.objects)
runtime['pipeline']=json.dumps(record)
runtime['status']=record['stage']
(ROOT/'runtime').mkdir(exist_ok=True)
(ROOT/'runtime/pipeline.json').write_text(json.dumps(record,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-runtime.blend'),compress=True)
print(json.dumps({k:v['triangles'] for k,v in record['groups'].items()}))
