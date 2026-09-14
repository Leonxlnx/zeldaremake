"""Fit the continuous face to the existing original 3D source, excluding eye sockets."""
import bpy,json,math,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import barycentric_transform
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent/'source-runtime';name='Link | anatomical source surface v3 study'
assert name not in bpy.data.scenes
with bpy.data.libraries.load(str(root/'anatomical-lid-detail.blend'),link=False) as (_,loaded):loaded.scenes=['Link | anatomical lid detail']
scene=loaded.scenes[0];scene.name=name;bpy.context.window.scene=scene
head=next(o for o in scene.collection.objects if o.type=='MESH' and 'topology v4 head' in o.name)
source=bpy.data.objects['Link | source candidate'];assert len(source.data.polygons)==50000
appearance=bpy.data.scenes['Link | textured iris study v2']
appearance_body=next(o for o in appearance.collection.objects if o.type=='MESH' and 'anatomical eye' not in o.name)
image=appearance_body.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0].from_node.image
assert image.colorspace_settings.name=='sRGB',image.colorspace_settings.name
def linear(rgb):return Vector([c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb])
assert (linear((0,.5,1))-Vector((0,.21404114,1))).length<1e-6
pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);width,height=image.size
uv=source.data.uv_layers.active.data
def sample(co):
    x=max(0,min(width-1,int(co.x*width)));y=max(0,min(height-1,int(co.y*height)))
    return Vector(pixels[(y*width+x)*4:(y*width+x)*4+3])
skin=[]
for face in source.data.polygons:
    p=face.center
    if not (.80<p.z<1.075 and abs(p.x)<.12 and p.y<.08):continue
    r,g,b=sample(sum((uv[i].uv for i in face.loop_indices),Vector((0,0)))/len(face.loop_indices))
    gold=r>.25 and r>g*1.1 and g>b*1.25 and b/max(r,.001)<.58
    green=g>r*1.025 and g>b*1.04
    if not gold and not green:skin.append(face)
assert skin and min(f.center.x for f in skin)<-.08 and max(f.center.x for f in skin)>.08
assert min(f.center.z for f in skin)<.85 and max(f.center.z for f in skin)>1.04
tree=BVHTree.FromPolygons([v.co for v in source.data.vertices],[f.vertices[:] for f in skin],all_triangles=True)
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
before=[v.co.copy() for v in head.data.vertices];colours=head.data.color_attributes['Anatomical skin tint'].data
protected=[];moved=0;coloured=0
for vertex in head.data.vertices:
    p=vertex.co;x,y,z=p
    front=1-smooth(-.07,.025,y)
    orbit=min(math.hypot((x-side*.0533)/.030,(z-.971)/.027) for side in [-1,1])
    eye_mask=smooth(1.05,1.7,orbit)
    if orbit<=1.05:protected.append(vertex.index)
    # Register the narrower source nose and lower mouth before depth transfer.
    nose=math.exp(-(x/.033)**4-((z-.940)/.020)**2)*front*eye_mask
    lower=smooth(.865,.895,z)*(1-smooth(.918,.949,z))*front*eye_mask
    vertex.co.x*=1-.35*nose
    vertex.co.z-=.004*nose+.005*lower
    x,y,z=vertex.co
    weight=.75*front*smooth(.855,.89,z)*(1-smooth(1.025,1.065,z))*eye_mask
    hit,_,index,_=tree.ray_cast(Vector((x,-.3,z)),Vector((0,1,0)))
    if hit is None or abs(hit.y-y)>.045:continue
    if weight>0:
        vertex.co.y+=(hit.y-y)*weight;moved+=1
    colour_weight=front*eye_mask*(1-smooth(1.025,1.065,z))
    if colour_weight>0:
        face=skin[index];a,b,c=[source.data.vertices[i].co for i in face.vertices]
        ta,tb,tc=[Vector((*uv[i].uv,0)) for i in face.loop_indices]
        texcoord=barycentric_transform(hit,a,b,c,ta,tb,tc)
        value=colours[vertex.index];value.color=(*Vector(value.color[:3]).lerp(linear(sample(texcoord)),colour_weight),1);coloured+=1
del pixels
head.data.update()
assert all((head.data.vertices[i].co-before[i]).length<1e-8 for i in protected)
assert moved>400 and coloured>400,(moved,coloured)
assert all(face.area>1e-12 for face in head.data.polygons)
scene.render.filepath=str(root/'face-anatomical-source-surface-v3.png');bpy.ops.render.render(write_still=True)
location=scene.camera.location.copy();rotation=scene.camera.rotation_euler.copy()
scene.camera.location=(.65,-.65,1.03);scene.camera.rotation_euler=(Vector((0,0,1.005))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(root/'side-anatomical-source-surface-v3.png');bpy.ops.render.render(write_still=True)
scene.camera.location=location;scene.camera.rotation_euler=rotation
bpy.data.libraries.write(str(root/'anatomical-source-surface-v3.blend'),{scene},fake_user=True,compress=True)
record={'status':'Isolated surface-fit study, unrigged and unexported','source':'Original 50000-triangle Link source mesh; reviewed body colour on preserved original UVs; no portrait projection','source_skin_triangles':len(skin),'moved_vertices':moved,'coloured_vertices':coloured,'protected_orbital_vertices':len(protected),'max_move_metres':max((v.co-p).length for v,p in zip(head.data.vertices,before)),'method':'Narrow nose/lower mouth registration, then front-depth transfer at fixed registered X/Z; 75% blend outside eye sockets; barycentric sampling of original mesh UVs'}
record['max_protected_orbital_registration_move_metres']=max((head.data.vertices[i].co-before[i]).length for i in protected)
record['colour_transfer']='sRGB image pixels decoded to scene-linear vertex colours; verified 0.5 -> 0.21404114'
(root/'anatomical-source-surface-v3.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
