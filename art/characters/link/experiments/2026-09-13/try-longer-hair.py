import bpy,json
scene=bpy.data.scenes['CC0 | hair template study'];bpy.context.window.scene=scene
old=bpy.data.objects['basic_short_hair'];old.hide_render=True
with bpy.data.libraries.load('E:/Tools/mpfb-assets/haireditor/hair/haireditor/hair.blend',link=False) as (source,target):
    target.objects=['straight_hair_to_shoulder']
hair=target.objects[0];scene.collection.objects.link(hair);hair.parent=None
hair.location=(0,.025,-.505);hair.scale=(1.47,1.10,1.0)
modifier=hair.modifiers.get('Surface Deform')
if modifier:hair.modifiers.remove(modifier)
hair.data.materials.clear();hair.data.materials.append(bpy.data.materials['CC0 groom | golden blond'])
scene.render.filepath='E:/Tools/blender-mcp/link-longer-native-hair-trial.png'
bpy.ops.render.render(write_still=True)
bpy.data.libraries.write('E:/Tools/blender-mcp/link-longer-native-hair-trial.blend',{scene},fake_user=True,compress=True)
print(json.dumps({'image':scene.render.filepath,'guides':len(hair.data.curves),'points':len(hair.data.points)}))
