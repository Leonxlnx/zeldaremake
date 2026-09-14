"""Fit the existing CC0 quad head to Link; preserve continuous eyelids and mouth."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix

root=Path(__file__).resolve().parent/'source-runtime'
shallow=bool(globals().get('JOB',{}).get('shallow',False))
version='v4' if shallow else 'v3';prefix='anatomical-topology-'+version+'-study'
name='Link | anatomical topology '+version+' study';assert name not in bpy.data.scenes
input_path=root/'anatomical-input-v6.blend'
assert hashlib.sha256(input_path.read_bytes()).hexdigest()==json.loads((root/'anatomical-input-v6.json').read_text())['sha256']
with bpy.data.libraries.load(str(input_path),link=False) as (_,loaded):
    loaded.objects=['Anatomical input head','Anatomical input eye L','Anatomical input eye R']
head,*helpers=loaded.objects
scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene
for ob in loaded.objects:scene.collection.objects.link(ob)
head.name='Link | anatomical topology '+version+' head'
source=bpy.data.scenes['Link | textured iris study v2']
before=[v.co.copy() for v in head.data.vertices]
eyes=[];centres=[]
for helper in helpers:
    low=Vector([min(v.co[a] for v in helper.data.vertices) for a in range(3)])
    high=Vector([max(v.co[a] for v in helper.data.vertices) for a in range(3)])
    centre=(low+high)/2;radius=(high-low)/2
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,location=centre)
    eye=bpy.context.object;eye.name='Link | anatomical continuous globe';eye.scale=radius
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for polygon in eye.data.polygons:polygon.use_smooth=True
    eyes.append(eye);centres.append(centre)
    assert len(helper.users_scene)==1;bpy.data.objects.remove(helper,do_unlink=True)

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def fit(p):
    x,y,z=p;front=1-smooth(-.015,.055,y)
    nx=x*.9
    nz=.971+(z-1.005)*(.75 if z<1.005 else (1.16-.971)/(1.16-1.005))
    # Short lower face, restrained muzzle and a larger eye opening in the same quad surface.
    nose=math.exp(-(x/.037)**2-((z-.970)/.025)**2)*front
    mouth=math.exp(-(x/.051)**4-((z-.933)/.022)**4)*front
    nx*=1-.10*mouth
    nz-=.008*nose+.005*mouth
    spread=math.exp(-((x-.04776)/.031)**2)-math.exp(-((x+.04776)/.031)**2)
    nx+=.01037*spread*math.exp(-((z-1.005)/.05)**4)*front
    eye_weight=max(math.exp(-((x-side*.04776)/.034)**4) for side in [-1,1])*front
    dz=nz-.971
    nz+=.014*(math.erf(dz/.010)-math.erf(dz/.065))*eye_weight
    ny=y-.015*front
    if shallow:
        depth=max(0,ny+.132)
        orbital=max(math.exp(-((nx-side*.0533)/.037)**4-((nz-.971)/.032)**4) for side in [-1,1])
        ny-=.75*depth*(1-smooth(.035,.085,depth))*orbital
    return Vector((nx,ny,nz))

assert abs(fit(Vector((0,-.12,1.0))).x)<1e-8
# Reject locally inverted deformations before changing any source vertex.
epsilon=1e-5;jacobians=[]
for p in before[::7]:
    columns=[]
    for axis in range(3):
        offset=Vector();offset[axis]=epsilon
        columns.append((fit(p+offset)-fit(p-offset))/(2*epsilon))
    jacobians.append(Matrix(columns).determinant())
assert min(jacobians)>.15,('Locally folding fit',min(jacobians))
for ob in [head,*eyes]:
    for vertex in ob.data.vertices:vertex.co=fit(vertex.co)
assert len(head.data.vertices)==len(before)
assert all(abs(fit(Vector((-p.x,p.y,p.z))).x+fit(p).x)<1e-7 for p in before[::31])
head.data.update();head['proportion_pass']=True

# The original globes follow the same deformation as their surrounding lids.
with bpy.data.libraries.load(str(root/'textured-iris-v2-study.blend'),link=False) as (available,loaded):
    names=[n for n in available.materials if 'living eyes' in n];assert len(names)==1,names;loaded.materials=names
for eye,centre in zip(eyes,centres):
    eye_material=loaded.materials[0].copy();nodes=eye_material.node_tree.nodes;links=eye_material.node_tree.links
    shader=nodes.get('Principled BSDF')
    for socket in ['Normal','Coat Normal']:
        for link in list(shader.inputs[socket].links):links.remove(link)
    active=set();pending=[link.from_node for link in shader.inputs['Base Color'].links]
    while pending:
        node=pending.pop()
        if node in active:continue
        active.add(node);pending.extend(link.from_node for socket in node.inputs for link in socket.links)
    coords=[node for node in active if node.type=='TEX_COORD'];assert len(coords)==1,len(coords)
    coord=coords[0];destinations=[link.to_socket for link in coord.outputs['Generated'].links]
    subtract=nodes.new('ShaderNodeVectorMath');subtract.operation='SUBTRACT';subtract.inputs[1].default_value=fit(centre);links.new(coord.outputs['Object'],subtract.inputs[0])
    scale=nodes.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs['Scale'].default_value=1/.056;links.new(subtract.outputs[0],scale.inputs[0])
    offset=nodes.new('ShaderNodeVectorMath');offset.operation='ADD';offset.inputs[1].default_value=(.5,.5,.5);links.new(scale.outputs[0],offset.inputs[0])
    for socket in destinations:links.new(offset.outputs[0],socket)
    eye.data.materials.clear();eye.data.materials.append(eye_material)

material=head.data.materials[0].copy();head.data.materials[0]=material
nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
colour=head.data.color_attributes.new(name='Anatomical skin tint',type='FLOAT_COLOR',domain='POINT')
lip_group=head.vertex_groups['lips'].index
for vertex,value in zip(head.data.vertices,colour.data):
    lip=max((g.weight for g in vertex.groups if g.group==lip_group),default=0)
    value.color=(*Vector((.58,.36,.25)).lerp(Vector((.48,.21,.17)),lip*.32),1)
attribute=nodes.new('ShaderNodeVertexColor');attribute.layer_name=colour.name;links.new(attribute.outputs['Color'],shader.inputs['Base Color'])
shader.inputs['Roughness'].default_value=.48

scene.world=source.world
for collection in source.collection.children:scene.collection.children.link(collection)
scene.camera=source.camera.copy();scene.camera.data=source.camera.data.copy();scene.collection.objects.link(scene.camera)
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.37;scene.camera.location=(.12,-1,1.00)
scene.camera.rotation_euler=(Vector((0,0,1.00))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.render.filepath=str(root/('face-'+prefix+'.png'));bpy.ops.render.render(write_still=True)
if shallow:
    location=scene.camera.location.copy();rotation=scene.camera.rotation_euler.copy()
    scene.camera.location=(.65,-.65,1.00);scene.camera.rotation_euler=(Vector((0,0,1.00))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(root/('side-'+prefix+'.png'));bpy.ops.render.render(write_still=True)
    scene.camera.location=location;scene.camera.rotation_euler=rotation
bpy.data.libraries.write(str(root/(prefix+'.blend')),{scene},fake_user=True,compress=True)
record={'status':'Isolated anatomical proportion study, not exported or accepted','source':'MPFB 2.0.17 CC0 core head, pinned80919fa4682335c41847f761a4d79dcad4124732','input_sha256':hashlib.sha256(input_path.read_bytes()).hexdigest(),'vertices':len(before),'base_faces':len(head.data.polygons),'max_vertex_move_metres':max((v.co-p).length for v,p in zip(head.data.vertices,before)),'min_sampled_jacobian':min(jacobians),'jacobian_samples':len(jacobians),'method':'Bounded symmetric eye-opening field on existing quad anatomy; original globes and lids receive the identical deformation; source iris material'}
record.update(globe_method='Native 64x32 UV spheres at original helper bounds, same deformation as head',iris_radius_metres=.028*.61,iris_coordinates='Object-space circle, independent of deformed globe aspect ratio')
record['orbital_depth_compression']={'strength':.75,'front_plane_y':-.132,'fade_depth_metres':[.035,.085]} if shallow else None
(root/(prefix+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
