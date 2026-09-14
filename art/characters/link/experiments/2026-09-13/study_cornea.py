"""Test a smooth corneal bulge on the reviewed eyes, preserving iris coordinates."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector

depth=float(globals().get('JOB',{}).get('depth',.003));assert depth in {.003,.012}
stem='corneal-surface-v2-study' if depth>.003 else 'corneal-surface-study'
root=Path(__file__).resolve().parent/'source-runtime';name='Link | corneal surface v2 study' if depth>.003 else 'Link | corneal surface study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'textured-iris-v2-study.blend'),link=False) as (_,loaded):loaded.scenes=['Link | textured iris study v2']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name];assert len(eyes)==2
material=eyes[0].data.materials[0].copy();shader=material.node_tree.nodes['Principled BSDF']
for link in list(shader.inputs['Coat Normal'].links):material.node_tree.links.remove(link)
records=[]
for eye in eyes:
    before=[v.co.copy() for v in eye.data.vertices]
    low=Vector([min(p[a] for p in before) for a in range(3)]);high=Vector([max(p[a] for p in before) for a in range(3)])
    centre=(low+high)/2;radius=(high-low)/2
    for v in eye.data.vertices:
        r=math.hypot((v.co.x-centre.x)/radius.x,(v.co.z-centre.z)/radius.z)
        if v.co.y<centre.y and r<.8:v.co.y-=depth*(1-(r/.8)**2)**2
    if eye.data.has_custom_normals:eye.data.normals_split_custom_set([(0,0,0)]*len(eye.data.loops))
    eye.data.update()
    eye.data.materials[0]=material
    assert all(v.co.x==p.x and v.co.z==p.z for v,p in zip(eye.data.vertices,before))
    moved=[(v.co-p).length for v,p in zip(eye.data.vertices,before)]
    assert abs(max(moved)-depth)<1e-6,max(moved)
    records.append({'eye':eye.name,'vertices':len(before),'moved_vertices':sum(d>0 for d in moved),'max_move_metres':max(moved),'iris_xz_unchanged':True})
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.filepath=str(root/('face-'+stem+'.png'));bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/(stem+'.blend')),{scene},fake_user=True,compress=True)
record={'status':'Isolated original-eye corneal study, not exported or accepted','source':'Reviewed textured-iris-v2-study.blend','method':'Convex front bulge, zero displacement/slope at 80% globe radius; unchanged X/Z iris mapping; geometric coat normals','depth_metres':depth,'eyes':records}
(root/(stem+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
