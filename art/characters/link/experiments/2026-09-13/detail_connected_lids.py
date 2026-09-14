"""Native upper lash roots and short eyebrow fibres on the connected lid study."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

existing=bool(globals().get('JOB',{}).get('existing',False))
prefix='existing-lid-detail-v4' if existing else 'connected-lid-detail-v2'
root=Path(__file__).resolve().parent/'source-runtime';name='Link | existing lid detail v4' if existing else 'Link | connected lid detail v2'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/('hardware-candidate.blend' if existing else 'connected-lid-study-v4.blend')),link=False) as (_,loaded):loaded.scenes=['Link | boot hardware study v2' if existing else 'Link | connected lid study v4']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
eyes=sorted([o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name],key=lambda o:min(v.co.x for v in o.data.vertices))
bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();skin_tree=BVHTree.FromObject(body,graph)
curve=bpy.data.curves.new('Original lash and brow fibres','CURVE');curve.dimensions='3D';curve.bevel_depth=.0003;curve.bevel_resolution=0

def add(points,radii):
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for point,co,radius in zip(spline.points,points,radii):point.co=(*co,1);point.radius=radius

def front(tree,x,z):
    hit,_,_,_=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    assert hit is not None,(x,z)
    return hit.y

for point,eye in zip(points,eyes):
    side=1 if point.x>0 else -1;tree=BVHTree.FromObject(eye,graph);path=[]
    if existing:
        def visible(x,z):
            eye_hit=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))[0]
            skin_hit=skin_tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))[0]
            return eye_hit is not None and (skin_hit is None or eye_hit.y<skin_hit.y)
        for i in range(65):
            x=point.x+.0235*(2*i/64-1)
            samples=[point.z-.024+.051*j/80 for j in range(81)]
            seen=[j for j,z in enumerate(samples) if visible(x,z)]
            if not seen:continue
            j=max(seen);assert j<80
            low,high=samples[j],samples[j+1]
            for _ in range(12):
                middle=(low+high)/2
                if visible(x,middle):low=middle
                else:high=middle
            # The eyeball is recessed: the visible boundary can jump to the front rim.
            z=high+.00001;eye_y=front(tree,x,z);skin_y=front(skin_tree,x,z)
            assert skin_y<=eye_y+.0001 and abs(eye_y-skin_y)<.03,'Lash root must remain on the occluding lid rim'
            root_point=Vector((x,skin_y,z));assert skin_tree.find_nearest(root_point)[3]<.0001
            path.append((x,skin_y-.00045,z))
        assert len(path)>40,len(path)
    else:
        for i in range(65):
            angle=math.pi*i/64;c,s=math.cos(angle),math.sin(angle)
            x=point.x+.024*c;z=point.z+.016*s+side*.001*c
            path.append((x,front(tree,x,z)-.0022,z))
    add(path,[.25+(2.3 if existing else .9)*math.sin(math.pi*i/(len(path)-1))**.5 for i in range(len(path))])
    if existing:
        for j in range(8):
            t=.55+.38*j/7 if side>0 else .45-.38*j/7
            x,y,z=path[round(t*(len(path)-1))]
            add([(x,y,z),(x+side*.001,y-.003,z+.001),(x+side*.003,y-.004,z+.003)],[.8,.55,.03])
    brow_count=76 if existing else 38
    for i in range(brow_count):
        t=i/(brow_count-1);x=point.x+side*(-.020+.045*t);z=point.z+.023+.0035*math.sin(math.pi*t)-.002*t
        path=[]
        for j in range(4):
            u=j/3;px=x+side*.0016*u;pz=z+.0027*u*(1-.65*t)
            path.append((px,front(skin_tree,px,pz)-.00035,pz))
        profile=.25+.75*math.sin(math.pi*t)**.5
        add(path,[r*profile for r in [1,1,.55,.05]] if existing else [.65,.7,.4,.05])
curve_count=len(curve.splines)
detail=bpy.data.objects.new('Link upper lash and brow detail',curve);scene.collection.objects.link(detail)
material=bpy.data.materials.new('Original warm brow fibres');material.use_nodes=True
shader=material.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(.16,.065,.016,1) if existing else (.065,.025,.007,1);shader.inputs['Roughness'].default_value=.62;curve.materials.append(material)
bpy.ops.object.select_all(action='DESELECT');detail.select_set(True);bpy.context.view_layer.objects.active=detail;bpy.ops.object.convert(target='MESH');detail=bpy.context.object
triangles=sum(len(p.vertices)-2 for p in detail.data.polygons);assert triangles<(5500 if existing else 4000),triangles
detail.parent=rig;detail.vertex_groups.new(name='head').add(list(range(len(detail.data.vertices))),1,'REPLACE');detail.modifiers.new('Existing head binding','ARMATURE').object=rig
body.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
if existing:
    scene.camera.data.type='PERSP';scene.camera.data.sensor_fit='VERTICAL';scene.camera.data.sensor_height=32;scene.camera.data.lens=32/(2*math.tan(math.radians(15)))
    scene.camera.location=(.14,-.84,1.03);scene.camera.rotation_euler=(Vector((0,0,1.005))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(root/('face-'+prefix+'.png'));bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/(prefix+'.blend')),{scene},fake_user=True,compress=True)
record={'status':'Native lash and brow study; not exported','added_triangles':triangles,'curves':curve_count,'source':'Original surface-following curves; same existing head bone'}
(root/(prefix+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
