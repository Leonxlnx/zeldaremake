"""Round only the new socket/skin boundary with Blender's native bevel."""
import bpy,json
from pathlib import Path

almond=bool(globals().get('JOB',{}).get('almond',False))
scene=bpy.data.scenes['Link | almond socket study' if almond else 'Link | source eye study'];bpy.context.window.scene=scene
body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
assert not body.get('orbital_rims_bevelled',False),'Already bevelled; reload the preceding saved study to retry'
body.parent.data.pose_position='REST';bpy.context.view_layer.update()
materials={}
for polygon in body.data.polygons:
    for edge in polygon.edge_keys:materials.setdefault(tuple(sorted(edge)),set()).add(polygon.material_index)
boundary=[e for e in body.data.edges if materials.get(tuple(sorted(e.vertices)))=={0,1}]
assert 20<len(boundary)<1000,len(boundary)
assert all(.94<body.data.vertices[v].co.z<1.01 and abs(body.data.vertices[v].co.x)<.10 for e in boundary for v in e.vertices)
attribute=body.data.attributes.get('bevel_weight_edge') or body.data.attributes.new('bevel_weight_edge','FLOAT','EDGE')
for value in attribute.data:value.value=0
for edge in boundary:attribute.data[edge.index].value=1
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
width=.0007 if almond else .0009
bevel=body.modifiers.new('Soft orbital rim','BEVEL');bevel.limit_method='WEIGHT';bevel.width=width
bevel.segments=3;bevel.material=1;bevel.use_clamp_overlap=True
bpy.ops.object.modifier_apply(modifier=bevel.name)
body['orbital_rims_bevelled']=True
triangles=sum(len(p.vertices)-2 for p in body.data.polygons)
assert triangles<55000,triangles
record={'boundary_edges':len(boundary),'width_metres':width,'segments':3,'body_triangles':triangles,'status':'Native rim study; restore normals and validate export before adoption'}
(Path(__file__).resolve().parent/'source-runtime'/('almond-rim-bevel.json' if almond else 'rim-bevel.json')).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
