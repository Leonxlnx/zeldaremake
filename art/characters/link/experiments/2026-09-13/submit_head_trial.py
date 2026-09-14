"""One isolated high-detail head job through Blender MCP's bundled public trial."""
import bpy,blender_mcp,requests,json,hashlib
from pathlib import Path

root=Path(__file__).resolve().parent;private=Path('E:/Tools/blender-mcp/rodin-head-gen25-job.json')
assert not private.exists(),'Existing job must be polled, never silently resubmitted'
source=root.parents[4]/'reference/generated-link-studies/2026-09-13/06-head-front.png'
assert source.is_file(),source
expected='65c01d6934b7224c3e9c7ebc1881b9890f0a16879cd1d4271942902916729450'
assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
name='Rodin | detailed head trial';assert name not in bpy.data.scenes
scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene
bpy.ops.blendermcp.set_hyper3d_free_trial_api_key()
assert scene.blendermcp_hyper3d_api_key==blender_mcp.RODIN_FREE_TRIAL_KEY
params={'prompt':'One coherent character HEAD, neck and clothed shoulder bust matching this front reference. Preserve the exact facial proportions, almond eye openings, eyelid thickness, circular pupils within teal irises, small nose, closed lips and long pointed ears. Faithful golden layered hairstyle with fine directional strands and tapered locks, soft green stitched cap continuing behind the head. Smooth continuous facial anatomy with subtle skin texture. Full three-dimensional rounded skull and back of head, no flat relief, no added body or legs. Concentrate geometric and texture detail on the head, eyes, hair and cap.',
    'tier':'Gen-2.5-Medium','mesh_mode':'Raw','quality_override':'150000','quad_normal':'true',
    'material':'PBR','geometry_file_format':'glb','texture_mode':'high','detail_level':'3',
    'is_symmetric':'balanced','geometry_instruct_mode':'faithful','texture_delight':'true','seed':'1309'}
assert len(params['prompt'])<=1024
fields=[]
for key,value in params.items():
    for entry in value if isinstance(value,list) else [value]:fields.append((key,(None,str(entry))))
private.write_text(json.dumps({'status':'Submission started; outcome unknown until response is saved','source_sha256':expected})+'\n')
with source.open('rb') as image:
    response=requests.post('https://hyperhuman.deemos.com/api/v2/rodin',headers={'Authorization':'Bearer '+blender_mcp.RODIN_FREE_TRIAL_KEY},
        files=[('images',(source.name,image,'image/png')),*fields],timeout=120)
data=response.json()
private.write_text(json.dumps(data,indent=2)+'\n')
record={'source':{'file':str(source),'sha256':expected},'parameters':params,'status_code':response.status_code,
    'uuid':data.get('uuid'),'error':data.get('error'),'message':data.get('message'),
    'credential':'Bundled public Blender MCP free trial only; private credentials are neither loaded nor used',
    'documentation':'https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5',
    'status':'Submitted; not imported or adopted' if response.status_code==201 and not data.get('error') and data.get('uuid') else 'Rejected by service; no accepted generation'}
(root/'rodin-head-gen25-request.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record));assert response.status_code==201 and not data.get('error') and data.get('uuid'), 'Submission not accepted; inspect saved response before any retry'
