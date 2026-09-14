"""Review the continuous head with the existing outfit and hair in an isolated scene."""
import bpy,bmesh,json,runpy,math,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix

root=Path(__file__).resolve().parent/'source-runtime'
proportions=bool(globals().get('JOB',{}).get('proportions',False))
version='v5' if proportions else 'v3';stem='anatomical-context-'+version
name='Link | anatomical context '+version+' study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'anatomical-topology-v4-study.blend'),link=False) as (_,loaded):loaded.scenes=['Link | anatomical topology v4 study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
appearance=bpy.data.scenes['Link | textured iris study v2']
original=next(o for o in appearance.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
rig=original.parent.copy();rig.data=original.parent.data.copy();scene.collection.objects.link(rig);rig.data.pose_position='REST'
body=original.copy();body.data=original.data.copy();scene.collection.objects.link(body);body.name='Link | anatomical outfit context '+version;body.parent=rig
for modifier in body.modifiers:
    if modifier.type=='ARMATURE':modifier.object=rig

# Reuse the hair-albedo classifier. Preserve the full crown and replace the old neck.
def neck(p):return .835<p.z<.895 and abs(p.x)<.075 and -.075<p.y<.11
image=body.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);width,height=image.size
uv=body.data.uv_layers.active.data;remove=[];retained_head=0
for polygon in body.data.polygons:
    z=polygon.center.z
    if polygon.material_index:
        assert min(body.data.vertices[v].co.z for v in polygon.vertices)>.90
        remove.append(polygon.index);continue
    if z>1.075:retained_head+=1;continue
    if z<.875 and not neck(polygon.center):continue
    coords=np.mean([uv[i].uv[:] for i in polygon.loop_indices],axis=0)
    x=max(0,min(width-1,int(coords[0]*width)));y=max(0,min(height-1,int(coords[1]*height)))
    r,g,b=pixels[(y*width+x)*4:(y*width+x)*4+3]
    gold=r>.25 and r>g*1.1 and g>b*1.25 and b/max(r,.001)<.58
    green=g>r*1.025 and g>b*1.04
    ear=.90<z<1.035 and abs(polygon.center.x)>.103
    if green or (not neck(polygon.center) and (gold or ear)):retained_head+=1
    else:remove.append(polygon.index)
del pixels
assert 1000<len(remove)<20000 and retained_head>1000,(len(remove),retained_head)
original_lower={tuple(v.co) for v in body.data.vertices if v.co.z<.83}
bm=bmesh.new();bm.from_mesh(body.data);bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[bm.faces[i] for i in remove],context='FACES')
bm.to_mesh(body.data);bm.free();body.data.update()
assert original_lower=={tuple(v.co) for v in body.data.vertices if v.co.z<.83},'Outfit below the neck changed'
runpy.run_path(str(root.parent/'restore_source_normals.py'),init_globals={'JOB':{'anatomical_context':True,'scene':name,'record_name':stem+'-normal-restoration.json'}})

# Existing generated ears provide the current silhouette; remove the hidden MPFB pair.
head=next(o for o in scene.collection.objects if o.type=='MESH' and 'topology v4 head' in o.name)
ear_group=head.vertex_groups['ears'].index
ear_indices={v.index for v in head.data.vertices if any(g.group==ear_group and g.weight>.1 for g in v.groups)}
assert 20<len(ear_indices)<1000,len(ear_indices)
bm=bmesh.new();bm.from_mesh(head.data);bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[bm.verts[i] for i in ear_indices],context='VERTS');bm.to_mesh(head.data);bm.free()
face_before={v.index:v.co.copy() for v in head.data.vertices if v.co.z>.90}
for vertex in head.data.vertices:
    t=max(0,min(1,(vertex.co.z-.84)/.055));t=t*t*(3-2*t)
    vertex.co.x*=.75+.25*t
    vertex.co.y=vertex.co.y*t+((vertex.co.y-.05)*.60+.005)*(1-t)
assert all((head.data.vertices[i].co-p).length<1e-8 for i,p in face_before.items())

# Extend the existing open neck loop beneath the collar; moving it alone left a gap.
bm=bmesh.new();bm.from_mesh(head.data)
neck_edges=[e for e in bm.edges if e.is_boundary and all(v.co.z<.88 for v in e.verts)]
assert len(neck_edges)==48,len(neck_edges)
for level in [.825,.800]:
    result=bmesh.ops.extrude_edge_only(bm,edges=neck_edges)
    added=[v for v in result['geom'] if isinstance(v,bmesh.types.BMVert)]
    assert len(added)==48,len(added)
    for v in added:v.co.z=level
    added_set=set(added)
    neck_edges=[e for e in bm.edges if e.is_boundary and all(v in added_set for v in e.verts)]
    assert len(neck_edges)==48,len(neck_edges)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(head.data);bm.free();head.data.update()
assert min(v.co.z for v in head.data.vertices)<.81

shape_record=None
if proportions:
    def smooth(a,b,x):
        t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
    def shape(p):
        x,y,z=p;front=1-smooth(.015,.07,y)
        cheek=smooth(.85,.89,z)*(1-smooth(.92,.988,z))*front
        orbit=max(math.exp(-((x-side*.0533)/.037)**4-((z-.971)/.045)**4) for side in [-1,1])*front
        nose=math.exp(-(x/.024)**4-((z-.942)/.020)**2)*(1-smooth(-.125,-.085,y))
        return Vector((x*(1+.18*cheek),y-.004*nose,z-.15*(z-.971)*orbit+.70*(z-.939)*nose))
    before=[v.co.copy() for v in head.data.vertices];determinants=[];eps=1e-5
    for p in before[::7]:
        columns=[]
        for axis in range(3):
            delta=Vector();delta[axis]=eps
            columns.append((shape(p+delta)-shape(p-delta))/(2*eps))
        determinants.append(Matrix(columns).determinant())
    assert min(determinants)>.25,min(determinants)
    for ob in [head,*[o for o in scene.collection.objects if 'continuous globe' in o.name]]:
        for v in ob.data.vertices:v.co=shape(v.co)
        ob.data.update()
    shape_record={'cheek_width_scale':1.18,'cheek_upper_fade_z':[.92,.988],'orbital_height_scale':.85,'nose_forward_metres':.004,'nose_height_scale':1.70,'min_sampled_jacobian':min(determinants),'samples':len(determinants),'max_move_metres':max((v.co-p).length for v,p in zip(head.data.vertices,before))}

scene.camera.data.type='PERSP';scene.camera.data.sensor_fit='VERTICAL';scene.camera.data.sensor_height=32;scene.camera.data.lens=59.71281292
scene.camera.location=(.14,-.84,1.03);scene.camera.rotation_euler=(Vector((0,0,1.005))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(root/('face-'+stem+'-study.png'));bpy.ops.render.render(write_still=True)
location=scene.camera.location.copy();rotation=scene.camera.rotation_euler.copy()
scene.camera.location=(.65,-.65,1.03);scene.camera.rotation_euler=(Vector((0,0,1.005))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(root/('side-'+stem+'-study.png'));bpy.ops.render.render(write_still=True)
scene.camera.location=location;scene.camera.rotation_euler=rotation
bpy.data.libraries.write(str(root/(stem+'-study.blend')),{scene},fake_user=True,compress=True)
record={'status':'Isolated combined appearance study; head not rigged, not exported or accepted','removed_old_head_faces':len(remove),'retained_hair_cap_ear_faces':retained_head,'removed_native_ear_vertices':len(ear_indices),'lower_outfit_vertices_unchanged':len(original_lower),'head_source':'anatomical-topology-v4-study.blend','body_source':'Reviewed9189538d native scene; existing UVs/materials'}
record.update(lower_outfit_preserved_below_z=.83,crown_preserved_above_z=1.075,neck_replaced=True,face_unchanged_above_z=.90)
record['neck_extension']={'source_boundary_vertices':48,'new_quad_rings_z':[.825,.800]}
record['face_unchanged_above_z']=None if proportions else .90
record['proportion_study']=shape_record
(root/(stem+'-study.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
