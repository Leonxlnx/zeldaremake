"""Non-destructive proportion/material pass on the isolated CC0 head."""
import bpy,math,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
scene=bpy.data.scenes['MPFB | Link proportions v6'];bpy.context.window.scene=scene
head=bpy.data.objects['CC0 MPFB Link head v6']
assert not head.get('detail_pass'), 'This sculpt pass is already applied'
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
ear=head.vertex_groups['ears'].index;lip=head.vertex_groups['lips'].index
for v in head.data.vertices:
    x,y,z=v.co
    front=1-smooth(.025,.080,y)
    lower=(1-smooth(.975,1.008,z))*smooth(.835,.89,z)
    v.co.z+=max(0,.987-z)*.25*lower*front
    v.co.y-=.004*math.exp(-((abs(x)-.068)/.041)**2-((z-.961)/.037)**2)*front
    v.co.y+=.005*math.exp(-(x/.020)**2-((z-.990)/.031)**2)*front
    if any(g.group==ear for g in v.groups):
        reach=smooth(.098,.139,abs(x))
        v.co.x+=(1 if x>0 else -1)*.038*reach
        v.co.y-=.055*reach
        v.co.z+=.009*reach
# Blend the retained neck into the tunic opening and flatten the cut boundary.
import bmesh
bm=bmesh.new();bm.from_mesh(head.data)
for v in bm.verts:
    if any(e.is_boundary for e in v.link_edges) and v.co.z<.91:
        v.co.z=.842
        v.co.x*=.72
        v.co.y=(v.co.y-.070)*.75+.018
bm.to_mesh(head.data);bm.free()
head.data.update()
col=head.data.color_attributes.new(name='SkinTint',type='FLOAT_COLOR',domain='POINT')
for v,c in zip(head.data.vertices,col.data):
    x,y,z=v.co;front=1-smooth(.01,.07,y)
    blush=.43*math.exp(-((abs(x)-.067)/.032)**2-((z-.965)/.023)**2)*front
    lip_weight=max((g.weight for g in v.groups if g.group==lip),default=0)*.26
    colour=Vector((.64,.39,.27)).lerp(Vector((.66,.27,.21)),blush)
    colour=colour.lerp(Vector((.50,.21,.16)),lip_weight)
    c.color=(*colour,1)
skin=head.data.materials[0];nodes=skin.node_tree.nodes;links=skin.node_tree.links
bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.48
attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='SkinTint';links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=260
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.00015
links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])

bpy.context.view_layer.update();tree=BVHTree.FromObject(head,bpy.context.evaluated_depsgraph_get())
def surface(x,z):
    hit=tree.ray_cast(Vector((x,-.5,z)),Vector((0,1,0)))
    assert hit[0] is not None, ('Missing face at brow',x,z)
    return hit[0].y-.0006
brown=bpy.data.materials.new('V6 brow umber');brown.diffuse_color=(.19,.080,.022,1);brown.use_nodes=True
brown.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.19,.080,.022,1)
brown.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.7
for side in [-1,1]:
    for i in range(28):
        t=i/27;x=side*(.021+.067*t);z=1.036+.007*math.sin(math.pi*t*.9)+.001*t
        data=bpy.data.curves.new('V6 eyebrow fibre','CURVE');data.dimensions='3D';data.bevel_depth=.0007*(1-.65*t);data.bevel_resolution=2;data.resolution_u=5
        spline=data.splines.new('BEZIER');spline.bezier_points.add(2)
        for j,p in enumerate(spline.bezier_points):
            px=x+side*.003*j/2;pz=z+.003*j/2
            p.co=(px,surface(px,pz),pz);p.handle_left_type=p.handle_right_type='AUTO';p.radius=1-j*.4
        ob=bpy.data.objects.new('V6 eyebrow fibre',data);scene.collection.objects.link(ob);data.materials.append(brown)

for side in ['l','r']:
    old=bpy.data.objects['MPFB v6 iris '+side]
    centre=old.location.copy();rx,_,rz=old.scale
    # Concentric authored iris fibres: dark limbal rim, teal stroma and amber collarette.
    verts=[];faces=[];colors=[];steps=128;rows=14
    for j in range(rows+1):
        r=j/rows
        for i in range(steps):
            a=math.tau*i/steps;verts.append((centre.x+rx*r*math.cos(a),centre.y-.0015*(1-r*r),centre.z+rz*r*math.sin(a)))
            fibre=.72+.16*math.sin(a*43+2*math.sin(a*11)+r*7)+.10*math.sin(a*83-r*15)
            base=Vector((.035,.24,.21))*fibre
            base=base.lerp(Vector((.006,.032,.030)),smooth(.86,1,r))
            base=base.lerp(Vector((.20,.23,.087)),.65*math.exp(-((r-.46)/.10)**2))
            colors.append((*base,1))
    for j in range(rows):
        for i in range(steps):faces.append((j*steps+i,j*steps+(i+1)%steps,(j+1)*steps+(i+1)%steps,(j+1)*steps+i))
    data=bpy.data.meshes.new('V6 iris radial geometry');data.from_pydata(verts,[],faces);data.update()
    color=data.color_attributes.new(name='IrisColor',type='FLOAT_COLOR',domain='POINT')
    for c,value in zip(color.data,colors):c.color=value
    mat=bpy.data.materials.new('V6 teal radial iris');mat.use_nodes=True;ns=mat.node_tree.nodes;ls=mat.node_tree.links
    shader=ns.get('Principled BSDF');shader.inputs['Roughness'].default_value=.20;shader.inputs['Coat Weight'].default_value=.35
    node=ns.new('ShaderNodeVertexColor');node.layer_name='IrisColor';ls.new(node.outputs['Color'],shader.inputs['Base Color'])
    ob=bpy.data.objects.new('V6 detailed iris '+side,data);scene.collection.objects.link(ob);data.materials.append(mat)
    for p in data.polygons:p.use_smooth=True
    scene.collection.objects.unlink(old)
    pupil=bpy.data.objects['MPFB v6 pupil '+side];pupil.location.y=centre.y-.0027
head['detail_pass']=True
scene.render.filepath='E:/Tools/blender-mcp/mpfb-link-v6-detail.png'
bpy.ops.render.render(write_still=True)
bpy.data.libraries.write('E:/Tools/blender-mcp/mpfb-link-v6-detail.blend',{scene},fake_user=True,compress=True)
print(json.dumps({'render':scene.render.filepath,'head_vertices':len(head.data.vertices)}))
