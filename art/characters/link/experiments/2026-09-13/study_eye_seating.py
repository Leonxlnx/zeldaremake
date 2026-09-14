"""Compare globe seating against the measured orbital rim, with existing lid geometry."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

almond=bool(globals().get('JOB',{}).get('almond',False))
fit=bool(globals().get('JOB',{}).get('fit',False));assert not fit or almond
root=Path(__file__).resolve().parent/'source-runtime';name='Link | almond fitted eye study' if fit else ('Link | almond eye seating study' if almond else 'Link | eye seating study')
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/('almond-colour-restored.blend' if almond else 'lid-fit-candidate.blend')),link=False) as (available,loaded):loaded.scenes=['Link | almond socket study' if almond else 'Link | eyelid lattice study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name];assert len(eyes)==2
shift=.020 if almond else .010
clamped=[]
if fit:
    body=next(o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
    bpy.context.view_layer.update();surface=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
for eye in eyes:
    before=[v.co.copy() for v in eye.data.vertices]
    for vertex in eye.data.vertices:vertex.co.y-=shift
    assert all(abs((vertex.co-old).length-shift)<1e-7 for vertex,old in zip(eye.data.vertices,before))
    if fit:
        count=0
        for vertex in eye.data.vertices:
            hit,_,face,_=surface.ray_cast(Vector((vertex.co.x,-1,vertex.co.z)),Vector((0,1,0)))
            if hit is not None and body.data.polygons[face].material_index==0:
                if vertex.co.y<hit.y+.0005:vertex.co.y=hit.y+.0005;count+=1
                assert vertex.co.y>=hit.y+.0004999,'Sclera must stay behind the outer skin'
        clamped.append(count)
        assert 0<count<len(eye.data.vertices),count
        assert all(abs(vertex.co.x-old.x)<1e-8 and abs(vertex.co.z-old.z)<1e-8 for vertex,old in zip(eye.data.vertices,before))
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
prefix='almond-fitted-eye-study' if fit else ('almond-eye-seating-study' if almond else 'eye-seating-study')
scene.render.filepath=str(root/('face-'+prefix+'.png'));bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/(prefix+'.blend')),{scene},fake_user=True,compress=True)
record={'status':'Unaccepted seating study; not exported','eye_y_shift_metres':-shift,'body_changed':False,
    'outer_sclera_fit_vertices':clamped,'skin_clearance_metres':.0005 if fit else None,
    'reason':'Measured current iris plane y=-.104 versus upper rim-.127 and lower rim-.115; compare reduced socket depth visually.'}
(root/(prefix+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
