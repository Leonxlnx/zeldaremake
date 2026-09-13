"""Render the isolated, unaccepted Rodin trial through Blender MCP."""
import bpy, json, hashlib, shutil, tempfile
from pathlib import Path
from mathutils import Vector

variant=JOB.get('variant','v1')
scene_name,object_name,task_uuid={
    'v1':('Rodin | isolated trial','Link | Rodin trial','cf1fab9f-9e7e-4a07-886d-69d64511ad54'),
    'v2':('Rodin | second trial','Link | Rodin second trial','61ba180a-9ccf-4951-8708-d7fb1532af9c'),
    'gen2':('Rodin | Gen2 trial','Link | Rodin Gen2 trial','eba5339e-8faf-474d-8547-0b1e58148777'),
    'sheet-gen2':('Rodin | original sheet trial','Link | Rodin original sheet trial','e1103326-b72d-46e5-a8db-d729c6335481'),
}[variant]
root=Path(__file__).resolve().parent/('rodin-text-'+variant)
root.mkdir(exist_ok=True)
scene=bpy.data.scenes[scene_name];bpy.context.window.scene=scene
model=bpy.data.objects[object_name]
if not model.get('review_prepared'):
    # Blender's native glTF importer already converts Y-up to Blender Z-up.
    model.data.transform(model.matrix_world);model.matrix_world.identity()
    points=[v.co for v in model.data.vertices]
    low=min(p.z for p in points);high=max(p.z for p in points)
    scale=1.20/(high-low)
    for p in points:p.z-=low;p*=scale
    assert abs(min(p.z for p in points))<1e-6
    assert abs(max(p.z for p in points)-1.20)<1e-5
    source=bpy.data.scenes['Link | Blender art study']
    studio=next(c for c in source.collection.children if c.name.startswith('STUDIO |'))
    scene.collection.children.link(studio);scene.world=source.world
    camera=source.camera.copy();camera.data=source.camera.data.copy()
    scene.collection.objects.link(camera);scene.camera=camera
    model['review_prepared']=True
    raw=next(Path(tempfile.gettempdir()).glob(task_uuid+'*.glb'))
    shutil.copy2(raw,root/'rodin-original.glb')

scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
view=JOB.get('view','front')
position,target,size={
    'front':((0,-4,1.20),(0,0,.60),1.40),
    'face':((.5,-3,1.13),(0,0,1.015),.46),
    'side':((4,0,1.20),(0,0,.60),1.40),
    'back':((.8,4,1.20),(0,0,.60),1.40),
}[view]
camera=scene.camera;camera.location=position;camera.data.type='ORTHO';camera.data.ortho_scale=size
camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(root/(view+'.png'))
bpy.ops.render.render(write_still=True)
# Never persist even the public trial token in project files.
scene.blendermcp_hyper3d_api_key='';scene.blendermcp_use_hyper3d=False
bpy.data.libraries.write(str(root/'review.blend'),{scene},fake_user=True,compress=True)
print(json.dumps({'view':view,'image':scene.render.filepath,
    'sha256':hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest(),
    'vertices':len(model.data.vertices),'triangles':sum(len(p.vertices)-2 for p in model.data.polygons),
    'status':'Actual Blender render of isolated generated study; not adopted'}))
