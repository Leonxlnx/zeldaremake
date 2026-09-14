"""Compare a shallower globe while preserving the reviewed eye aperture and iris UVs."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent/'source-runtime'
mode=globals().get('JOB',{}).get('mode','depth');assert mode in {'depth','iris-plane'}
name='Link | source eye depth study' if mode=='depth' else 'Link | source iris plane study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'eye-candidate.blend'),link=False) as (available,loaded):
    assert 'Link | source eye study' in available.scenes
    loaded.scenes=['Link | source eye study']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
rig=next(o for o in scene.collection.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
eyes=[o for o in scene.collection.objects if o.type=='MESH' and 'anatomical eye' in o.name];assert len(eyes)==2
for eye in eyes:
    centre=Vector([(min(v.co[a] for v in eye.data.vertices)+max(v.co[a] for v in eye.data.vertices))/2 for a in range(3)])
    radius=Vector([(max(v.co[a] for v in eye.data.vertices)-min(v.co[a] for v in eye.data.vertices))/2 for a in range(3)])
    if mode=='iris-plane':
        bpy.ops.object.select_all(action='DESELECT');eye.select_set(True);bpy.context.view_layer.objects.active=eye
        subdivide=eye.modifiers.new('Smooth iris outline','SUBSURF');subdivide.levels=1
        bpy.ops.object.modifier_apply(modifier=subdivide.name)
        for vertex in eye.data.vertices:
            direction=Vector([(vertex.co[a]-centre[a])/radius[a] for a in range(3)]).normalized()
            vertex.co=Vector([centre[a]+direction[a]*radius[a] for a in range(3)])
    before=[(v.co.x,v.co.z) for v in eye.data.vertices]
    for vertex in eye.data.vertices:
        if mode=='depth':vertex.co.y=centre.y+(vertex.co.y-centre.y)*.7
        elif vertex.co.y<centre.y:
            r=math.hypot((vertex.co.x-centre.x)/radius.x,(vertex.co.z-centre.z)/radius.z)
            t=max(0,min(1,(r-.60)/.15));weight=1-t*t*(3-2*t)
            vertex.co.y=vertex.co.y*(1-weight)+(centre.y-.021)*weight
    assert before==[(v.co.x,v.co.z) for v in eye.data.vertices]
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=.46;scene.camera.location=(.5,-3,1.13)
scene.camera.rotation_euler=(Vector((0,0,1.015))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.filepath=str(root/('face-eye-depth-study.png' if mode=='depth' else 'face-iris-plane-study.png'));bpy.ops.render.render(write_still=True)
(root/('eye-depth-study.json' if mode=='depth' else 'iris-plane-study.json')).write_text(json.dumps({'status':'Unaccepted eye study; original scene and exported asset unchanged','mode':mode,'depth_scale':.7 if mode=='depth' else None,'centre_shift':0,'iris_plane_depth':.021 if mode=='iris-plane' else None},indent=2)+'\n')
print('Saved eye-depth comparison',scene.render.filepath)
