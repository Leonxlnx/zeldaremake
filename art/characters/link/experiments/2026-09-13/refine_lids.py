"""A separate native lid study around the validated generated eye candidate."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent/'lid-runtime';root.mkdir(exist_ok=True)
source=bpy.data.scenes['Link | generated eye study']
assert 'Link | lid study' not in bpy.data.scenes
scene=bpy.data.scenes.new('Link | lid study');bpy.context.window.scene=scene
scene.world=source.world;scene.render.fps=60
for collection in source.collection.children:scene.collection.children.link(collection)
copies={};materials={}
for original in source.collection.objects:
    ob=original.copy();ob.data=original.data.copy();scene.collection.objects.link(ob);copies[original.name]=ob
    if ob.type=='MESH':
        for i,material in enumerate(ob.data.materials):
            if material.name not in materials:materials[material.name]=material.copy()
            ob.data.materials[i]=materials[material.name]
rig=next(o for o in copies.values() if o.type=='ARMATURE');rig.name='Link | lid study rig';rig.data.pose_position='REST'
body=next(o for o in copies.values() if o.type=='MESH' and 'anatomical eye' not in o.name)
body.name='Link_skin_lid_study_body'
shader=body.data.materials[0].node_tree.nodes['Principled BSDF']
image=shader.inputs['Base Color'].links[0].from_node.image
u,v=.4577209353,.1953322887
pixel=(int(v*image.size[1])*image.size[0]+int(u*image.size[0]))*4
sample=list(image.pixels[pixel:pixel+3])
linear=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in sample]
body.data.materials[1].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*linear,1)
eyes=sorted([o for o in copies.values() if 'anatomical eye' in o.name],key=lambda o:o.name)
assert len(eyes)==2
for ob in [body,*eyes]:
    ob.parent=rig
    for modifier in ob.modifiers:
        if modifier.type=='ARMATURE':modifier.object=rig
scene.camera=copies[source.camera.name]
points=[Vector(e['point']) for e in json.loads((root.parent/'generated-runtime/eye-placement.json').read_text())['eyes']]
for eye,point in zip(eyes,points):
    old_centre=point.y+.016;new_centre=point.y+.012
    for vertex in eye.data.vertices:vertex.co.y=new_centre+(vertex.co.y-old_centre)*.7
bpy.context.view_layer.update();tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
created=[]
for side,point in enumerate(points):
    vertices=[];uvs=[];faces=[];segments=64;rings=4
    for row in range(rings):
        t=row/(rings-1)
        for i in range(segments):
            angle=2*math.pi*i/segments;c=math.cos(angle);s=math.sin(angle)
            inner_x=.025*c;inner_z=(.014 if s>=0 else .012)*s
            outer_x=.030*c;outer_z=(.023 if s>=0 else .022)*s
            # The inner edge follows the real flattened eyeball; the outer edge meets the skin.
            inner_y=point.y+.012-.0196*math.sqrt(max(0,1-(inner_x/.028)**2-(inner_z/.027)**2))
            outer=Vector((point.x+outer_x,point.y,point.z+outer_z))
            hit,normal,face,distance=tree.find_nearest(outer)
            assert hit is not None
            outer_y=hit.y-.0003 if abs(hit.y-point.y)<.025 else point.y
            x=inner_x*(1-t)+outer_x*t;z=inner_z*(1-t)+outer_z*t
            y=inner_y*(1-t)+outer_y*t-.0012*math.sin(math.pi*t)
            vertices.append((point.x+x,y,point.z+z));uvs.append((.5+x/.07,.5+z/.055))
    for row in range(rings-1):
        for i in range(segments):
            a=row*segments+i;b=row*segments+(i+1)%segments
            faces.append((a,a+segments,b+segments,b))
    mesh=bpy.data.meshes.new('Soft orbital lid');mesh.from_pydata(vertices,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name=body.data.uv_layers.active.name)
    for polygon in mesh.polygons:
        polygon.use_smooth=True
        for loop in polygon.loop_indices:uv.data[loop].uv=uvs[mesh.loops[loop].vertex_index]
    lid=bpy.data.objects.new('Link | soft lid '+str(side),mesh);scene.collection.objects.link(lid)
    mesh.materials.append(body.data.materials[1]);lid.vertex_groups.new(name='head').add(list(range(len(vertices))),1,'REPLACE')
    created.append(lid)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
for lid in created:lid.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
triangles=sum(len(p.vertices)-2 for ob in [body,*eyes] for p in ob.data.polygons)
assert triangles==26232,triangles
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'face-lid-study.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(root/'lid-study.blend'),{scene},fake_user=True,compress=True)
(root/'study.json').write_text(json.dumps({'status':'Unaccepted orbital study','triangles':triangles,'eyeball_depth_scale':.7,'eyeball_center_offset':.012,'lid_segments':64,'lid_rings':4},indent=2)+'\n')
print('Saved isolated lid study',root)
