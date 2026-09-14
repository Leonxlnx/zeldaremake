"""Original Link art study. Run in Blender through MCP, or Blender --python.

Metres, Z up, facing -Y (glTF exports Y up, facing +Z). Only this script's
named scene is rebuilt; other open scenes are preserved. CC0 maps: textures/CREDITS.md.
"""
import bpy
import math
import json
import hashlib
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ROOT.mkdir(parents=True, exist_ok=True)
SCENE = 'Link | Blender art study'
old = bpy.data.scenes.get(SCENE)
scene = bpy.data.scenes.new(SCENE + ' new')
bpy.context.window.scene = scene
if old:
    for ob in list(old.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
for collection in list(bpy.data.collections):
    if collection.name.startswith(('LINK | original model', 'STUDIO | excluded from export')) and not collection.objects:
        bpy.data.collections.remove(collection)
scene.name = SCENE
hero = bpy.data.collections.new('LINK | original model')
scene.collection.children.link(hero)
studio = bpy.data.collections.new('STUDIO | excluded from export')
scene.collection.children.link(studio)


def material(name, color, roughness=.6, metallic=0, texture=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if name.startswith('Skin'):
        bsdf.inputs['Subsurface Weight'].default_value = .12
        bsdf.inputs['Subsurface Radius'].default_value = (1, .45, .24)
        bsdf.inputs['Subsurface Scale'].default_value = .035
        coord = nodes.new('ShaderNodeTexCoord')
        pores = nodes.new('ShaderNodeTexNoise'); pores.inputs['Scale'].default_value = 440
        links.new(coord.outputs['Object'], pores.inputs['Vector'])
        bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .16
        bump.inputs['Distance'].default_value = .00016
        links.new(pores.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs[0], bsdf.inputs['Normal'])
    if texture:
        tex = nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = {'cloth': 210, 'leather': 125, 'wood': 18}[texture]
        tex.inputs['Detail'].default_value = 2.5
        coord = nodes.new('ShaderNodeTexCoord')
        links.new(coord.outputs['Generated'], tex.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        for element, scale in zip(ramp.color_ramp.elements, (.66, 1.18)):
            element.color = (*[min(c*scale, 1) for c in color], 1)
        links.new(tex.outputs['Fac'], ramp.inputs[0])
        links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .22
        bump.inputs['Distance'].default_value = .0008 if texture == 'cloth' else .0015
        links.new(tex.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs[0], bsdf.inputs['Normal'])
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (3,3,3) if texture == 'cloth' else (2,2,2)
        links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
        def image_map(path, noncolor=False):
            node = nodes.new('ShaderNodeTexImage')
            node.image = bpy.data.images.load(str(path), check_existing=True)
            if noncolor:
                node.image.colorspace_settings.name = 'Non-Color'
            node.projection = 'BOX'; node.projection_blend = .25
            links.new(mapping.outputs[0], node.inputs['Vector'])
            return node
        if texture == 'leather':
            source = image_map(ROOT/'textures/leather-color.jpg')
            tint = nodes.new('ShaderNodeMixRGB'); tint.blend_type='MULTIPLY'; tint.inputs[0].default_value=1
            tint.inputs[2].default_value = (*[min(1,c*8) for c in color],1)
            links.new(source.outputs['Color'], tint.inputs[1]); links.new(tint.outputs[0], bsdf.inputs['Base Color'])
            height = image_map(ROOT/'textures/leather-height.png', True)
            links.new(height.outputs[0], bump.inputs['Height']); bump.inputs['Distance'].default_value=.002
            rough = image_map(ROOT/'textures/leather-roughness.jpg', True)
            links.new(rough.outputs[0], bsdf.inputs['Roughness'])
        elif texture == 'cloth':
            links.new(coord.outputs['UV'],mapping.inputs['Vector'])
            mapping.inputs['Scale'].default_value=(2,2,2)
            rough = image_map(ROOT/'textures/cloth-roughness.jpg', True)
            rough.projection='FLAT'
            links.new(rough.outputs[0], bsdf.inputs['Roughness'])
            normal=image_map(ROOT/'textures/cloth-normal.jpg',True);normal.projection='FLAT'
            tangent=nodes.new('ShaderNodeNormalMap');tangent.inputs['Strength'].default_value=.75
            links.new(normal.outputs[0],tangent.inputs['Color']);links.new(tangent.outputs[0],bsdf.inputs['Normal'])
            # Dye varies gently; the scanned normal provides the actual yarn weave.
            tex.inputs['Scale'].default_value=18
            tex.inputs['Detail'].default_value=3.5
            ramp.color_ramp.elements[0].color=(*[c*.7 for c in color],1)
            ramp.color_ramp.elements[1].color=(*[min(1,c*1.15) for c in color],1)
            bsdf.inputs['Sheen Weight'].default_value=.25
        elif texture == 'wood':
            mapping.inputs['Scale'].default_value=(1,1,1)
            source=image_map(ROOT.parents[2]/'public/textures/weathered_planks/color.jpg')
            links.new(source.outputs[0],bsdf.inputs['Base Color'])
            rough=image_map(ROOT.parents[2]/'public/textures/weathered_planks/roughness.jpg',True)
            links.new(rough.outputs[0],bsdf.inputs['Roughness'])
    return mat


skin = material('Skin | warm peach', (.64, .38, .25), .46)
earskin = material('Ear | rose inner fold', (.40, .17, .105), .67)
lip = material('Lips | muted warm rose', (.56, .31, .22), .52)
mouth = material('Mouth | fine shadow', (.085, .024, .017), .7)
cloth = material('Tunic | forest woven linen', (.033, .079, .016), .89, texture='cloth')
cloth_light = material('Collar | lighter green linen', (.068, .123, .03), .86, texture='cloth')
cloth_dark = material('Cap seams | dark green', (.032, .077, .024), .86)
thread = material('Stitches | flax', (.34, .30, .15), .9)
leather = material('Leather | chestnut hide', (.045, .019, .008), .67, texture='leather')
edge = material('Leather | worn edges', (.106, .051, .02), .74, texture='leather')
sole = material('Boot soles', (.043, .024, .013), .84)
metal = material('Buckles | aged brass', (.33, .265, .15), .39, .72)
steel = material('Sword | satin steel', (.41, .48, .48), .3, .82)
hairmats = [material('Hair | golden lock '+str(i), c, .44) for i,c in enumerate([
    (.24,.104,.026), (.39,.205,.061), (.49,.283,.099), (.32,.157,.034)])]
hairline = material('Hair | fine highlights', (.57,.30,.075), .48)
for hairmat in hairmats:
    nodes,links=hairmat.node_tree.nodes,hairmat.node_tree.links
    bsdf=nodes.get('Principled BSDF');bsdf.inputs['Anisotropic'].default_value=.45
    coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value=(95,5,1);links.new(coord.outputs['UV'],mapping.inputs['Vector'])
    fibres=nodes.new('ShaderNodeTexNoise');fibres.inputs['Scale'].default_value=1;fibres.inputs['Detail'].default_value=2
    links.new(mapping.outputs[0],fibres.inputs['Vector'])
    colors=nodes.new('ShaderNodeValToRGB')
    for stop,scale in zip(colors.color_ramp.elements,(.65,1.2)):
        stop.color=(*[c*scale for c in hairmat.diffuse_color[:3]],1)
    links.new(fibres.outputs['Fac'],colors.inputs[0]);links.new(colors.outputs[0],bsdf.inputs['Base Color'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.23;bump.inputs['Distance'].default_value=.00035
    links.new(fibres.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bsdf.inputs['Normal'])
white = material('Eyes | warm ivory', (.78,.81,.74), .27)
irisrim = material('Eyes | dark iris rim', (.008,.057,.050), .29)
iris = material('Eyes | teal iris', (.029,.23,.19), .3)
nodes,links=iris.node_tree.nodes,iris.node_tree.links
coord=nodes.new('ShaderNodeTexCoord')
center=nodes.new('ShaderNodeVectorMath');center.operation='SUBTRACT';center.inputs[1].default_value=(.5,.5,.5)
links.new(coord.outputs['Generated'],center.inputs[0])
separate=nodes.new('ShaderNodeSeparateXYZ');links.new(center.outputs[0],separate.inputs[0])
plane=nodes.new('ShaderNodeCombineXYZ');links.new(separate.outputs['X'],plane.inputs['X']);links.new(separate.outputs['Z'],plane.inputs['Y'])
radial=nodes.new('ShaderNodeVectorMath');radial.operation='NORMALIZE';links.new(plane.outputs[0],radial.inputs[0])
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=22;noise.inputs['Detail'].default_value=4
links.new(radial.outputs[0],noise.inputs['Vector'])
colors=nodes.new('ShaderNodeValToRGB')
colors.color_ramp.elements[0].position=.23;colors.color_ramp.elements[0].color=(.006,.035,.027,1)
colors.color_ramp.elements[1].position=.76;colors.color_ramp.elements[1].color=(.095,.29,.19,1)
colors.color_ramp.elements.new(.52).color=(.024,.105,.078,1)
links.new(noise.outputs['Fac'],colors.inputs[0]);links.new(colors.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
pupil = material('Eyes | pupils', (.004,.009,.007), .19)
shine = material('Eyes | catchlights', (.95,.97,1), .15)
wood = [material('Shield | carved plank '+str(i), (.19+.025*i,.093+.012*i,.035+.006*i), .8, texture='wood') for i in range(4)]
red = material('Shield | red spiral inlay', (.42,.047,.025), .64)


def put(ob, name, mat=None, collection=hero):
    ob.name = name
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    if ob.type == 'MESH':
        for f in ob.data.polygons:
            f.use_smooth = True
    return ob


def mesh(name, verts, faces, mat, subdiv=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    hero.objects.link(ob)
    data.materials.append(mat)
    for f in data.polygons:
        f.use_smooth = True
    if subdiv:
        mod = ob.modifiers.new('Sculpt surface', 'SUBSURF')
        mod.levels = mod.render_levels = subdiv
    return ob


def ellipsoid(name, loc, scale, mat, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    ob = put(bpy.context.object, name, mat)
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return ob


def rounded_box(name, loc, size, mat, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = put(bpy.context.object, name, mat)
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = ob.modifiers.new('Soft worn edges', 'BEVEL')
    mod.width, mod.segments = bevel, 3
    ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return ob


def curve(name, pts, radius, mat, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions, data.resolution_u = '3D', 4
    data.bevel_depth, data.bevel_resolution = radius, 2
    sp = data.splines.new('BEZIER')
    sp.bezier_points.add(len(pts)-1)
    for p, co in zip(sp.bezier_points, pts):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, data)
    hero.objects.link(ob)
    data.materials.append(mat)
    return ob


def rings(name, sections, mat, count=48, folds=0, subdiv=1):
    # Sections: z, half width, front/back radius, centre Y.
    verts = []
    for k,(z,rx,ry,cy) in enumerate(sections):
        for j in range(count):
            a = 2*math.pi*j/count
            wobble = folds*(math.sin(a*9+k*.7)+.4*math.sin(a*17-k))
            hem = (.007*(.5+.5*math.sin(a*23))+.003*math.sin(a*11)) if name=='Tunic | tailored body' and k<2 else 0
            verts.append(((rx+wobble)*math.cos(a), cy+(ry+wobble*.55)*math.sin(a), z-hem))
    faces = [(k*count+j,k*count+(j+1)%count,(k+1)*count+(j+1)%count,(k+1)*count+j)
             for k in range(len(sections)-1) for j in range(count)]
    faces += [tuple(reversed(range(count))),tuple((len(sections)-1)*count+j for j in range(count))]
    return mesh(name,verts,faces,mat,subdiv)


def sweep(name, pts, radii, mat, aspect=1, sides=12, subdiv=1, caps=True):
    pts = [Vector(p) for p in pts]
    verts=[]
    for i,(p,r) in enumerate(zip(pts,radii)):
        tangent = (pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        across = tangent.cross(Vector((0,1,0)))
        if across.length < .01:
            across = tangent.cross(Vector((1,0,0)))
        across.normalize()
        other = tangent.cross(across).normalized()
        for j in range(sides):
            a=math.tau*j/sides
            verts.append(p+r*math.cos(a)*across+r*aspect*math.sin(a)*other)
    faces=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j)
           for i in range(len(pts)-1) for j in range(sides)]
    if caps:
        faces += [tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))]
    ob=mesh(name,verts,faces,mat,subdiv)
    uv=ob.data.uv_layers.new(name='SurfaceUV')
    for poly in ob.data.polygons:
        seam=poly.index%sides==sides-1
        for loop_index in poly.loop_indices:
            vertex=ob.data.loops[loop_index].vertex_index
            u=(vertex%sides)/sides
            if seam and u==0:u=1
            uv.data[loop_index].uv=(u,(vertex//sides)/(len(pts)-1))
    return ob


def stitches(name, pts, mat=thread, width=.003):
    # Discrete stitches following an authored seam.
    for i in range(len(pts)-1):
        a,b=Vector(pts[i]),Vector(pts[i+1])
        n=max(1,int((b-a).length/.012))
        for j in range(n):
            p=a.lerp(b,(j+.3)/n)
            q=a.lerp(b,(j+.72)/n)
            curve(name,[p,q],width*.3,mat)


def sculpt_union(parts, name, voxel=.002):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    ob=bpy.context.object;ob.name=name
    rem=ob.modifiers.new('Sculpt union','REMESH');rem.mode='VOXEL';rem.voxel_size=voxel;rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    smooth=ob.modifiers.new('Relax sculpt','SMOOTH');smooth.factor=.6;smooth.iterations=3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    reduce=ob.modifiers.new('Remove redundant voxel triangles','DECIMATE');reduce.ratio=.22
    bpy.ops.object.modifier_apply(modifier=reduce.name)
    return ob


# Legs, anatomically tapered arms and fingers.
for side in [-1,1]:
    s='L' if side==1 else 'R'
    leg = rings('Bare leg '+s,[(.16,.039,.038,.005),(.23,.043,.042,.003),(.28,.051,.047,.005),(.32,.052,.049,0),(.37,.048,.050,-.004),(.40,.053,.052,0),(.48,.066,.062,0),(.58,.072,.07,0)],skin,32,subdiv=2)
    leg.location.x=side*.080
    before=set(hero.objects)
    sweep('Arm '+s,[(side*.162,0,.855),(side*.189,-.001,.792),(side*.217,-.007,.688),(side*.231,-.014,.632),(side*.240,-.027,.573)], [.058,.052,.037,.037,.028],skin,subdiv=2)
    ellipsoid('Wrist '+s,(side*.239,-.023,.580),(.028,.025,.036),skin)
    ellipsoid('Palm '+s,(side*.242,-.033,.553),(.030,.022,.028),skin)
    for f in range(4):
        x=side*(.220+f*.014)
        z=.528 + .004*abs(f-1)
        sweep('Finger '+s+str(f),[(x,-.035,z+.009),(x,-.040,z-.019),(x,-.049,z-.038)], [.009,.008,.004],skin,sides=8,subdiv=2)
    sweep('Thumb '+s,[(side*.22,-.042,.558),(side*.208,-.060,.54),(side*.209,-.063,.526)],[.013,.012,.006],skin,subdiv=2)
    sculpt_union(list(set(hero.objects)-before),'Arm wrist and hand sculpt '+s,.0018)

# Boots: thick shaped toe, separate welt, cuff, tongue and crossed laces.
for side in [-1,1]:
    x=side*.083
    s='L' if side==1 else 'R'
    outline=[(-.048,.059),(-.057,.012),(-.065,-.070),(-.056,-.128),(-.026,-.146),(.030,-.142),(.058,-.123),(.064,-.069),(.053,.015),(.045,.060)]
    vv=[];ff=[];n=len(outline)
    for z,scale in [(.006,.90),(.010,1),(.029,1),(.034,.94)]:
        vv.extend((x+xx*scale,yy*scale,z) for xx,yy in outline)
    for row in range(3):
        for j in range(n):
            ff.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
    ff += [tuple(reversed(range(n))),tuple(3*n+j for j in range(n))]
    mesh('Boot sole | shaped heel and forefoot '+s,vv,ff,sole,2)
    vv=[];ff=[]
    for z,scale in [(.027,.84),(.036,.97),(.060,.98),(.081,.83),(.093,.45)]:
        vv.extend((x+xx*scale,yy*scale,z+.013*max(0,1-abs(yy+.015)/.09)) for xx,yy in outline)
    for row in range(4):
        for j in range(n):
            ff.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
    ff += [tuple(reversed(range(n))),tuple(4*n+j for j in range(n))]
    toe=mesh('Boot | shaped leather vamp '+s,vv,ff,leather,2)
    shaft=rings('Boot shaft '+s,[(.043,.053,.067,-.007),(.078,.054,.071,-.006),(.112,.047,.056,.002),(.14,.043,.047,.005),(.17,.048,.045,.006),(.205,.054,.05,.006),(.219,.056,.052,.006)],leather,40,folds=.002)
    shaft.location.x=x
    sculpt_union([toe,shaft],'Boot | continuous instep and ankle '+s,.0017)
    cuff=rings('Folded boot cuff '+s,[(.185,.064,.058,.007),(.19,.066,.060,.007),(.221,.063,.057,.007),(.228,.060,.054,.007)],edge,32,folds=.001)
    cuff.location.x=x
    rounded_box('Boot tongue '+s,(x,-.055,.151),(.041,.014,.106),leather,.008)
    curve('Toe cap seam '+s,[(x-.049,-.070,.064),(x-.032,-.083,.083),(x,-.088,.087),(x+.032,-.083,.083),(x+.049,-.070,.064)],.0008,edge)
    for n in range(4):
        z=.115+n*.019
        y=-.070+n*.004
        for k in [-1,1]:
            ellipsoid('Lace eyelet '+s+str(n)+str(k),(x+k*.025,y,z),(.005,.0028,.005),metal,16,8)
            curve('Cross lace '+s+str(n)+str(k),[(x+k*.024,y-.004,z),(x,y-.010,z+.008),(x-k*.022,y-.001,z+.018)],.0022,edge)
    for k in [-1,1]:
        curve('Boot bow '+s+str(k),[(x,-.061,.195),(x+k*.027,-.069,.209),(x+k*.020,-.071,.189),(x,-.061,.195)],.0022,edge)

# Garment panels and overlapping collar.
rings('Tunic | tailored body',[(.525,.150,.094,0),(.534,.158,.10,0),(.57,.152,.103,0),(.64,.123,.084,0),(.70,.123,.082,0),(.77,.141,.092,0),(.84,.168,.089,0),(.874,.144,.078,0),(.895,.075,.065,0)],cloth,64,folds=.003,subdiv=2)
for side in [-1,1]:
    sleeve=sweep('Short sleeve '+str(side),[(side*.082,0,.838),(side*.146,0,.835),(side*.193,0,.791),(side*.209,0,.760)], [.025,.061,.070,.076],cloth,aspect=.95,sides=32,subdiv=2,caps=False)
    so=sleeve.modifiers.new('Woven sleeve thickness','SOLIDIFY');so.thickness=.0025
    verts=[(side*.016,-.066,.896),(side*.08,-.063,.885),(side*.123,-.082,.841),(side*.061,-.104,.816),(side*.042,-.102,.858)]
    collar=mesh('Folded collar '+str(side),verts,[tuple(range(5))],cloth_light)
    sol=collar.modifiers.new('Collar thickness','SOLIDIFY'); sol.thickness=.005
    be=collar.modifiers.new('Collar soft edge','BEVEL'); be.width=.004; be.segments=3
    curve('Collar seam '+str(side),verts[1:4],.001,thread)
    pocket=rounded_box('Tunic pocket '+str(side),(side*.081,-.096,.58),(.092,.014,.081),cloth_light,.009)
    pocket.rotation_euler.y=side*.07
    curve('Pocket opening '+str(side),[(side*.081-.041,-.109,.615),(side*.081,-.111,.612),(side*.081+.041,-.109,.615)],.002,cloth_dark)
    stitches('Pocket stitches',[(side*.081-.038,-.109,.608),(side*.081-.038,-.109,.55),(side*.081+.038,-.109,.55),(side*.081+.038,-.109,.608)])
curve('Tunic lower binding',[(.158*math.cos(a),.102*math.sin(a),.535+.002*math.sin(9*a)) for a in [math.tau*i/64 for i in range(64)]],.0025,cloth_light,True)
ellipsoid('Neck',(0,0,.895),(.056,.055,.062),skin)

# Belt and diagonal equipment strap.
belt=rings('Waist belt',[(.633,.13,.092,0),(.638,.132,.094,0),(.68,.131,.093,0),(.685,.128,.09,0)],leather,64,subdiv=1)
for z in [.640,.678]:
    curve('Belt stitched border',[(.133*math.cos(a),.096*math.sin(a),z) for a in [math.tau*i/64 for i in range(64)]],.0012,thread,True)
curve('Belt brass buckle',[(-.022,-.099,.641),(.022,-.099,.641),(.025,-.099,.68),(-.025,-.099,.68)],.005,metal,True)
curve('Belt buckle tongue',[(0,-.106,.647),(0,-.106,.675)],.0028,metal)
for side in [-1,1]:
    pouch=rounded_box('Belt pouch '+str(side),(side*.127,-.026,.61),(.055,.072,.074),leather,.012)
    rounded_box('Pouch flap '+str(side),(side*.132,-.060,.628),(.059,.02,.046),edge,.008)
    ellipsoid('Pouch button '+str(side),(side*.132,-.073,.624),(.005,.003,.005),metal,16,10)
strappts=[(-.124,-.04,.664),(-.088,-.097,.702),(-.024,-.104,.755),(.043,-.105,.810),(.107,-.079,.868),(.13,-.01,.879),(.109,.086,.836),(.04,.128,.743),(-.078,.11,.658)]
verts=[]
for p in strappts:
    verts.extend([(p[0]-.012,p[1]-.002,p[2]+.012),(p[0]+.012,p[1]-.002,p[2]-.012)])
strap=mesh('Diagonal leather sword strap',verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(strappts)-1)],leather,2)
sol=strap.modifiers.new('Strap leather thickness','SOLIDIFY');sol.thickness=.004
for side in [-1,1]:
    pts=[(x+side*.011,y-.005,z-side*.011) for x,y,z in strappts[:6]]
    stitches('Cross strap stitch',pts,width=.0025)
curve('Strap buckle',[(.004,-.113,.770),(.03,-.113,.792),(.012,-.113,.812),(-.014,-.113,.790)],.003,metal,True)

# Continuous facial surface: cheek planes, eye sockets, nasal wings and a soft chin.
head_before=set(hero.objects)
profile=[(.907,.009,.025,.025),(.919,.038,.071,.045),(.937,.073,.099,.080),(.963,.100,.110,.112),(1.005,.129,.127,.133),(1.046,.146,.135,.143),(1.088,.152,.130,.145),(1.131,.149,.126,.142),(1.174,.135,.109,.13),(1.208,.102,.075,.10),(1.235,.055,.036,.051),(1.246,.006,.005,.005)]
def face_profile(z):
    i=next((i for i in range(len(profile)-1) if z<=profile[i+1][0]),len(profile)-2)
    t=max(0,min(1,(z-profile[i][0])/(profile[i+1][0]-profile[i][0])))
    values=[]
    for axis in range(1,4):
        a=profile[max(0,i-1)][axis];b=profile[i][axis]
        c=profile[i+1][axis];d=profile[min(len(profile)-1,i+2)][axis]
        h=profile[i+1][0]-profile[i][0]
        m0=(c-a)*h/(profile[i+1][0]-profile[max(0,i-1)][0])
        m1=(d-b)*h/(profile[min(len(profile)-1,i+2)][0]-profile[i][0])
        values.append(max(.001,(2*t**3-3*t*t+1)*b+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*c+(t**3-t*t)*m1))
    return values

def face_y(x,z):
    rx,front,_=face_profile(z)
    y=-front*math.sqrt(max(0,1-(x/rx)**2))
    nose=.019*math.exp(-(x/.019)**2-((z-1.029)/.015)**2)
    bridge=.011*math.exp(-(x/.017)**2-((z-1.063)/.036)**2)
    wings=.004*(math.exp(-((x-.017)/.012)**2)+math.exp(-((x+.017)/.012)**2))*math.exp(-((z-1.022)/.009)**2)
    cheeks=.006*(math.exp(-((x-.083)/.035)**2)+math.exp(-((x+.083)/.035)**2))*math.exp(-((z-1.026)/.025)**2)
    sockets=.008*(math.exp(-((x-.058)/.039)**2)+math.exp(-((x+.058)/.039)**2))*math.exp(-((z-1.074)/.023)**2)
    muzzle=.005*math.exp(-(x/.033)**2-((z-.982)/.015)**2)
    return y-nose-bridge-wings-cheeks+ sockets-muzzle

verts=[];N=96;rows=128
for k in range(rows):
    z=profile[0][0]+(profile[-1][0]-profile[0][0])*k/(rows-1)
    rx,front,back=face_profile(z)
    for j in range(N):
        a=math.tau*j/N;x=rx*math.cos(a)
        y=face_y(x,z) if math.sin(a)<0 else back*math.sin(a)
        verts.append((x,y,z))
faces=[(i*N+j,i*N+(j+1)%N,(i+1)*N+(j+1)%N,(i+1)*N+j) for i in range(rows-1) for j in range(N)]
# Actual socket openings: a closed facial shell otherwise hides the sclera edges.
def inside_socket(face):
    x,y,z=(sum(verts[i][axis] for i in face)/len(face) for axis in range(3))
    return y<0 and any(((x-side*.056)/.040)**2+((z-1.068-side*(x-side*.056)*.085)/.026)**2<1 for side in [-1,1])
faces=[f for f in faces if not inside_socket(f)]
faces += [tuple(reversed(range(N))),tuple((rows-1)*N+j for j in range(N))]
# Continue the face's socket boundary into the lids using shared vertices.
# Separate pasted lid patches left cracks and a visible shading step at the corners.
edge_uses={}
for face in faces:
    for a,b in zip(face,face[1:]+face[:1]):
        edge_uses.setdefault(tuple(sorted((a,b))),[]).append((a,b))
boundary=[edges[0] for edges in edge_uses.values() if len(edges)==1]
next_vertex=dict(boundary)
assert len(next_vertex)==len(boundary), 'Socket boundary must be simple manifold loops'
loops=[]
while next_vertex:
    first=next(iter(next_vertex));loop=[first];following=next_vertex.pop(first)
    while following!=first:
        loop.append(following);following=next_vertex.pop(following)
    loops.append(loop)
assert len(loops)==2, ('Expected only two open eye sockets',len(loops))
for loop in loops:
    side=1 if sum(verts[i][0] for i in loop)>0 else -1
    eye_x=side*.056;eye_z=1.068;cy=face_y(eye_x,eye_z)+.033
    targets=[]
    for i in loop:
        dx,_,dz=verts[i][0]-eye_x,verts[i][1],verts[i][2]-eye_z
        angle=math.atan2((dz-side*dx*.085)/.026,dx/.040)
        xx=.037*math.cos(angle)
        zz=(.018 if math.sin(angle)>=0 else .021)*math.sin(angle)*(.82+.18*abs(math.sin(angle)))+side*xx*.085
        targets.append((xx,zz))
    previous=loop
    for row in range(1,7):
        t=row/6;current=[]
        for original,(inner_x,inner_z) in zip(loop,targets):
            bx,by,bz=verts[original]
            xx=(bx-eye_x)*(1-t)+inner_x*t;zz=(bz-eye_z)*(1-t)+inner_z*t
            spherical=cy-math.sqrt(max(.00005,.046**2-xx*xx-zz*zz))
            y=face_y(eye_x+xx,eye_z+zz)*(1-t)+spherical*t-.0008*math.sin(math.pi*t/2)
            current.append(len(verts));verts.append((eye_x+xx,y,eye_z+zz))
        for j in range(len(loop)):
            k=(j+1)%len(loop)
            faces.append((previous[j],current[j],current[k],previous[k]))
        previous=current
head=mesh('Face | continuous cheek socket nose sculpt',verts,faces,skin,1)
face_mat=skin.copy();face_mat.name='Skin | painted cheek and nose warmth'
head.data.materials[0]=face_mat
colors=head.data.color_attributes.new(name='SkinTint',type='FLOAT_COLOR',domain='POINT')
for v,col in zip(head.data.vertices,colors.data):
    x,y,z=v.co
    cheek=math.exp(-((abs(x)-.089)/.026)**2-((z-1.017)/.023)**2)*max(0,-y/.13)
    nose=math.exp(-(x/.025)**2-((z-1.030)/.022)**2)*max(0,-y/.14)
    amount=min(.35,cheek*.23+nose*.17)
    base=Vector((.64,.38,.25));warm=Vector((.66,.27,.20))
    col.color=(*base.lerp(warm,amount),1)
attr=face_mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='SkinTint'
face_mat.node_tree.links.new(attr.outputs['Color'],face_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for side in [-1,1]:
    pts=[(side*.136,.002,1.06),(side*.169,-.005,1.062),(side*.202,.024,1.096),(side*.194,.016,1.074),(side*.177,-.002,1.035),(side*.145,-.005,1.028)]
    e=mesh('Pointed ear '+str(side),pts,[tuple(range(6))],skin,2)
    so=e.modifiers.new('Ear thickness','SOLIDIFY');so.thickness=.014
    inner=[(side*.150,-.014,1.057),(side*.179,-.013,1.060),(side*.193,.010,1.085),(side*.173,-.016,1.041)]
    mesh('Ear inner fold '+str(side),inner,[tuple(range(4))],earskin,2)
    curve('Ear helix '+str(side),[pts[0],pts[1],pts[2],pts[3],pts[4]],.0035,skin)
    x=side*.011;z=1.017
    ellipsoid('Nostril recess '+str(side),(x,face_y(x,z)-.001,z),(.003,.001,.0018),earskin,16,8)
# Lip planes blend into the face; the mouth line remains a recessed fine crease.
for upper in [True,False]:
    vs=[];fs=[]
    for row in range(5):
        t=row/4
        for j in range(33):
            x=-.023+.046*j/32;envelope=max(0,1-(x/.023)**2)
            centre=.981+.0015*math.exp(-((abs(x)-.006)/.004)**2)
            z=centre+(1 if upper else -1)*(.004 if upper else .005)*envelope*t
            bulge=.0012*math.sin(math.pi*t)*envelope
            vs.append((x,face_y(x,z)-.0005-bulge,z))
    for row in range(4):
        for j in range(32):
            n=row*33+j;fs.append((n,n+1,n+34,n+33))
    mesh(('Upper' if upper else 'Lower')+' lip sculpt',vs,fs if upper else [tuple(reversed(f)) for f in fs],lip,1)
curve('Mouth crease',[(x,face_y(x,.981)-.0014,.981+.001*math.exp(-((abs(x)-.006)/.004)**2)) for x in [-.022,-.015,-.008,0,.008,.015,.022]],.00045,mouth)

# Spherical eye surfaces under overlapping lids, with a calmer upper lid line.
for side in [-1,1]:
    x=side*.056;z=1.068;cy=face_y(x,z)+.033
    def eye_surface(xx,zz):
        return cy-math.sqrt(max(.00005,.046**2-xx*xx-zz*zz))
    def aperture(a,r=1):
        xx=.037*math.cos(a)*r
        zz=(.018 if math.sin(a)>=0 else .021)*math.sin(a)*(.82+.18*abs(math.sin(a)))*r+side*xx*.085
        return xx,zz
    ev=[(x,eye_surface(0,0),z)];ef=[];steps=64
    for k in range(1,9):
        for j in range(steps):
            xx,zz=aperture(math.tau*j/steps,k/8)
            ev.append((x+xx,eye_surface(xx,zz),z+zz))
    ef += [(0,1+j,1+(j+1)%steps) for j in range(steps)]
    for k in range(7):
        a=1+k*steps;b=a+steps
        ef.extend((a+j,b+j,b+(j+1)%steps,a+(j+1)%steps) for j in range(steps))
    eye=mesh('Eye white '+str(side),ev,ef,white,1)
    eye['authored_almond']=True
    def eye_disc(name,radius,mat,offset):
        v=[(x,eye_surface(0,0)-offset,z)];f=[]
        for k in range(1,7):
            for j in range(steps):
                a=math.tau*j/steps;xx=radius*k/6*math.cos(a);zz=radius*k/6*math.sin(a)
                # Clip the iris to the same almond opening as the sclera.
                # A hidden full disc otherwise protrudes through the eyelid during reduction.
                limit=(.018 if zz>=0 else .021)*math.sqrt(max(0,1-(xx/.037)**2))
                zz=max(-limit,min(limit,zz))+side*xx*.085
                v.append((x+xx,eye_surface(xx,zz)-offset,z+zz))
        f += [(0,1+j,1+(j+1)%steps) for j in range(steps)]
        for k in range(5):
            a=1+k*steps;b=a+steps
            f.extend((a+j,b+j,b+(j+1)%steps,a+(j+1)%steps) for j in range(steps))
        return mesh(name+str(side),v,f,mat,1)
    eye_disc('Iris rim ',.023,irisrim,.00035)
    eye_disc('Iris teal ',.022,iris,.0006)
    eye_disc('Pupil ',.010,pupil,.00085)
    for dx,dz,rad in [(-.0035,.0045,.0018),(.004,-.005,.0006)]:
        ellipsoid('Eye catchlight',(x+dx,eye_surface(dx,dz)-.0012,z+dz),(rad,.0005,rad),shine,16,8)
    inner=[]
    for j in range(33):
        xx,zz=aperture(math.pi*j/32)
        inner.append((x+xx,eye_surface(xx,zz)-.0011,z+zz))
    curve('Upper lash edge '+str(side),inner,.00065,hairmats[0])
    for j in range(25):
        xx=x+side*(-.023+.05*j/24);zz=1.105+.007*j/24+.002*math.sin(math.pi*j/24)
        curve('Eyebrow hair',[(xx,face_y(xx,zz)-.001,zz),(xx+side*.003,face_y(xx,zz)-.0015,zz+.0035)],.0005,hairmats[0])

# Hair cap tucked under the green cap, plus layered asymmetric tapered locks.
hv=[];hf=[];cols=64;rows=20
for k in range(rows):
    for j in range(cols):
        a=math.tau*j/cols;end=1.28+1.04*max(0,math.sin(a))+.06*math.sin(3*a+.4)
        phi=.015+(end-.015)*k/(rows-1)
        hv.append((.158*math.sin(phi)*math.cos(a),.005+.148*math.sin(phi)*math.sin(a),1.15+.107*math.cos(phi)))
for k in range(rows-1):
    for j in range(cols):
        hf.append((k*cols+j,k*cols+(j+1)%cols,(k+1)*cols+(j+1)%cols,(k+1)*cols+j))
hair_shell=mesh('Hair | connected fringe and nape mass',hv,hf,hairmats[1],1)
so=hair_shell.modifiers.new('Hair mass thickness','SOLIDIFY');so.thickness=.004
uv=hair_shell.data.uv_layers.new(name='SurfaceUV')
for poly in hair_shell.data.polygons:
    for li in poly.loop_indices:
        vi=hair_shell.data.loops[li].vertex_index;u=(vi%cols)/cols
        if poly.index%cols==cols-1 and u==0:u=1
        uv.data[li].uv=(u,(vi//cols)/(rows-1))
locks=[
    [(-.065,-.05,1.225),(-.11,-.145,1.194),(-.139,-.154,1.153),(-.133,-.137,1.10)],
    [(-.055,-.09,1.232),(-.016,-.172,1.210),(.035,-.181,1.165),(.084,-.149,1.111)],
    [(-.045,-.05,1.239),(.035,-.145,1.229),(.098,-.164,1.18),(.142,-.131,1.12)],
    [(-.045,-.05,1.233),(-.075,-.155,1.212),(-.11,-.179,1.156),(-.12,-.15,1.111)],
    [(.08,-.024,1.226),(.142,-.11,1.194),(.165,-.11,1.118),(.151,-.044,1.068)],
    [(-.10,-.021,1.212),(-.146,-.084,1.171),(-.163,-.073,1.112),(-.147,-.039,1.062)],
]
for side in [-1,1]:
    for n in range(2):
        locks.append([(side*.125,.045+n*.043,1.14),
                      (side*.15,.055+n*.035,1.087),
                      (side*.157,.045+n*.023,1.037),
                      (side*(.16-.017*n),.029+n*.039,1.005)])
def hair_lock(name,points,width,mat):
    # Cubic ribbons keep a flowing taper instead of the old four-ring bulb shape.
    p=[Vector(v) for v in points];centres=[];radii=[]
    for j in range(33):
        t=j/32
        centres.append((1-t)**3*p[0]+3*(1-t)**2*t*p[1]+3*(1-t)*t*t*p[2]+t**3*p[3])
        radii.append(width*(.32*(1-t)+.90*math.sin(math.pi*t)**.7)+.0003)
    return sweep(name,centres,radii,mat,aspect=.38,sides=16,subdiv=1)
for i,pts in enumerate(locks):
    rad=[.026,.027,.030,.022,.025,.025][i] if i<6 else .020
    hair_lock('Hair | swept layered clump %02d'%i,pts,rad,hairmats[1+i%3])
    if i<6:
        overlay=[(x+.006,y-.008,z-.003) for x,y,z in pts]
        hair_lock('Hair | overlapping fringe layer %02d'%i,overlay,rad*.29,hairmats[1+(i+1)%3])
for i in [1,3]:
    pts=[Vector(p) for p in locks[i]]
    for k,p in enumerate(pts):
        p.x+=.011;p.y-=.007;p.z-=.009*k/3
    sweep('Hair | stray swept tip '+str(i),pts,[.004,.010,.008,.0005],hairmats[2],aspect=.4,sides=10,subdiv=2)

# A fitted dome and a descending tail are voxel-unioned into one cloth volume.
# This is a sculpt base; retopology is still needed before deformation rigging.
cv=[]; cf=[]; cn=64; rows=20
for k in range(rows):
    for j in range(cn):
        a=math.tau*j/cn
        edge_phi=1.95+.30*max(0,math.sin(a))
        phi=.01+(edge_phi-.01)*k/(rows-1)
        cv.append((.156*math.sin(phi)*math.cos(a),.023+.145*math.sin(phi)*math.sin(a),1.168+.117*math.cos(phi)))
for k in range(rows-1):
    for j in range(cn):
        cf.append((k*cn+j,(k+1)*cn+j,(k+1)*cn+(j+1)%cn,k*cn+(j+1)%cn))
cf.extend([tuple(range(cn)),tuple(reversed([(rows-1)*cn+j for j in range(cn)]))])
cap=mesh('Cap | fitted dome',cv,cf,cloth)
tail=sweep('Cap | tail sculpt',[(0,.10,1.20),(0,.185,1.215),(0,.239,1.155),(0,.255,1.045),(0,.238,.974),(0,.211,.938)], [.080,.096,.074,.045,.024,.001],cloth,aspect=.85,sides=32,subdiv=2)
bpy.ops.object.select_all(action='DESELECT')
cap.select_set(True);tail.select_set(True);bpy.context.view_layer.objects.active=tail
bpy.ops.object.convert(target='MESH')
bpy.context.view_layer.objects.active=cap
bpy.ops.object.join()
cap.name='Cap | continuous sculpted cloth'
rem=cap.modifiers.new('Union fitted crown and tail','REMESH');rem.mode='VOXEL';rem.voxel_size=.003;rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
sm=cap.modifiers.new('Cloth relaxation','SMOOTH');sm.factor=.7;sm.iterations=4
bpy.ops.object.modifier_apply(modifier=sm.name)
reduce=cap.modifiers.new('Remove redundant voxel triangles','DECIMATE');reduce.ratio=.25
bpy.ops.object.modifier_apply(modifier=reduce.name)
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
bvh=BVHTree.FromObject(cap,bpy.context.evaluated_depsgraph_get())
def on_cap(p,offset=.0015):
    hit,normal,_,_=bvh.find_nearest(Vector(p))
    return hit+normal*offset
band=[on_cap(p) for p in cv[-cn:]]
curve('Cap | fitted stitched band',band,.003,cloth_dark,True)
seam=[on_cap(p) for p in [(0,-.122,1.211),(0,-.081,1.271),(0,.012,1.288),(0,.113,1.258),(0,.202,1.207),(0,.269,1.118),(0,.278,1.04),(0,.250,.98),(0,.212,.94)]]
curve('Cap | centre sewn seam',seam,.002,cloth_dark)
for i in range(len(seam)-1):
    a,b=Vector(seam[i]),Vector(seam[i+1])
    for j in range(max(1,int((b-a).length/.018))):
        p=a.lerp(b,(j+.5)/max(1,int((b-a).length/.018)))
        curve('Cap | cross stitch',[on_cap((p.x-.006,p.y+.001,p.z+.004)),on_cap((p.x+.006,p.y+.002,p.z-.004))],.0011,thread)

head_parts=set(hero.objects)-head_before

# Backpack and bowed wooden shield, with hand-carved original spiral.
rounded_box('Backpack | leather body',(0,.126,.746),(.227,.102,.249),leather,.037)
rounded_box('Backpack | flap',(0,.167,.858),(.239,.058,.081),edge,.018)
for side in [-1,1]:
    curve('Backpack binding '+str(side),[(side*.075,.188,.857),(side*.088,.184,.737),(side*.07,.17,.644)],.008,leather)
outline=[(-.121,.862),(-.074,.889),(0,.879),(.074,.889),(.121,.862),(.11,.742),(.063,.664),(0,.628),(-.063,.664),(-.11,.742)]
def sy(x):
    return .205+.035*(1-(x/.132)**2)
v=[(x,sy(x),z) for x,z in outline]
shield=mesh('Shield | bowed wooden face',v,[tuple(range(len(v)))],wood[1])
so=shield.modifiers.new('Shield thickness','SOLIDIFY');so.thickness=.020
be=shield.modifiers.new('Shield worn bevel','BEVEL');be.width=.004;be.segments=3
curve('Shield | raised bound rim',[(x,sy(x)+.012,z) for x,z in outline],.004,edge,True)
for x in [-.075,-.025,.025,.075]:
    low=.64+abs(x)*.48
    curve('Shield | plank seam',[(x,sy(x)+.006,low),(x+.002,sy(x)+.006,.76),(x,sy(x)+.006,.876)],.0016,sole)
for i in range(23):
    x=-.102+i*.009
    z=.682+(i%3)*.009
    curve('Shield | wood grain',[(x,sy(x)+.008,z),(x+.0018,sy(x)+.008,.755),(x-.001,sy(x)+.008,.847)],.0006,wood[0])
spiral=[]
for i in range(76):
    a=i/75*math.pi*3.5
    r=.005+.055*i/75
    x=r*math.cos(a); z=.78+r*math.sin(a)
    spiral.append((x,sy(x)+.014,z))
curve('Shield | red Kokiri spiral',spiral,.0045,red)
curve('Shield | lower red sweep',[(-.054,sy(-.054)+.014,.742),(-.018,.254,.719),(.035,sy(.035)+.014,.728),(.06,sy(.06)+.014,.746)],.004,red)
for x,z in outline[::2]:
    ellipsoid('Shield | rim pin',(x,sy(x)+.018,z),(.004,.003,.004),metal,16,8)

# Sheathed sword, hilt rising from the right shoulder.
sweep('Sword | leather scabbard',[(-.10,.122,.616),(.038,.139,.80),(.15,.139,.944)], [.022,.023,.022],leather,aspect=.45,sides=8)
curve('Sword | scabbard edge',[(-.113,.112,.622),(.025,.130,.805),(.137,.130,.95)],.002,metal)
curve('Sword | crossguard',[(.104,.135,.962),(.143,.136,.947),(.187,.136,.93)],.009,metal)
sweep('Sword | wrapped grip',[(.147,.137,.95),(.19,.135,1.016),(.207,.136,1.04)], [.014,.014,.011],leather,sides=12)
for i in range(7):
    t=i/7; p=Vector((.151,.136,.956)).lerp(Vector((.202,.136,1.035)),t)
    curve('Sword | grip winding',[(p.x+.013*math.cos(a),p.y+.012*math.sin(a),p.z-.008*math.cos(a)) for a in [math.tau*j/16 for j in range(16)]],.0016,thread,True)
ellipsoid('Sword | pommel',(.211,.136,1.047),(.018,.016,.02),metal)

# Sheet 09 has a longer tunic and a smaller head than the initial toy proportions.
# Arm length remains independent of the tunic stretch, with the shoulder fixed.
def child_z(z):
    if z<=.23:return z
    if z<.55:return .23+(z-.23)*.65
    if z<.90:return .438+(z-.55)*1.18
    return .851+(z-.90)*.90
def proportion(p,ob):
    if ob.name.startswith('Arm wrist and hand sculpt'):
        p.z=.798+(p.z-.855)*.95
    else:
        p.z=child_z(p.z)
    if ob in head_parts:
        p.x*=.86;p.y*=.88
    else:
        p.x*=.93
    return p
for ob in hero.objects:
    inv=ob.matrix_world.inverted()
    if ob.type=='MESH':
        for v in ob.data.vertices:
            v.co=inv@proportion(ob.matrix_world@v.co,ob)
    elif ob.type=='CURVE':
        for sp in ob.data.splines:
            for p in sp.bezier_points:
                # AUTO handles follow the control point. Transforming them again
                # double-shifts them and creates long loops in hair/seam curves.
                p.co=inv@proportion(ob.matrix_world@p.co,ob)

# Studio: neutral floor and soft key/fill/rim. No scenery can hide the model.
bpy.ops.object.select_all(action='DESELECT')
fabric_parts=[ob for ob in hero.objects if ob.type=='MESH' and any(m and m.name.startswith(('Tunic |','Collar |')) for m in ob.data.materials)]
for ob in fabric_parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active=fabric_parts[0]
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.02)
bpy.ops.object.mode_set(mode='OBJECT')
for ob in fabric_parts:
    assert ob.data.uv_layers, ('Missing fabric UVs',ob.name)

floor_mat=material('Studio | warm grey',(.15,.17,.155),.95)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.006))
put(bpy.context.object,'Studio floor',floor_mat,studio)
scene.world=bpy.data.worlds.new('Studio world')
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.22,.26,.28,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.38
def area(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);studio.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Key | warm softbox',(-2,-3,4),230,3,(1,.86,.69))
area('Fill | cool softbox',(2,-2,2),100,2.5,(.72,.86,1))
area('Rim | overhead',(1,2,3),290,2,(1,.89,.68))
camdata=bpy.data.cameras.new('Review camera')
cam=bpy.data.objects.new('Review camera',camdata);studio.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.ortho_scale=1.56
cam.location=(1.65,-3.5,1.63)
cam.rotation_euler=(Vector((0,0,.66))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.render.film_transparent=False
scene.unit_settings.system='METRIC'
scene['author']='Astra local | original geometry, 2026-09-13'
scene['status']='Art prototype: unrigged. Procedural material detail requires baking for glTF.'
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_distance=2.2
            a.spaces.active.region_3d.view_location=Vector((0,0,.67))
            a.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
            a.spaces.active.shading.type='MATERIAL'
            a.spaces.active.overlay.show_overlays=False
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-study.blend'),compress=True)
print(json.dumps({'saved':str(ROOT/'link-study.blend'),'objects':len(hero.objects),'status':'original unrigged art study'}))
