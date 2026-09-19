"""Define the existing upper eyelid margin without changing its geometry or blink."""
import bpy, collections, json
from pathlib import Path
from mathutils import Vector

out=Path(__file__).resolve().parent
s=bpy.context.scene
b=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
original=b.data;m=original.copy();b.data=m
edges=collections.Counter(e for f in m.polygons if f.material_index==1 for e in f.edge_keys)
adj=collections.defaultdict(set)
for (a,c),n in edges.items():
    if n==1:adj[a].add(c);adj[c].add(a)
left=set(adj);rings=[]
while left:
    todo=[min(left)];part=set()
    while todo:
        i=todo.pop()
        if i in part:continue
        part.add(i);todo.extend(adj[i]-part)
    left-=part
    if len(part)==64:rings.append(part)
assert len(rings)==2
selected=set()
for ring in rings:
    mid=(min(m.vertices[i].co.z for i in ring)+max(m.vertices[i].co.z for i in ring))/2
    upper={i for i in ring if m.vertices[i].co.z>mid+.001}
    selected.update(p.index for p in m.polygons if p.material_index==1 and any(i in upper for i in p.vertices) and p.center.z>mid)
assert 30<len(selected)<180,len(selected)
mat=bpy.data.materials.new('Original warm upper lash margin');mat.use_nodes=True
p=mat.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.055,.025,.012,1);p.inputs['Roughness'].default_value=.65
m.materials.append(mat)
for i in selected:m.polygons[i].material_index=len(m.materials)-1
rig=next(o for o in s.objects if o.type=='ARMATURE');pose=rig.data.pose_position;rig.data.pose_position='REST'
hidden={o.name:o.hide_render for o in s.objects}
for o in s.objects:
    if any(t in o.name for t in ['secondary hair','forearm guard','guard stitching']):o.hide_render=True
camera=s.camera;matrix=camera.matrix_world.copy();scale=camera.data.ortho_scale
focus=Vector((0,-.025,.97));camera.location=focus+Vector((0,-3,.04));camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.42
s.cycles.samples=24;s.render.threads=4
try:
    for label,mesh in [('before',original),('after',m)]:
        b.data=mesh;s.render.filepath=str(out/('lash-'+label+'.png'));bpy.ops.render.render(write_still=True)
    for weight in [.5,1]:
        m.shape_keys.key_blocks['blink'].value=weight
        s.render.filepath=str(out/('lash-blink-'+str(weight)+'.png'));bpy.ops.render.render(write_still=True)
    m.shape_keys.key_blocks['blink'].value=0
    assert [tuple(v.co) for v in m.vertices]==[tuple(v.co) for v in original.vertices]
    bpy.data.libraries.write(str(out/'lash-margin-study.blend'),{s},fake_user=True,compress=True)
    m.calc_loop_triangles()
    triangles=[[[float(m.vertices[i].co.x),float(m.vertices[i].co.z),float(-m.vertices[i].co.y)] for i in t.vertices] for t in m.loop_triangles if t.polygon_index in selected]
    (out/'lash-margin.json').write_text(json.dumps({'status':'Native material study; not exported','triangles':triangles,'selected_faces':len(selected),'positions_unchanged':True,'base_color':[.055,.025,.012,1],'roughness':.65},indent=2))
finally:
    m.shape_keys.key_blocks['blink'].value=0;b.data=original;rig.data.pose_position=pose
    camera.matrix_world=matrix;camera.data.ortho_scale=scale
    for o in s.objects:o.hide_render=hidden[o.name]
