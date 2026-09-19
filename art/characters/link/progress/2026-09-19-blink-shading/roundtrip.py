"""Render the retained GLB under the native source's studio lights, without modifying it."""
import bpy,json,traceback
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
source=bpy.context.scene
scene=bpy.data.scenes.new('Link | retained GLB roundtrip diagnostic')
scene.world=source.world
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
for key in ['view_transform','look','exposure','gamma']:
    setattr(scene.view_settings,key,getattr(source.view_settings,key))
for ob in source.objects:
    if ob.type=='LIGHT' or ob==source.camera:
        dup=ob.copy();dup.data=ob.data.copy();scene.collection.objects.link(dup)
        if ob==source.camera:scene.camera=dup
bpy.context.window.scene=scene
try:
    bpy.ops.import_scene.gltf(filepath='E:/zeldaremake-integrated-review/public/models/link/link-runtime.glb')
    rigs=[o for o in scene.objects if o.type=='ARMATURE']
    for rig in rigs:
        rig.animation_data_clear();rig.data.pose_position='REST'
    bodies=[o for o in scene.objects if o.type=='MESH' and o.data.shape_keys]
    camera=scene.camera;focus=Vector((0,-.025,.97))
    camera.location=focus+Vector((0,-3,.04));camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.42
    report={'kind':'Native Blender import of retained runtime GLB, source studio lighting','views':[]}
    for weight in [0,1]:
        for ob in bodies:
            for key in ob.data.shape_keys.key_blocks:
                if key.name!='Basis':key.value=weight if key.name=='blink' else 0
        scene.render.filepath=str(out/f'roundtrip-blink-{weight}.png');bpy.ops.render.render(write_still=True)
        report['views'].append({'weight':weight,'path':scene.render.filepath})
    (out/'roundtrip.json').write_text(json.dumps(report,indent=2))
except Exception:
    (out/'roundtrip.error').write_text(traceback.format_exc());raise
finally:
    bpy.context.window.scene=source
