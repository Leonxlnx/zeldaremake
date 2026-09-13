import bpy,json
from pathlib import Path
scene=bpy.data.scenes['CC0 | hair template study'];bpy.context.window.scene=scene
hair=bpy.data.objects['straight_hair_to_shoulder'];deps=bpy.context.evaluated_depsgraph_get();ev=hair.evaluated_get(deps)
record={'guides':len(hair.data.curves),'evaluated_curves':len(ev.data.curves),'evaluated_points':len(ev.data.points),'modifiers':[]}
for m in hair.modifiers:
    if m.type!='NODES':continue
    record['modifiers'].append({'name':m.name,'group':m.node_group.name,'inputs':[{'name':s.name,'id':s.identifier,'default':str(getattr(s,'default_value',None))} for s in m.node_group.interface.items_tree if s.item_type=='SOCKET' and s.in_out=='INPUT']})
Path('E:/Tools/blender-mcp/groom-controls.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in record.items() if k!='modifiers'}))
