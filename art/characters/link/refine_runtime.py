"""Validate authored rest geometry and repair degenerate export tangents."""
import bpy
import bmesh
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
scene=bpy.data.scenes['Link | runtime'];bpy.context.window.scene=scene
record=json.loads(scene['pipeline'])

assert record.get('source_rest_shapes_authored'), 'Rest geometry must be authored before baking'

eyes=bpy.data.objects[record['groups']['eyes']['object']]
assert eyes.get('iris_occlusion_refined'), 'Rebuild eyes from the authored almond source first'
for info in record['groups'].values():
    geometry=bpy.data.objects[info['object']].data
    if any(p.area<1e-9 for p in geometry.polygons):
        # Collapsed faces have undefined UV tangents; retain every visible surface.
        bm=bmesh.new();bm.from_mesh(geometry)
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-9],context='FACES_ONLY')
        bm.to_mesh(geometry);bm.free();geometry.update()
    assert all(p.area>=1e-9 for p in geometry.polygons), 'Collapsed runtime face remains'
    geometry.calc_tangents(uvmap=geometry.uv_layers.active.name)
    broken={loop.index for loop in geometry.loops if loop.tangent.length<.5}
    if broken:
        # Reduction left two corner normals parallel to their surface tangents.
        # Restore those corners from their actual faces; keep other authored normals.
        normals=[n.vector.copy() for n in geometry.corner_normals]
        for polygon in geometry.polygons:
            for index in polygon.loop_indices:
                if index in broken:normals[index]=polygon.normal
        geometry.normals_split_custom_set(normals);geometry.update()
        geometry.calc_tangents(uvmap=geometry.uv_layers.active.name)
        assert all(loop.tangent.length>.99 for loop in geometry.loops), 'Undefined runtime tangent remains'
    geometry.free_tangents()
    info['triangles']=len(geometry.polygons)
record['rest_mesh_refinements']=['Cap, nape and boot shaping authored before baking',
    'Iris aperture authored with the continuous eyelids; no runtime iris expansion',
    'Leather uppers seated into the sole welt without an open gap',
    'Rear cap widened and lowered into a fuller cloth drape',
    'Front cap edge lifted behind the fringe',
    'Collapsed triangles removed before tangent export']
scene['pipeline']=json.dumps(record)
(ROOT/'runtime/pipeline.json').write_text(json.dumps(record,indent=2),encoding='utf-8',newline='')
bpy.data.libraries.write(str(ROOT/'link-runtime.blend'),{scene},fake_user=True,compress=True)
print(json.dumps(record['rest_mesh_refinements']))
