"""Fine rooted tip strands on the current hair, using the existing authored flow guides."""
import bpy,ast,json,math,random,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
out=Path(__file__).resolve().parent
s=bpy.context.scene
body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>10000)
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
material=body.data.materials[0];normal=material.node_tree.nodes['Principled BSDF'].inputs['Normal'].links[0].from_node
oldnode=next(n for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.name.startswith('nose-zero-margin normal'))
material.node_tree.links.new(oldnode.outputs['Color'],normal.inputs['Color'])
camera=s.camera;camera.data.ortho_scale=.46
camera.location=(.5,-3,1.13);camera.rotation_euler=(Vector((0,0,1.015))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
mesh=body.data;mesh.calc_loop_triangles();positions=[body.matrix_world@v.co for v in mesh.vertices]
tree=BVHTree.FromPolygons(positions,[t.vertices[:] for t in mesh.loop_triangles],all_triangles=True)
albedo=material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
pixels=np.empty(len(albedo.pixels),dtype=np.float32);albedo.pixels.foreach_get(pixels);width,height=albedo.size
right=camera.matrix_world.to_3x3()@Vector((1,0,0));up=camera.matrix_world.to_3x3()@Vector((0,1,0));direction=camera.matrix_world.to_3x3()@Vector((0,0,-1))
frame=camera.data.view_frame(scene=s);left=min(v.x for v in frame);right_edge=max(v.x for v in frame);bottom=min(v.y for v in frame);top=max(v.y for v in frame)
groom=False;wisps=True;dense=False
source=Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/study_hair_strands.py')
parsed=ast.parse(source.read_text());parts=[n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name=='surface' or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='guides' for t in n.targets)]
assert len(parts)==2;exec(compile(ast.Module(body=parts,type_ignores=[]),str(source),'exec'))
curve=bpy.data.curves.new('Rooted fine hair tips','CURVE');curve.dimensions='3D';curve.bevel_depth=.0003;curve.bevel_resolution=0;curve.resolution_u=1
rng=random.Random(160926);count=0;gaps=[]
for guide in guides:
    guide=[Vector(p) for p in guide]
    for strand in range(4):
        offset=Vector((rng.uniform(-7,7),rng.uniform(-3,3)));runs=[[]]
        for segment in range(len(guide)-1):
            a,b,c,d=guide[max(0,segment-1)],guide[segment],guide[segment+1],guide[min(len(guide)-1,segment+2)]
            for step in range(14):
                t=step/14;p=surface(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)+offset)
                if p is None or runs[-1] and (p-runs[-1][-1]).length>.012:
                    if runs[-1]:runs.append([])
                if p is not None:runs[-1].append(p)
        points=max(runs,key=len)
        if len(points)<8:continue
        points=points[-6:];tangent=(points[-1]-points[-3]).normalized();anchor=points[-1].copy();length=rng.uniform(.009,.016)
        for j in range(1,10):
            t=j/9;points.append(anchor+tangent*(length*t)-direction*(.003*math.sin(math.pi*t/2))+Vector((0,0,-.001*t*t)))
        # Reject a tip that dives into skin/another clump, rather than hiding intersections.
        if any(tree.find_nearest(p)[3]<.00035 for p in points[7:]):continue
        gaps.append(tree.find_nearest(points[0])[3]);count+=1
        spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
        for i,p in enumerate(points):
            spline.points[i].co=(*p,1);spline.points[i].radius=(.35+.65*min(1,i/3))*(1-i/len(points))**.7
assert 12<=count<=36 and max(gaps)<.0005,(count,gaps)
hair=bpy.data.objects.new('Link | fine rooted hair tips',curve);s.collection.objects.link(hair)
bpy.ops.object.select_all(action='DESELECT');hair.select_set(True);bpy.context.view_layer.objects.active=hair;bpy.ops.object.convert(target='MESH');hair=bpy.context.object
# Inherit the existing albedo via projected source UVs; preserve proper strand geometry normals.
uv=hair.data.uv_layers.new(name='UVMap')
for loop in hair.data.loops:
    hit,n,index,distance=tree.find_nearest(hair.data.vertices[loop.vertex_index].co)
    tri=mesh.loop_triangles[index]
    coord=barycentric_transform(hit,*[positions[v] for v in tri.vertices],*[Vector((*mesh.uv_layers.active.data[i].uv,0)) for i in tri.loops])
    uv.data[loop.index].uv=(coord.x,coord.y)
mat=bpy.data.materials.new('Hair tips | source albedo');mat.use_nodes=True
p=mat.node_tree.nodes['Principled BSDF'];p.inputs['Roughness'].default_value=.5
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=albedo;mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
hair.data.materials.append(mat)
for poly in hair.data.polygons:poly.use_smooth=True
hair.parent=rig;hair.vertex_groups.new(name='head').add(list(range(len(hair.data.vertices))),1,'REPLACE');hair.modifiers.new('Existing head bone','ARMATURE').object=rig
tris=sum(len(p.vertices)-2 for p in hair.data.polygons);assert tris<6000
s.render.filepath=str(out/'tips-after.png');bpy.ops.render.render(write_still=True)
rig.data.pose_position='POSE'
bpy.data.libraries.write(str(out/'hair-tips-study.blend'),{s},fake_user=True,compress=True)
(out/'tips-review.json').write_text(json.dumps({'status':'Native geometry candidate; visual review pending','strands':count,'triangles':tris,'maximum_root_gap_m':max(gaps),'rooted_to_existing_head':True,'new_materials':1},indent=2))
