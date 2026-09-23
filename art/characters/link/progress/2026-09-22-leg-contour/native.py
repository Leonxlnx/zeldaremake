"""One isolated Blender contour study; preserves the accepted scene and runtime asset."""
import bpy, hashlib, importlib.util, json
from pathlib import Path

out = Path(__file__).resolve().parent
def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

profile = module('contour_profile', out/'field.py')
prior = module('prior_boot_normals', out.parent/'2026-09-20-run-arms/boots.py')
assert profile.self_check()['pass']
asset = out.parents[4]/'public/models/link/link-runtime.glb'
assert hashlib.sha256(asset.read_bytes()).hexdigest() == profile.SOURCE_SHA
name = 'Link | September22 calf and cuff contour'
assert name not in bpy.data.scenes and not (out/'native-summary.json').exists()
baseline = bpy.data.scenes['Link | September21 shorter boot tips']
original = next(o for o in baseline.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
bpy.context.window.scene = baseline
bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = name
body = next(o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) > 30000)
assert body.data is not original.data
mesh = body.data
normals = [tuple(n.vector) for n in original.data.corner_normals]
rows, jacobians = [], {}
for v in original.data.vertices:
    p = tuple(v.co)
    q, j = profile.field(p)
    if q == p:
        continue
    assert .15 < p[2] < .325 and q[1:] == p[1:]
    jacobians[v.index] = j
    for key in mesh.shape_keys.key_blocks:
        key.data[v.index].co.x += q[0]-p[0]
    mesh.vertices[v.index].co = q
    rows.append({'index':v.index, 'before':[p[0],p[2],-p[1]], 'after':[q[0],q[2],-q[1]]})
assert rows
mesh.normals_split_custom_set([prior.normal(n, jacobians[loop.vertex_index])
    if loop.vertex_index in jacobians else n for n, loop in zip(normals, mesh.loops)])
mesh.update()
for a, b in zip(original.data.vertices, mesh.vertices):
    assert [(g.group,g.weight) for g in a.groups] == [(g.group,g.weight) for g in b.groups]
    if a.index not in jacobians:
        assert tuple(a.co) == tuple(b.co)
assert len(original.data.polygons) == len(mesh.polygons)
summary = {'source_sha256':profile.SOURCE_SHA, 'scene':name, 'changed_native_vertices':len(rows),
    'max_lateral_displacement_m':max(abs(r['after'][0]-r['before'][0]) for r in rows),
    'height_depth_weights_topology_unchanged':True, 'status':'Native preview only; no runtime export'}
(out/'native-rows.json').write_text(json.dumps(rows),encoding='utf-8')
(out/'native-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
bpy.data.libraries.write(str(out/'calf-cuff-study.blend'),{scene},fake_user=True,compress=True)
print(json.dumps(summary))
