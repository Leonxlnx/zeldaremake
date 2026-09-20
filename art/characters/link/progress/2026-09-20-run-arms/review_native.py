"""Compare arm/body intersections across a full native loop and render matched key poses."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
job=globals().get('JOB',{})
out=Path(job.get('out',Path(__file__).resolve().parent))
candidate=json.loads((out/job.get('study','relaxed-run-study.json')).read_text())['scene']
report=[]
for label,name in [('before',job.get('before','Link | September19 retained hips flight')),('after',candidate)]:
    s=bpy.data.scenes[name];bpy.context.window.scene=s
    r=next(o for o in s.objects if o.type=='ARMATURE')
    body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
    m=body.data;m.calc_loop_triangles()
    groups={g.index for g in body.vertex_groups if g.name.startswith(('shoulder','elbow','hand'))}
    weights=[sum(g.weight for g in v.groups if g.group in groups) for v in m.vertices]
    arms=[tuple(t.vertices) for t in m.loop_triangles if all(weights[i]>.5 for i in t.vertices)]
    torso=[tuple(t.vertices) for t in m.loop_triangles if all(weights[i]<.2 for i in t.vertices)]
    st=r.animation_data.nla_tracks['run'].strips[0]
    r.animation_data.action=st.action;r.animation_data.action_slot=st.action_slot
    rows=[]
    try:
        for i in range(113):
            s.frame_set(i);s.view_layers[0].update();dg=bpy.context.evaluated_depsgraph_get();dg.update()
            points=[v.co.copy() for v in body.evaluated_get(dg).data.vertices]
            collisions=BVHTree.FromPolygons(points,arms,all_triangles=True).overlap(BVHTree.FromPolygons(points,torso,all_triangles=True))
            er=r.evaluated_get(dg)
            below=sum(any(points[k].z<.69 for k in arms[a]) for a,b in collisions)
            rows.append({'frame':i,'contacts':len(collisions),'contacts_below_armpit':below,'hands':{side:list(er.pose.bones['hand'+side].head) for side in ['L','R']}})
        assert all(math.dist(rows[0]['hands'][side],rows[-1]['hands'][side])<1e-6 for side in ['L','R'])
        camera=s.camera;camera.data.type='ORTHO';camera.data.ortho_scale=1.45
        camera.location=(1.5,-3,1.25);camera.rotation_euler=(Vector((0,0,.59))-camera.location).to_track_quat('-Z','Y').to_euler()
        s.render.resolution_x=640;s.render.resolution_y=760;s.cycles.device='CPU';s.cycles.samples=16
        s.render.threads_mode='FIXED';s.render.threads=4
        for frame in ([] if globals().get('CHECK_ONLY') else [0,28,56,84]):
            s.frame_set(frame);s.render.filepath=str(out/f'run-{frame}-{label}.png');bpy.ops.render.render(write_still=True)
    finally:r.animation_data.action=None;s.frame_set(0)
    report.append({'variant':label,'scene':name,'contacts_total':sum(r['contacts'] for r in rows),'contacts_peak':max(r['contacts'] for r in rows),'contacts_below_armpit':sum(r['contacts_below_armpit'] for r in rows),'rows':rows})
(out/'native-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k!='rows'} for r in report]))
