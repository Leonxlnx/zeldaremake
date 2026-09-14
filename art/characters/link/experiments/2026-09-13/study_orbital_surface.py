"""Build a small native eyelid surface between the eyeball and existing face."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent/'source-runtime'
name='Link | orbital surface study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'iris-material-study.blend'),link=False) as (available,loaded):loaded.scenes=['Link | iris material study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
eyes=sorted([o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name],key=lambda o:min(v.co.x for v in o.data.vertices))
assert len(eyes)==2
bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();face_tree=BVHTree.FromObject(body,graph)
points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
verts=[];faces=[];lash_paths=[];segments=64;rings=6
def front(tree,x,z):
    hit,normal,index,distance=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    assert hit is not None,(x,z)
    return hit.y
for eye,point in zip(eyes,points):
    tree=BVHTree.FromObject(eye,graph);start=len(verts);lash=[];side=1 if point.x>0 else -1
    for ring in range(rings+1):
        t=ring/rings;smooth=t*t*(3-2*t)
        for i in range(segments):
            angle=2*math.pi*i/segments;c=math.cos(angle);s=math.sin(angle)
            inner=Vector((point.x+.024*c,0,point.z+(.016 if s>=0 else .0135)*s+side*.0015*c))
            outer=Vector((point.x+.034*c,0,point.z+.026*s+side*.0015*c))
            inner.y=front(tree,inner.x,inner.z)-.0006
            outer.y=front(face_tree,outer.x,outer.z)+.00025
            position=inner.lerp(outer,t);position.y=inner.y*(1-smooth)+outer.y*smooth-.001*math.sin(math.pi*t)
            verts.append(tuple(position))
            if ring==0 and s>=-1e-6:lash.append(tuple(position+Vector((0,-.00045,0))))
    for ring in range(rings):
        for i in range(segments):
            a=start+ring*segments+i;b=start+ring*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    lash_paths.append(lash)
mesh=bpy.data.meshes.new('Anatomical lid surface');mesh.from_pydata(verts,[],faces);mesh.update()
lids=bpy.data.objects.new('Link_orbital_surface',mesh);scene.collection.objects.link(lids);mesh.materials.append(body.data.materials[1])
for p in mesh.polygons:p.use_smooth=True
curve=bpy.data.curves.new('Upper lash roots','CURVE');curve.dimensions='3D';curve.bevel_depth=.00055;curve.bevel_resolution=1
for points in lash_paths:
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for i,point in enumerate(points):spline.points[i].co=(*point,1);spline.points[i].radius=max(.12,math.sin(math.pi*i/(len(points)-1))**.35)
lash=bpy.data.objects.new('Link_upper_lash',curve);scene.collection.objects.link(lash)
material=bpy.data.materials.new('Original warm lash roots');material.use_nodes=True
material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.026,.012,.006,1)
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.6;curve.materials.append(material)
bpy.ops.object.select_all(action='DESELECT');lash.select_set(True);bpy.context.view_layer.objects.active=lash;bpy.ops.object.convert(target='MESH');lash=bpy.context.object
for ob in [lids,lash]:
    ob.parent=rig;ob.vertex_groups.new(name='head').add(list(range(len(ob.data.vertices))),1,'REPLACE')
    ob.modifiers.new('Existing head bone','ARMATURE').object=rig
triangles=sum(len(p.vertices)-2 for ob in [lids,lash] for p in ob.data.polygons);assert triangles<3000,triangles
scene.render.filepath=str(root/'face-orbital-surface-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'orbital-surface-study.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted native eyelid surface; not exported','added_triangles':triangles,'segments':segments,'rings':rings}
(root/'orbital-surface-study.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
