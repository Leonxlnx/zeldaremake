"""Head-only topology study using MPFB 2.0.17's CC0 core assets."""
import sys,json,bpy,bmesh,addon_utils,importlib,traceback
from pathlib import Path
from mathutils import Vector

ROOT=Path('E:/Tools/mpfb2')
legacy=sys.modules.get('mpfb._preferences')
if legacy:
    try:bpy.utils.unregister_class(legacy.MpfbPreferences)
    except RuntimeError:pass
    for key in list(sys.modules):
        if key=='mpfb' or key.startswith('mpfb.'):del sys.modules[key]
module='bl_ext.user_default.mpfb'
errors=[]
mpfb=addon_utils.enable(module,default_set=True,persistent=True,handle_error=lambda e:errors.append(traceback.format_exc()))
assert mpfb, errors
prefs=bpy.context.preferences.addons[module].preferences
Path('E:/Tools/mpfb-data').mkdir(exist_ok=True)
prefs.mpfb_user_data='E:/Tools/mpfb-data';prefs.mh_auto_user_data=False
HumanService=importlib.import_module(module+'.services.humanservice').HumanService
TargetService=importlib.import_module(module+'.services.targetservice').TargetService

name='MPFB | head anatomy study'
assert name not in bpy.data.scenes, 'Keep the existing study for comparison'
scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene
macro=TargetService.get_default_macro_info_dict()
macro.update(age=.20,gender=1.0,muscle=.3,weight=.4)
human=HumanService.create_human(mask_helpers=False,feet_on_ground=False,macro_detail_dict=macro)
for side in ['l','r']:
    TargetService.load_target(human,str(ROOT/f'src/mpfb/data/targets/eyes/{side}-eye-scale-incr.target.gz'),weight=.8)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
geometry=bpy.data.meshes.new_from_object(human.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
geometry.transform(human.matrix_world)
groups=json.loads((ROOT/'src/mpfb/data/mesh_metadata/basemesh_vertex_groups.json').read_text())
def group_indices(name):return [i for first,last in groups[name] for i in range(first,last+1)]
def mean(name):
    ids=group_indices(name)
    return sum((geometry.vertices[i].co for i in ids),Vector())/len(ids)
landmarks={n:mean(n) for n in ['joint-neck','joint-head','joint-jaw','joint-l-eye','joint-r-eye']}
eye=(landmarks['joint-l-eye']+landmarks['joint-r-eye'])/2
top=max(v.co.z for v in geometry.vertices[:13380])
sx=.096/abs(landmarks['joint-l-eye'].x-landmarks['joint-r-eye'].x)
sz=(1.16-1.002)/(top-eye.z);sy=(sx+sz)/2
def fit(p):return Vector((p.x*sx,(p.y-eye.y)*sy-.078,(p.z-eye.z)*sz+1.002))
eye_geometry=[]
for side in ['l','r']:
    ids=set(group_indices('helper-'+side+'-eye'));old_to_new={i:j for j,i in enumerate(sorted(ids))}
    verts=[fit(geometry.vertices[i].co) for i in sorted(ids)]
    faces=[tuple(old_to_new[i] for i in f.vertices) for f in geometry.polygons if all(i in ids for i in f.vertices)]
    eye_geometry.append((side,verts,faces))
bm=bmesh.new();bm.from_mesh(geometry);bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index>=13380 or v.co.z<landmarks['joint-neck'].z],context='VERTS')
for vertex in bm.verts:vertex.co=fit(vertex.co)
bm.to_mesh(geometry);bm.free();geometry.update()
head=bpy.data.objects.new('CC0 MPFB head study',geometry);scene.collection.objects.link(head)
bpy.data.objects.remove(human,do_unlink=True)
head['asset_license']='CC0-1.0';head['source_commit']='80919fa4682335c41847f761a4d79dcad4124732'
for polygon in geometry.polygons:polygon.use_smooth=True
sub=head.modifiers.new('Facial subdivision','SUBSURF');sub.levels=sub.render_levels=2
skin=bpy.data.materials.new('MPFB study skin');skin.use_nodes=True
bsdf=skin.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.64,.38,.25,1)
bsdf.inputs['Roughness'].default_value=.5;bsdf.inputs['Subsurface Weight'].default_value=.1
geometry.materials.clear();geometry.materials.append(skin)
for side,verts,faces in eye_geometry:
    data=bpy.data.meshes.new('Study eye '+side);data.from_pydata(verts,[],faces);data.update()
    ob=bpy.data.objects.new('Study eye '+side,data);scene.collection.objects.link(ob)
    for polygon in data.polygons:polygon.use_smooth=True
    sub=ob.modifiers.new('Eye subdivision','SUBSURF');sub.levels=sub.render_levels=2
scene['study_provenance']=json.dumps({'source':'makehumancommunity/mpfb2','tag':'v2.0.17','license':'CC0-1.0','macro':macro,'eye_scale_target':.8})
bpy.data.libraries.write('E:/Tools/blender-mcp/mpfb-head-study.blend',{scene},fake_user=True,compress=True)
print(json.dumps({'scene':scene.name,'head_vertices':len(geometry.vertices),'head_faces':len(geometry.polygons),'scale':[sx,sy,sz],'landmarks':{k:list(fit(v)) for k,v in landmarks.items()},'eyes':[(s,len(v),len(f)) for s,v,f in eye_geometry]}))
