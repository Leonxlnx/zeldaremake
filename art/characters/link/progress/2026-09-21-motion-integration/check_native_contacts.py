"""Existing arm/body BVH check, sampled at the actual fractional-frame run duration."""
import bpy, json, math
from pathlib import Path
from mathutils.bvhtree import BVHTree

out = Path(__file__).resolve().parent
report = []
for label, name in [('before', 'Link | September21 stairs combined'), ('after', globals().get('CANDIDATE_SCENE', 'Link | September21 torso combined'))]:
    scene = bpy.data.scenes[name]
    bpy.context.window.scene = scene
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    body = next(o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
    mesh = body.data
    mesh.calc_loop_triangles()
    groups = {g.index for g in body.vertex_groups if g.name.startswith(('shoulder', 'elbow', 'hand'))}
    weights = [sum(g.weight for g in v.groups if g.group in groups) for v in mesh.vertices]
    arms = [tuple(t.vertices) for t in mesh.loop_triangles if all(weights[i] > .5 for i in t.vertices)]
    torso = [tuple(t.vertices) for t in mesh.loop_triangles if all(weights[i] < .2 for i in t.vertices)]
    strip = rig.animation_data.nla_tracks['run'].strips[0]
    rig.animation_data.action = strip.action
    rig.animation_data.action_slot = strip.action_slot
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rows = []
    for i in range(113):
        frame = strip.action.frame_range[1]*i/112
        scene.frame_set(int(frame), subframe=frame-int(frame))
        graph = bpy.context.evaluated_depsgraph_get()
        graph.update()
        points = [v.co.copy() for v in body.evaluated_get(graph).data.vertices]
        contacts = BVHTree.FromPolygons(points, arms, all_triangles=True).overlap(BVHTree.FromPolygons(points, torso, all_triangles=True))
        posed = rig.evaluated_get(graph)
        rows.append({'phase': i/112, 'contacts': len(contacts),
            'contacts_below_armpit': sum(any(points[k].z < .69 for k in arms[a]) for a,b in contacts),
            'hands': {side:list(posed.pose.bones['hand'+side].head) for side in ['L','R']}})
    assert all(math.dist(rows[0]['hands'][side], rows[-1]['hands'][side]) < 1e-5 for side in ['L','R'])
    report.append({'variant': label, 'scene': name, 'contacts_total': sum(r['contacts'] for r in rows),
        'contacts_peak': max(r['contacts'] for r in rows), 'contacts_below_armpit': sum(r['contacts_below_armpit'] for r in rows), 'rows': rows})
(out/globals().get('REPORT', 'native-contacts.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
assert report[1]['contacts_total'] <= report[0]['contacts_total'], 'Total arm/body intersections regressed'
assert report[1]['contacts_below_armpit'] <= report[0]['contacts_below_armpit'], 'Lower arm/body intersections regressed'
print(json.dumps([{k:v for k,v in r.items() if k != 'rows'} for r in report]))
