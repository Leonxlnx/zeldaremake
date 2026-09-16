"""Remove disconnected short crown strands; retain complete longer fringe locks."""
import bpy,bmesh,json
from pathlib import Path
out=Path(__file__).resolve().parent;s=bpy.context.scene
h=next(o for o in s.objects if o.type=='MESH' and 'secondary hair' in o.name)
original=h.data;h.data=original.copy();m=h.data
adj=[set() for v in m.vertices]
for e in m.edges:
 a,b=e.vertices;adj[a].add(b);adj[b].add(a)
seen=set();removed=set();count=0
for v in m.vertices:
 if v.index in seen:continue
 stack=[v.index];seen.add(v.index);component=[]
 while stack:
  i=stack.pop();component.append(i)
  for j in adj[i]-seen:seen.add(j);stack.append(j)
 x=sum(m.vertices[i].co.x for i in component)/len(component)
 z=max(m.vertices[i].co.z for i in component)
 # Short crown fragments and the central crossing fan identified in the portrait.
 if (len(component)<250 and z>1.085) or (abs(x)<.025 and z>1.05):
  removed.update(component);count+=1
assert 0<len(removed)<len(m.vertices)/2
bm=bmesh.new();bm.from_mesh(m);bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[bm.verts[i] for i in removed],context='VERTS');bm.to_mesh(m);bm.free();m.update();m.calc_loop_triangles()
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
copy=h.copy();copy.data=m.copy();copy.modifiers.clear();copy.parent=None;copy.name='Review hair addition'
# A temporary single-object scene avoids exporting selections from other study scenes.
isolated=bpy.data.scenes.new('Hair export only');isolated.collection.objects.link(copy);bpy.context.window.scene=isolated
try:
 bpy.ops.export_scene.gltf(filepath=str(out/'hair-addition.glb'),export_format='GLB',use_active_scene=True,export_animations=False,export_skins=False,export_vertex_color='ACTIVE')
finally:
 bpy.context.window.scene=s;bpy.data.objects.remove(copy,do_unlink=True);bpy.data.scenes.remove(isolated);rig.data.pose_position='POSE'
bpy.data.libraries.write(str(out/'hair-locks-clean-crown-study.blend'),{s},fake_user=True,compress=True)
(out/'crown-cleanup.json').write_text(json.dumps({'removed_components':count,'removed_vertices':len(removed),'remaining_triangles':len(m.loop_triangles),'status':'Candidate; matched runtime review required'},indent=2))
print((out/'crown-cleanup.json').read_text())
