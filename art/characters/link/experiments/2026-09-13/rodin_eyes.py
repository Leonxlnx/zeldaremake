"""Native socket/eye study on the generated anatomical surface, not a runtime replacement."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent/'rodin-text-v2'
source=bpy.data.scenes['Rodin | material study']
assert 'Rodin | eye study' not in bpy.data.scenes
scene=bpy.data.scenes.new('Rodin | eye study');bpy.context.window.scene=scene
scene.world=source.world
for collection in source.collection.children:scene.collection.children.link(collection)
scene.camera=source.camera.copy();scene.camera.data=source.camera.data.copy()
scene.collection.objects.link(scene.camera)
model=bpy.data.objects['Link | Rodin material study'].copy();model.data=model.data.copy()
model.name='Link | Rodin eye study';scene.collection.objects.link(model)
skin=bpy.data.materials['Skin | warm peach'];model.data.materials.append(skin)
bpy.context.view_layer.update()
tree=BVHTree.FromObject(model,bpy.context.evaluated_depsgraph_get())
frame=scene.camera.data.view_frame(scene=source)
bounds=[(min(v[i] for v in frame),max(v[i] for v in frame)) for i in range(2)]
eyes=[]
for px,py in [(219,488),(411,486)]:
    x=bounds[0][0]+px/720*(bounds[0][1]-bounds[0][0])
    y=bounds[1][0]+(1-py/820)*(bounds[1][1]-bounds[1][0])
    origin=scene.camera.matrix_world@Vector((x,y,0))
    direction=scene.camera.matrix_world.to_3x3()@Vector((0,0,-1))
    hit=tree.ray_cast(origin,direction);assert hit[0] is not None
    eyes.append(hit[0])
assert eyes[0].x<-.025 and eyes[1].x>.025
assert abs(eyes[0].z-eyes[1].z)<.015

def sphere(name,position,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,location=position)
    ob=bpy.context.object;ob.name=name;ob.scale=scale
    for polygon in ob.data.polygons:polygon.use_smooth=True
    ob.data.materials.append(material)
    return ob

for i,point in enumerate(eyes):
    cutter=sphere('Eye socket cutter '+str(i),(point.x,point.y-.018,point.z),(.026,.052,.021),skin)
    cutter.data.materials.clear()
    for material in model.data.materials:cutter.data.materials.append(material)
    for polygon in cutter.data.polygons:polygon.material_index=2
    bpy.ops.object.select_all(action='DESELECT');model.select_set(True)
    bpy.context.view_layer.objects.active=model
    boolean=model.modifiers.new('Sculpt eye socket '+str(i),'BOOLEAN')
    boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=cutter
    bpy.ops.object.modifier_apply(modifier=boolean.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    sphere('Actual eye sclera '+str(i),(point.x,point.y+.012,point.z),(.030,.029,.027),bpy.data.materials['Eyes | warm ivory'])
    sphere('Actual iris rim '+str(i),(point.x,point.y-.0175,point.z),(.0225,.0018,.021),bpy.data.materials['Eyes | dark iris rim'])
    sphere('Actual iris '+str(i),(point.x,point.y-.0187,point.z),(.021,.0016,.0198),bpy.data.materials['Eyes | teal iris'])
    sphere('Actual pupil '+str(i),(point.x,point.y-.0203,point.z),(.0085,.001,.009),bpy.data.materials['Eyes | pupils'])
for polygon in model.data.polygons:polygon.use_smooth=True
assert len(model.data.polygons)>20000
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'face-eyes.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'eyes.blend'),{scene},fake_user=True,compress=True)
record={'status':'Actual socket and eye geometry study, not adopted','eyeSurfacePoints':[list(p) for p in eyes],
    'triangles':sum(len(p.vertices)-2 for p in model.data.polygons),
    'imageSha256':hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest()}
(root/'eyes.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print(json.dumps(record))
