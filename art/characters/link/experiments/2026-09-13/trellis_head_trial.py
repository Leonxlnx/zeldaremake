"""One anonymous request to Microsoft's public TRELLIS.2 demo; no paid fallback."""
import hashlib,json,os,struct
from pathlib import Path
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['GRADIO_ANALYTICS_ENABLED']='False'
from gradio_client import Client,handle_file

ROOT=Path(__file__).resolve().parent
PRIVATE=Path('E:/Tools/blender-mcp/trellis-public-review')
GUARD=PRIVATE/'head-client-job.json'
BASE='https://microsoft-trellis-2.hf.space'
SOURCE='https://raw.githubusercontent.com/Leonxlnx/zeldaremake/becf347/reference/generated-link-studies/2026-09-13/06-head-front.png'
EXPECTED='65c01d6934b7224c3e9c7ebc1881b9890f0a16879cd1d4271942902916729450'

def main():
    source=ROOT.parents[4]/'reference/generated-link-studies/2026-09-13/06-head-front.png'
    assert hashlib.sha256(source.read_bytes()).hexdigest()==EXPECTED
    if GUARD.exists():
        previous=json.loads(GUARD.read_text())
        assert previous['stage']=='prepared' and not previous['calls'],'Existing job: inspect its status; never submit a duplicate blindly'
    PRIVATE.mkdir(exist_ok=True)
    job={'source_sha256':EXPECTED,'stage':'prepared','client':'gradio_client2.7.0','calls':[]}
    GUARD.write_text(json.dumps(job,indent=2)+'\n')
    public={'provider':'Microsoft official TRELLIS.2 public Space','space_sha':'ebf60b20fc5a4607f90a1c11c0aab0ceeda5429d','source':SOURCE,'source_sha256':EXPECTED,'seed':130926,'resolution':'1024','decimation_target':300000,'texture_size':4096,'input':'Existing reference06 unchanged; no background editing or BRIA call','status':'prepared','authentication':'anonymous; no credentials or paid fallback'}
    def save():
        GUARD.write_text(json.dumps(job,indent=2)+'\n')
        (ROOT/'trellis-head-request.json').write_text(json.dumps(public,indent=2)+'\n')
    client=Client(BASE,token=False,verbose=False,analytics_enabled=False,download_files=PRIVATE/'downloads')
    try:
        assert not any(k.lower()=='authorization' for k in client.headers),'Anonymous client required'
        job['session_hash']=client.session_hash;save()
        def call(name,*data):
            job['stage']=name+' submitting';public['status']=job['stage'];job['calls'].append(name);save()
            print(job['stage'],flush=True)
            result=client.predict(*data,api_name='/'+name)
            if name=='image_to_3d':(PRIVATE/'head-preview.html').write_text(result,encoding='utf-8')
            job['stage']=name+' complete';save();print(job['stage'],flush=True);return result
        try:
            call('start_session')
            call('image_to_3d',handle_file(str(source)),130926,'1024',7.5,.7,12,5,7.5,.5,12,3,1,0,12,3)
            result=call('extract_glb',300000,4096);raw=Path(result[0]).read_bytes()
            assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw)),'Invalid GLB download'
            output=ROOT/'trellis-head';output.mkdir(exist_ok=True);(output/'original.glb').write_bytes(raw)
            public.update(status='downloaded; not imported or accepted',sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw));job['stage']='downloaded';save()
            print(json.dumps(public),flush=True)
            call('end_session')
            public['status']='downloaded; remote session ended; not accepted';save()
        except Exception as error:
            public['status']='failed or unresolved; no automatic retry';public['error']=str(error)[:1200];job['error']=public['error'];save();raise
    finally:client.close()

if __name__=='__main__':main()
