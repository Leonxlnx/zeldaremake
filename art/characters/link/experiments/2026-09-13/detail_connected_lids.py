"""Native upper lash roots and short eyebrow fibres on the connected lid study."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent/'source-runtime';name='Link | connected lid detail v2'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'connected-lid-study-v4.blend'),link=False) as (_,loaded):loaded.scenes=['Link | connected lid study v4']
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
    for i in range(65):
        angle=math.pi*i/64;c,s=math.cos(angle),math.sin(angle)
        x=point.x+.024*c;z=point.z+.016*s+side*.001*c
        path.append((x,front(tree,x,z)-.0022,z))
    add(path,[.25+.9*math.sin(math.pi*i/64)**.5 for i in range(65)])
    for i in range(38):
        t=i/37;x=point.x+side*(-.020+.045*t);z=point.z+.023+.0035*math.sin(math.pi*t)-.002*t
        path=[]
        for j in range(4):
            u=j/3;px=x+side*.0016*u;pz=z+.0027*u*(1-.65*t)
            path.append((px,front(skin_tree,px,pz)-.00035,pz))
        add(path,[.65,.7,.4,.05])
detail=bpy.data.objects.new('Link upper lash and brow detail',curve);scene.collection.objects.link(detail)
material=bpy.data.materials.new('Original warm brow fibres');material.use_nodes=True
shader=material.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(.065,.025,.007,1);shader.inputs['Roughness'].default_value=.62;curve.materials.append(material)
bpy.ops.object.select_all(action='DESELECT');detail.select_set(True);bpy.context.view_layer.objects.active=detail;bpy.ops.object.convert(target='MESH');detail=bpy.context.object
triangles=sum(len(p.vertices)-2 for p in detail.data.polygons);assert triangles<4000,triangles
detail.parent=rig;detail.vertex_groups.new(name='head').add(list(range(len(detail.data.vertices))),1,'REPLACE');detail.modifiers.new('Existing head binding','ARMATURE').object=rig
body.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/'face-connected-lid-detail-v2.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'connected-lid-detail-v2.blend'),{scene},fake_user=True,compress=True)
record={'status':'Native lash and brow study; not exported','added_triangles':triangles,'curves':78,'source':'Original surface-following curves; same existing head bone'}
(root/'connected-lid-detail-v2.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
