"""Surface-guided native curve fibres over the preserved hair silhouette."""
import bpy,json,math,random,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

root=Path(__file__).resolve().parent/'source-runtime'
dense=bool(globals().get('JOB',{}).get('dense',False));stem='hair-dense-study' if dense else 'hair-strand-study'
name='Link | hair dense study' if dense else 'Link | hair strand study';assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'eye-candidate.blend'),link=False) as (available,loaded):loaded.scenes=['Link | source eye study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
camera=scene.camera;camera.data.type='ORTHO';camera.data.ortho_scale=.46;camera.location=(.5,-3,1.13)
camera.rotation_euler=(Vector((0,0,1.015))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get());mesh=body.data
albedo=body.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
pixels=np.empty(len(albedo.pixels),dtype=np.float32);albedo.pixels.foreach_get(pixels);width,height=albedo.size
right=camera.matrix_world.to_3x3()@Vector((1,0,0));up=camera.matrix_world.to_3x3()@Vector((0,1,0));direction=camera.matrix_world.to_3x3()@Vector((0,0,-1))
frame=camera.data.view_frame(scene=scene);left=min(v.x for v in frame);right_edge=max(v.x for v in frame)
bottom=min(v.y for v in frame);top=max(v.y for v in frame)
def surface(pixel):
    origin=camera.location+right*(left+pixel.x/720*(right_edge-left))+up*(top-pixel.y/820*(top-bottom))
    hit,normal,index,distance=tree.ray_cast(origin,direction)
    if hit is None:return None
    polygon=mesh.polygons[index];assert len(polygon.vertices)==3
    positions=[mesh.vertices[v].co for v in polygon.vertices]
    coords=[Vector((*mesh.uv_layers.active.data[i].uv,0)) for i in polygon.loop_indices]
    uv=barycentric_transform(hit,*positions,*coords)
    x=max(0,min(width-1,int(uv.x*width)));y=max(0,min(height-1,int(uv.y*height)))
    r,g,b=pixels[(y*width+x)*4:(y*width+x)*4+3]
    if not(r>.35 and r>g*1.1 and g>b*1.25 and b/r<.58):return None
    return hit+normal*(.00028 if dense else .00018)

# Authored flow guides in the fixed portrait camera; samples are projected onto real hair.
guides=[
 [(351,318),(298,274),(218,290),(143,343),(67,415)],
 [(343,292),(285,285),(221,316),(170,374),(80,431)],
 [(350,319),(292,314),(247,360),(222,404),(174,451)],
 [(357,326),(333,350),(316,407),(292,475)],
 [(374,319),(414,284),(478,309),(523,371),(605,442)],
 [(380,312),(420,313),(463,357),(490,409),(550,448)],
 [(391,341),(422,365),(445,407),(468,445)],
 [(142,466),(122,513),(127,570),(100,622)],
 [(562,462),(599,508),(590,556),(563,612)],
]
rng=random.Random(130926);curve=bpy.data.curves.new('Fine guided hair fibres','CURVE');curve.dimensions='3D'
radius=.00022 if dense else .00014
curve.bevel_depth=radius;curve.bevel_resolution=0;curve.resolution_u=1;curve.use_fill_caps=True
counts=[]
for guide in guides:
    guide=[Vector(p) for p in guide];count=0
    for strand in range(81 if dense else 9):
        spread=14 if dense else 3.5
        offset=Vector((rng.uniform(-spread,spread),rng.uniform(-spread/2,spread/2)));points=[];runs=[]
        for segment in range(len(guide)-1):
            a=guide[max(0,segment-1)];b=guide[segment];c=guide[segment+1];d=guide[min(len(guide)-1,segment+2)]
            for step in range(12):
                t=step/12
                pixel=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)+offset
                point=surface(pixel)
                if point is None or (points and (point-points[-1]).length>.012):
                    runs.append(points);points=[]
                if point is not None:points.append(point)
        runs.append(points);points=max(runs,key=len)
        if len(points)<8:continue
        spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
        for i,point in enumerate(points):
            spline.points[i].co=(*point,1);spline.points[i].radius=max(.06,math.sin(math.pi*(i+.5)/len(points))**.35)
        count+=1
    counts.append(count)
assert sum(counts)>=25,counts
del pixels
hair=bpy.data.objects.new('Link_hair_fine',curve);scene.collection.objects.link(hair)
material=bpy.data.materials.new('Original fine golden hair');material.use_nodes=True
shader=material.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(.48,.235,.065,1);shader.inputs['Roughness'].default_value=.38
curve.materials.append(material)
bpy.ops.object.select_all(action='DESELECT');hair.select_set(True);bpy.context.view_layer.objects.active=hair
bpy.ops.object.convert(target='MESH')
hair=bpy.context.object;hair.parent=rig;hair.vertex_groups.new(name='head').add(list(range(len(hair.data.vertices))),1,'REPLACE')
modifier=hair.modifiers.new('Existing head bone','ARMATURE');modifier.object=rig
triangles=sum(len(p.vertices)-2 for p in hair.data.polygons);assert 1000<triangles<(300000 if dense else 40000),triangles
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.filepath=str(root/('face-'+stem+'.png'));bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/(stem+'.blend')),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted native hair-fibre study; not exported','strands_per_guide':counts,'strands':sum(counts),'added_triangles':triangles,'radius_metres':radius,'seed':130926}
(root/(stem+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
