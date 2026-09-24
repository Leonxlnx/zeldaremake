"""Root-run isolated strap chest-weight preview. No export or source-scene edit."""
import bpy, hashlib, json, math
from pathlib import Path
from mathutils import Matrix, Vector

out = Path(globals().get('OUTPUT_DIR', Path(__file__).resolve().parent))
side = globals().get('SIDE', 'L')
assert side in ('L', 'R')
shoulder = 'shoulder'+side
expected_rows = globals().get('EXPECTED_ROWS', 243)
island_raw = (out / 'head-island.json').read_bytes()
island = json.loads(island_raw)
look_raw = Path(globals().get('LOOK_REPORT', out/'patch-look.json')).read_bytes()
look = json.loads(look_raw)
baseline = bpy.data.scenes[globals().get('BASELINE_SCENE', 'Link | September21 shorter boot tips')]
name = globals().get('SCENE_NAME', 'Link | September22 isolated strap chest preview')
assert name not in bpy.data.scenes, 'Keep the first preview immutable'
selected = {v['index'] for v in island['vertices']}
assert len(selected) == expected_rows and all(v['weights'] == {'head': 1} for v in island['vertices'])
original_scene = bpy.context.window.scene
source_body = next(o for o in baseline.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
source_rig = next(o for o in baseline.objects if o.type == 'ARMATURE')
run_strip = source_rig.animation_data.nla_tracks['run'].strips[0]
run_action, run_slot = run_strip.action, run_strip.action_slot
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
def matrix(values):
    return Matrix([values[i::4] for i in range(4)])
def weights(body):
    names = {g.index: g.name for g in body.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if g.weight} for v in body.data.vertices]
def geometry(mesh):
    receipt = hashlib.sha256()
    for vertex in mesh.vertices: receipt.update(repr(tuple(vertex.co)).encode())
    for polygon in mesh.polygons: receipt.update(repr(tuple(polygon.vertices)).encode())
    for layer in mesh.uv_layers:
        for entry in layer.data: receipt.update(repr(tuple(entry.uv)).encode())
    return receipt.hexdigest()
source_geometry, source_weights = geometry(source_body.data), weights(source_body)
rows, candidate_look_points = [], []
try:
    bpy.context.window.scene = baseline
    bpy.ops.scene.new(type='FULL_COPY')
    scene = bpy.context.scene
    scene.name = name
    body = next(o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    assert body.data is not source_body.data
    assert geometry(body.data) == source_geometry and weights(body) == source_weights
    if body.data.shape_keys:
        assert body.data.shape_keys is not source_body.data.shape_keys
        body.data.shape_keys.animation_data_clear()
        for key in body.data.shape_keys.key_blocks: key.value = 0
    for v in island['vertices']:
        assert (body.data.vertices[v['index']].co-C @ Vector(v['rest'])).length < 3e-6
        assert source_weights[v['index']] == {'head': 1}
    body.data.calc_loop_triangles()
    edges = {}
    for face, indices in island['faceVertices'].items():
        assert list(body.data.loop_triangles[int(face)].vertices) == indices
        for a, b in zip(indices, indices[1:]+indices[:1]):
            if (a in selected) == (b in selected): continue
            if b in selected: a, b = b, a
            key = (tuple(body.data.vertices[a].co), tuple(body.data.vertices[b].co))
            outside = source_weights[b]
            assert outside in ({'chest': 1}, {shoulder: 1})
            edges[key] = {'a': a, 'b': b, 'outsideBone': next(iter(outside)),
                          'restM': (body.data.vertices[a].co-body.data.vertices[b].co).length}
    edges = list(edges.values())
    head_group, chest_group = body.vertex_groups['head'], body.vertex_groups['chest']
    def set_weight(chest):
        (head_group if chest else chest_group).remove(list(selected))
        (chest_group if chest else head_group).add(list(selected), 1, 'REPLACE')
        scene.view_layers[0].update()
    inverse = dict(zip(look['boneNames'], look['inverseBindMatrices']))
    def pose(row):
        # Keep the copied clip tracks for later native review; only disable their evaluation.
        rig.animation_data_create()
        rig.animation_data.action = None
        for track in rig.animation_data.nla_tracks: track.mute = True
        if row['name'] == 'run-rear-phase102':
            rig.animation_data_create()
            rig.animation_data.action = run_action
            rig.animation_data.action_slot = run_slot
            frame = run_action.frame_range[1] * (102/112)
            scene.frame_set(math.floor(frame), subframe=frame-math.floor(frame))
        else:
            posed = dict(zip(look['boneNames'], row['boneWorldMatrices']))
            for bone in sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive)):
                delta = C @ matrix(posed[bone.name]) @ matrix(inverse[bone.name]) @ C.inverted()
                bone.matrix = delta @ bone.bone.matrix_local
                scene.view_layers[0].update()
    def points():
        graph = bpy.context.evaluated_depsgraph_get()
        graph.update()
        evaluated = body.evaluated_get(graph)
        return [evaluated.matrix_world @ v.co for v in evaluated.data.vertices]
    scene.camera.data = scene.camera.data.copy()
    scene.camera.data.type, scene.camera.data.ortho_scale = 'ORTHO', .22
    scene.camera.data.clip_start = .01
    sign = 1 if side == 'L' else -1
    scene.camera.location = (1.3*sign, -.04, .75)
    scene.camera.rotation_euler = (Vector((.12*sign, .07, .83))-scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1200, 1000, 100
    scene.render.image_settings.file_format = 'PNG'
    lamp = bpy.data.lights.new('Strap weight preview rear fill', type='AREA')
    lamp.energy, lamp.shape, lamp.size = 70, 'DISK', 1
    fill = bpy.data.objects.new(lamp.name, lamp)
    scene.collection.objects.link(fill)
    fill.location = (0, 1.5, 1.4)
    fill.rotation_euler = (Vector((0, .05, .85))-fill.location).to_track_quat('-Z', 'Y').to_euler()
    scenarios = [r for r in look['scenarios'] if r['name'] in ('neutral', 'target-left30-default', 'target-right30-default')]
    if globals().get('INCLUDE_RUN', True): scenarios.append({'name': 'run-rear-phase102'})
    for row in scenarios:
        pose(row)
        variants = []
        bone_matrices = [[list(r) for r in b.matrix] for b in rig.pose.bones]
        for candidate in (False, True):
            set_weight(candidate)
            current = points()
            assert [[list(r) for r in b.matrix] for b in rig.pose.bones] == bone_matrices
            maximum = 0
            if 'boneWorldMatrices' in row:
                posed = dict(zip(look['boneNames'], row['boneWorldMatrices']))
                bone = 'chest' if candidate else 'head'
                skin = C @ matrix(posed[bone]) @ matrix(inverse[bone])
                maximum = max((current[v['index']]-skin @ Vector(v['rest'])).length for v in island['vertices'])
                assert maximum < 5e-6, ('Native look parity', row['name'], candidate, maximum)
            lengths = [(current[e['a']]-current[e['b']]).length for e in edges]
            variants.append({'points': current, 'lengthsM': lengths, 'maxNativeLookErrorM': maximum})
        before, after = variants
        if 'boneWorldMatrices' in row:
            candidate_look_points.append([after['points'][i] for i in sorted(selected)])
        outside_error = max((before['points'][i]-after['points'][i]).length
                            for i in range(len(before['points'])) if i not in selected)
        assert outside_error == 0, ('Outside island positions changed', row['name'], outside_error)
        metrics = {}
        for bone in ('chest', shoulder):
            ids = [i for i, e in enumerate(edges) if e['outsideBone'] == bone]
            metrics[bone] = {'edges': len(ids), 'beforeMaxRestLengthErrorM': max(abs(before['lengthsM'][i]-edges[i]['restM']) for i in ids),
                             'afterMaxRestLengthErrorM': max(abs(after['lengthsM'][i]-edges[i]['restM']) for i in ids),
                             'maxLengthChangeM': max(abs(after['lengthsM'][i]-before['lengthsM'][i]) for i in ids)}
        rows.append({'pose': row['name'], 'outsideIslandVertexMaxChangeM': outside_error,
                     'selectedMaxChangeM': max((before['points'][i]-after['points'][i]).length for i in selected),
                     'nativeLookErrorBeforeM': before['maxNativeLookErrorM'], 'nativeLookErrorAfterM': after['maxNativeLookErrorM'],
                     'boundary': metrics, 'beforeEdgeLengthsM': before['lengthsM'], 'afterEdgeLengthsM': after['lengthsM']})
    look_error = max((p-q).length for pose_points in candidate_look_points[1:]
                     for p, q in zip(candidate_look_points[0], pose_points))
    look_edge_error = max(abs(a-b) for row in rows[1:3]
                          for a, b in zip(rows[0]['afterEdgeLengthsM'], row['afterEdgeLengthsM']))
    assert max(look_error, look_edge_error) < 5e-6, ('Look stretch remains', look_error, look_edge_error)
    if globals().get('RENDER', True):
        render_pose = 'target-left30-default' if side == 'L' else 'target-right30-default'
        pose(next(row for row in scenarios if row['name'] == render_pose))
        for candidate in (False, True):
            set_weight(candidate)
            scene.render.filepath = str(out / f"chest-preview-look-{'minus' if side == 'L' else 'plus'}15-{'candidate' if candidate else 'control'}.png")
            bpy.ops.render.render(write_still=True)
    final_weights = weights(body)
    assert all(final_weights[i] == ({'chest': 1} if i in selected else source_weights[i]) for i in range(len(final_weights)))
    assert geometry(body.data) == source_geometry
    assert geometry(source_body.data) == source_geometry and weights(source_body) == source_weights
    pose(scenarios[0])
    report = {'scene': name, 'assetSha256': island['assetSha256'],
              'islandReportSha256': hashlib.sha256(island_raw).hexdigest(), 'lookReportSha256': hashlib.sha256(look_raw).hexdigest(),
              'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'scope': f'{expected_rows} pure head rows changed to chest only in this preview copy. No export, no source scene/geometry/action edit.',
              'side': side, 'baselineScene': baseline.name,
              'restTopologyUvSha256': source_geometry, 'selectedRows': len(selected), 'mixedSelectedRows': 0,
              'candidateLookMaxPointChangeM': look_error, 'candidateLookMaxBoundaryLengthChangeM': look_edge_error,
              'boundaryUniqueWeightSums': island['boundaryUniqueWeightSums'], 'boundaryEdges': edges,
              'outsideWeightsExact': True, 'sourceExact': True, 'rows': rows}
    (out / 'chest-weight-preview.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'scene': name, 'rows': [{k: v for k, v in r.items() if 'EdgeLengths' not in k} for r in rows]}))
finally:
    bpy.context.window.scene = original_scene
