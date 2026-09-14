"""Replace the cut socket region with lids welded into the existing face."""
import bpy,bmesh,json,math,collections
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

root=Path(__file__).resolve().parent/'source-runtime';name='Link | connected lid study v4'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'orbital-normal-study.blend'),link=False) as (_,loaded):
    loaded.scenes=['Link | orbital normal study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
eyes=sorted([o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name],key=lambda o:min(v.co.x for v in o.data.vertices))
points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
mesh=body.data;key=lambda co:tuple(round(c*1e6) for c in co)
original={tuple(sorted(key(mesh.vertices[v].co) for v in p.vertices)):{key(mesh.vertices[mesh.loops[i].vertex_index].co):mesh.corner_normals[i].vector.copy() for i in p.loop_indices} for p in mesh.polygons}
before=sum(len(p.vertices)-2 for p in mesh.polygons)
source=mesh.copy();source_uv=source.uv_layers.active.data
source_tree=BVHTree.FromPolygons([v.co for v in source.vertices],[p.vertices[:] for p in source.polygons],all_triangles=True)
for point in points:
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1,depth=.245,location=(point.x,-.1775,point.z),rotation=(math.pi/2,0,0))
    cutter=bpy.context.object;cutter.scale=(.037,.029,1)
    for material in mesh.materials:cutter.data.materials.append(material)
    for polygon in cutter.data.polygons:polygon.material_index=2
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
    modifier=body.modifiers.new('Regular orbital patch boundary','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name);bpy.data.objects.remove(cutter,do_unlink=True)
mesh=body.data
bm=bmesh.new();bm.from_mesh(mesh)
local=[v for v in bm.verts if v.co.y<-.05 and .93<v.co.z<1.015 and abs(v.co.x)<.105]
bmesh.ops.remove_doubles(bm,verts=local,dist=1e-7);bm.normal_update()
uv=bm.loops.layers.uv.active;blend=bm.verts.layers.float.new('Lid skin blend');report=[];new_keys=set()
for eye,point in zip(eyes,points):
    for vertex in eye.data.vertices:vertex.co.y-=.012
    eye.data.update();bpy.context.view_layer.update()
    tree=BVHTree.FromObject(eye,bpy.context.evaluated_depsgraph_get())
    chosen={f for f in bm.faces if f.material_index==2 and abs(f.calc_center_median().x-point.x)<.041}
    remaining=set(chosen);parts=[]
    while remaining:
        part=set();todo=[next(iter(remaining))]
        while todo:
            face=todo.pop()
            if face in part:continue
            part.add(face);remaining.discard(face)
            todo.extend(other for edge in face.edges for other in edge.link_faces if other in chosen and other not in part)
        parts.append(part)
    chosen=max(parts,key=len)
    # Separate clipped hair tips retain their closure and sample their original material.
    for part in parts:
        if part is chosen:continue
        assert len(part)<12,len(part)
        for face in part:
            face.material_index=0
            _,_,index,_=source_tree.find_nearest(face.calc_center_median());original_face=source.polygons[index]
            positions=[source.vertices[v].co for v in original_face.vertices]
            values=[Vector((*source_uv[i].uv,0)) for i in original_face.loop_indices]
            assert len(positions)==3
            for loop in face.loops:loop[uv].uv=barycentric_transform(loop.vert.co,*positions,*values).xy
    edges=[e for e in bm.edges if sum(f in chosen for f in e.link_faces)==1]
    adjacent=collections.defaultdict(list)
    for edge in edges:
        a,b=edge.verts;adjacent[a].append(b);adjacent[b].append(a)
    assert 20<len(edges)<600 and all(len(v)==2 for v in adjacent.values()),len(edges)
    outer=[next(iter(adjacent))];previous=None
    while True:
        following=next(v for v in adjacent[outer[-1]] if v!=previous)
        if following==outer[0]:break
        assert following not in outer,'Multiple or self-crossing boundary loops'
        previous=outer[-1];outer.append(following)
    assert len(outer)==len(edges)
    # Positive area in X/Z makes patch normals face -Y.
    if sum(a.co.x*b.co.z-b.co.x*a.co.z for a,b in zip(outer,outer[1:]+outer[:1]))<0:outer.reverse()
    angles=[math.atan2((v.co.z-point.z)/.029,(v.co.x-point.x)/.037) for v in outer]
    increments=[math.atan2(math.sin(b-a),math.cos(b-a)) for a,b in zip(angles,angles[1:]+angles[:1])]
    assert abs(sum(increments)-2*math.pi)<1e-4,'Boundary must wind around the eye once'
    positive=[max(.001,value) for value in increments];scale=2*math.pi/sum(positive)
    regular=[angles[0]]
    for value in positive[:-1]:regular.append(regular[-1]+scale*value)
    offset=math.atan2(sum(math.sin(a-b) for a,b in zip(angles,regular)),sum(math.cos(a-b) for a,b in zip(angles,regular)))
    displacement=[]
    for vertex,angle in zip(outer,regular):
        old=vertex.co.copy();angle+=offset
        vertex.co.x=point.x+.037*math.cos(angle);vertex.co.z=point.z+.029*math.sin(angle)
        displacement.append((vertex.co-old).length)
    assert max(displacement)<.01,max(displacement)
    edge_uv=[]
    for a,b in zip(outer,outer[1:]+outer[:1]):
        edge=next(e for e in a.link_edges if b in e.verts)
        face=next(f for f in edge.link_faces if f not in chosen)
        edge_uv.append(tuple(next(loop[uv].uv.copy() for loop in face.loops if loop.vert==v) for v in (a,b)))
    removed=len(chosen);bmesh.ops.delete(bm,geom=list(chosen),context='FACES')
    rings=[outer];segments=len(outer);steps=6;side=1 if point.x>0 else -1
    inner=[]
    for vertex in outer:
        angle=math.atan2((vertex.co.z-point.z)/.029,(vertex.co.x-point.x)/.037)
        c,s=math.cos(angle),math.sin(angle)
        position=Vector((point.x+.024*c,0,point.z+(.016 if s>=0 else .0125)*s+side*.001*c))
        hit,_,_,_=tree.ray_cast(Vector((position.x,-1,position.z)),Vector((0,1,0)))
        assert hit is not None,tuple(position)
        position.y=hit.y-.00035;inner.append(position)
    for step in range(1,steps+1):
        t=step/steps;ring=[]
        for vertex,target in zip(outer,inner):
            position=vertex.co.lerp(target,t)
            position.y=vertex.co.y*(1-t*t*(3-2*t))+target.y*t*t*(3-2*t)-.0012*math.sin(math.pi*t)
            hit,_,_,_=tree.ray_cast(Vector((position.x,-1,position.z)),Vector((0,1,0)))
            if hit is not None:position.y=min(position.y,hit.y-.0015)
            v=bm.verts.new(position);v[blend]=t;ring.append(v);new_keys.add(key(position))
        rings.append(ring)
    for a,b in zip(rings,rings[1:]):
        for i in range(segments):
            j=(i+1)%segments
            face=bm.faces.new((a[i],a[j],b[j],b[i]));face.material_index=2;face.smooth=True
            u,v=edge_uv[i]
            for loop,value in zip(face.loops,(u,v,v,u)):loop[uv].uv=value
    report.append({'removed_faces':removed,'boundary_vertices':segments,'added_quads':steps*segments,'boundary_max_displacement_metres':max(displacement)})
bm.normal_update();bm.to_mesh(mesh);bm.free();mesh.update()
bpy.data.meshes.remove(source)
# Restore unchanged corners exactly; smooth the joined patch and its boundary.
smooth=collections.defaultdict(Vector)
for polygon in mesh.polygons:
    coords=[mesh.vertices[v].co for v in polygon.vertices]
    for i,co in enumerate(coords):
        a,b=coords[i-1]-co,coords[(i+1)%len(coords)]-co
        if min(a.length,b.length)>1e-10:smooth[key(co)]+=polygon.normal*a.angle(b)
normals=[];matched=0
for polygon in mesh.polygons:
    old=original.get(tuple(sorted(key(mesh.vertices[v].co) for v in polygon.vertices)))
    if old:matched+=1
    for i in polygon.loop_indices:
        co=mesh.vertices[mesh.loops[i].vertex_index].co;k=key(co)
        radius=min((co-point).length for point in points)
        weight=max(0,min(1,(.052-radius)/.014));weight=weight*weight*(3-2*weight)
        normal=smooth[k].normalized()
        if old:normal=old[k].lerp(normal,weight).normalized()
        normals.append(normal)
    if not old or any(min((mesh.vertices[v].co-point).length for point in points)<.052 for v in polygon.vertices):polygon.use_smooth=True
mesh.normals_split_custom_set(normals)
triangles=sum(len(p.vertices)-2 for p in mesh.polygons)
assert triangles<before+5000,(before,triangles)
assert matched>45000,matched
assert not any(p.normal.y>1e-5 for p in mesh.polygons if p.material_index==2),'Folded lid surface'
head=body.vertex_groups['head'];head.add([v.index for v in mesh.vertices if key(v.co) in new_keys],1,'REPLACE')
# ponytail: the new lid interior uses a native skin sample; add authored variation after its shape is accepted.
material=mesh.materials[2].copy();mesh.materials[2]=material
nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes['Principled BSDF']
source=shader.inputs['Base Color'].links[0].from_socket
sample=json.loads((root/'eye-study.json').read_text())['skin_sample_uv']
skin=nodes.new('ShaderNodeTexImage');skin.image=source.node.image
constant_uv=nodes.new('ShaderNodeCombineXYZ');constant_uv.inputs['X'].default_value=sample[0];constant_uv.inputs['Y'].default_value=sample[1]
links.new(constant_uv.outputs[0],skin.inputs['Vector'])
attribute=nodes.new('ShaderNodeAttribute');attribute.attribute_name='Lid skin blend'
fade=nodes.new('ShaderNodeMapRange');fade.interpolation_type='SMOOTHSTEP';fade.clamp=True;fade.inputs['From Max'].default_value=.33
links.new(attribute.outputs['Fac'],fade.inputs['Value'])
mix=nodes.new('ShaderNodeMixRGB');links.new(fade.outputs['Result'],mix.inputs[0]);links.new(source,mix.inputs[1]);links.new(skin.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],shader.inputs['Base Color'])
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/'face-connected-lid-study-v4.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'connected-lid-study-v4.blend'),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted connected eyelid topology study; not exported','eyes':report,'body_triangles':triangles,'preserved_faces':matched,'eye_shift_metres':-.012}
record['backward_patch_quads']=sum(p.normal.y>1e-5 for p in mesh.polygons if p.material_index==2)
(root/'connected-lid-study-v4.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
