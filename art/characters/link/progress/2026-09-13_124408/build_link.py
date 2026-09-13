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
            rough = image_map(ROOT/'textures/cloth-roughness.jpg', True)
            links.new(rough.outputs[0], bsdf.inputs['Roughness'])
            # Scanned weave relief: the roughness scan also resolves the raised yarns.
            links.new(rough.outputs[0], bump.inputs['Height'])
            # Visible yarn-scale breakup with broader mottling from the scan.
            tex.inputs['Scale'].default_value=78
            tex.inputs['Detail'].default_value=3.5
            ramp.color_ramp.elements[0].position=.27
            ramp.color_ramp.elements[1].position=.72
            ramp.color_ramp.elements[0].color=(*[c*.22 for c in color],1)
            ramp.color_ramp.elements[1].color=(*[min(1,c*2.2) for c in color],1)
            links.new(tex.outputs['Fac'],bump.inputs['Height'])
            bump.inputs['Strength'].default_value=.55; bump.inputs['Distance'].default_value=.003
            bsdf.inputs['Sheen Weight'].default_value=.25
        elif texture == 'wood':
            mapping.inputs['Scale'].default_value=(1,1,1)
            source=image_map(ROOT.parents[2]/'public/textures/weathered_planks/color.jpg')
            links.new(source.outputs[0],bsdf.inputs['Base Color'])
            rough=image_map(ROOT.parents[2]/'public/textures/weathered_planks/roughness.jpg',True)
            links.new(rough.outputs[0],bsdf.inputs['Roughness'])
    return mat


skin = material('Skin | warm peach', (.57, .31, .19), .48)
earskin = material('Ear | rose inner fold', (.40, .17, .105), .67)
lip = material('Lips | muted warm rose', (.36, .13, .085), .55)
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
white = material('Eyes | warm ivory', (.78,.81,.74), .27)
irisrim = material('Eyes | dark iris rim', (.008,.057,.050), .29)
iris = material('Eyes | teal iris', (.029,.23,.19), .3)
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
            verts.append(((rx+wobble)*math.cos(a), cy+(ry+wobble*.55)*math.sin(a), z))
    faces = [(k*count+j,k*count+(j+1)%count,(k+1)*count+(j+1)%count,(k+1)*count+j)
             for k in range(len(sections)-1) for j in range(count)]
    faces += [tuple(reversed(range(count))),tuple((len(sections)-1)*count+j for j in range(count))]
    return mesh(name,verts,faces,mat,subdiv)


def sweep(name, pts, radii, mat, aspect=1, sides=12, subdiv=1):
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
    faces += [tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))]
    return mesh(name,verts,faces,mat,subdiv)


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
    sweep('Short sleeve '+str(side),[(side*.121,0,.845),(side*.163,0,.838),(side*.193,0,.792),(side*.201,0,.765)], [.062,.071,.068,.066],cloth,aspect=1.06,sides=32,subdiv=2)
    curve('Sleeve folded hem '+str(side),[(side*(.196+.052*math.cos(a)),.053*math.sin(a),.778+.016*math.cos(a)) for a in [math.tau*i/32 for i in range(32)]],.002,cloth_light,True)
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
profile=[(.907,.016,.025,.025),(.919,.061,.081,.045),(.937,.092,.104,.080),(.963,.123,.119,.112),(1.005,.144,.132,.133),(1.046,.154,.135,.143),(1.088,.155,.130,.145),(1.131,.149,.126,.142),(1.174,.135,.109,.13),(1.208,.102,.075,.10),(1.235,.055,.036,.051),(1.246,.006,.005,.005)]
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
    nose=.029*math.exp(-(x/.019)**2-((z-1.029)/.015)**2)
    bridge=.015*math.exp(-(x/.017)**2-((z-1.063)/.036)**2)
    wings=.008*(math.exp(-((x-.017)/.012)**2)+math.exp(-((x+.017)/.012)**2))*math.exp(-((z-1.022)/.009)**2)
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
faces += [tuple(reversed(range(N))),tuple((rows-1)*N+j for j in range(N))]
head=mesh('Face | continuous cheek socket nose sculpt',verts,faces,skin,1)
face_mat=skin.copy();face_mat.name='Skin | painted cheek and nose warmth'
head.data.materials[0]=face_mat
colors=head.data.color_attributes.new(name='SkinTint',type='FLOAT_COLOR',domain='POINT')
for v,col in zip(head.data.vertices,colors.data):
    x,y,z=v.co
    cheek=math.exp(-((abs(x)-.089)/.026)**2-((z-1.017)/.023)**2)*max(0,-y/.13)
    nose=math.exp(-(x/.025)**2-((z-1.030)/.022)**2)*max(0,-y/.14)
    amount=min(.35,cheek*.23+nose*.17)
    base=Vector((.57,.31,.19));warm=Vector((.57,.19,.14))
    col.color=(*base.lerp(warm,amount),1)
attr=face_mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='SkinTint'
face_mat.node_tree.links.new(attr.outputs['Color'],face_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for side in [-1,1]:
    pts=[(side*.136,.002,1.06),(side*.169,-.005,1.062),(side*.214,.005,1.087),(side*.200,.008,1.070),(side*.177,-.002,1.035),(side*.145,-.005,1.028)]
    e=mesh('Pointed ear '+str(side),pts,[tuple(range(6))],skin,2)
    so=e.modifiers.new('Ear thickness','SOLIDIFY');so.thickness=.014
    inner=[(side*.150,-.014,1.057),(side*.179,-.013,1.060),(side*.201,-.006,1.077),(side*.173,-.016,1.041)]
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
            bulge=.0025*math.sin(math.pi*t)*envelope
            vs.append((x,face_y(x,z)-.0005-bulge,z))
    for row in range(4):
        for j in range(32):
            n=row*33+j;fs.append((n,n+1,n+34,n+33))
    mesh(('Upper' if upper else 'Lower')+' lip sculpt',vs,fs,lip,1)
curve('Mouth crease',[(x,face_y(x,.981)-.0014,.981+.001*math.exp(-((abs(x)-.006)/.004)**2)) for x in [-.022,-.015,-.008,0,.008,.015,.022]],.00065,mouth)

# Smaller almond apertures, skin ribbons for lids, irregular iris fibres.
rng=random.Random(19)
for side in [-1,1]:
    x=side*.058;z=1.071;ey=face_y(x,z)-.011
    ev=[(x,ey,z)];ef=[];steps=48
    for k in range(1,7):
        r=k/6
        for j in range(steps):
            a=math.tau*j/steps;xx=.032*math.cos(a)*r
            zz=.016*math.sin(a)*r*(.7+.3*abs(math.sin(a)))+side*xx*.07
            ev.append((x+xx,face_y(x+xx,z+zz)-.0015-.0095*(1-r*r),z+zz))
    ef += [(0,1+j,1+(j+1)%steps) for j in range(steps)]
    for k in range(5):
        a=1+k*steps;b=a+steps
        ef.extend((a+j,b+j,b+(j+1)%steps,a+(j+1)%steps) for j in range(steps))
    mesh('Eye white '+str(side),ev,ef,white,1)
    ellipsoid('Iris rim '+str(side),(x,ey-.001,z),(.0148,.0018,.0145),irisrim,48,20)
    ellipsoid('Iris teal '+str(side),(x,ey-.0026,z),(.0138,.0012,.0135),iris,48,20)
    for k in range(70):
        a=math.tau*(k+rng.uniform(-.25,.25))/70
        r1=rng.uniform(.0072,.010);r2=rng.uniform(.012,.0135)
        curve('Iris fibre',[(x+r1*math.cos(a),ey-.004,z+r1*math.sin(a)),(x+r2*math.cos(a+.025),ey-.0037,z+r2*math.sin(a+.025))],rng.uniform(.0001,.00025),hairmats[1] if k%9==0 else irisrim)
    ellipsoid('Pupil '+str(side),(x,ey-.004,z),(.0070,.001,.0074),pupil,32,20)
    for offset,rad in [((-.003,ey-.006,.004),.0022),((.004,ey-.005,-.005),.0008)]:
        ellipsoid('Eye catchlight',(x+offset[0],offset[1],z+offset[2]),(rad,.0005,rad),shine,16,8)
    for upper in [True,False]:
        vs=[];fs=[];inner=[]
        for row in range(4):
            t=row/3
            for j in range(33):
                a=math.pi*j/32+(0 if upper else math.pi)
                xx=(.032+.006*t)*math.cos(a)
                zz=(.016+(.009 if upper else .006)*t)*math.sin(a)*(.7+.3*abs(math.sin(a)))+side*xx*.07
                p=(x+xx,face_y(x+xx,z+zz)-.0015*(1-t)-.0012*math.sin(math.pi*t),z+zz)
                vs.append(p)
                if row==0:inner.append(p)
        for row in range(3):
            for j in range(32):
                n=row*33+j;fs.append((n,n+1,n+34,n+33))
        mesh(('Upper' if upper else 'Lower')+' eyelid surface '+str(side),vs,fs,skin,1)
        if upper:
            curve('Upper lash edge '+str(side),[(a,b-.0007,c) for a,b,c in inner],.0005,hairmats[0])
    for j in range(28):
        xx=x+side*(-.027+.056*j/27);zz=1.108+.006*math.sin(math.pi*j/27)
        curve('Eyebrow hair',[(xx,face_y(xx,zz)-.001,zz),(xx+side*.003,face_y(xx,zz)-.0015,zz+.004)],.0005,hairmats[0])

# Hair cap tucked under the green cap, plus layered asymmetric tapered locks.
ellipsoid('Hair | under-cap volume',(0,.025,1.168),(.148,.117,.093),hairmats[0])
locks=[
    [(-.018,-.064,1.245),(-.061,-.143,1.227),(-.100,-.149,1.173),(-.131,-.131,1.122)],
    [(.011,-.082,1.249),(-.024,-.151,1.227),(-.047,-.162,1.172),(-.074,-.151,1.121)],
    [(.026,-.077,1.25),(.018,-.153,1.223),(.005,-.164,1.176),(-.024,-.152,1.126)],
    [(.033,-.074,1.247),(.062,-.146,1.223),(.070,-.156,1.181),(.093,-.137,1.139)],
    [(.07,-.047,1.235),(.115,-.120,1.205),(.128,-.132,1.154),(.155,-.101,1.121)],
    [(-.068,-.039,1.222),(-.128,-.113,1.184),(-.146,-.09,1.132),(-.159,-.051,1.102)],
    [(.10,-.025,1.207),(.143,-.082,1.17),(.151,-.07,1.115),(.158,-.044,1.091)],
]
for side in [-1,1]:
    for n in range(4):
        locks.append([(side*(.117+n*.006),.016+n*.02,1.14),
                      (side*(.151+n*.003),.021+n*.018,1.079),
                      (side*(.151+n*.001),.015+n*.014,1.026),
                      (side*(.164-n*.005),-.006+n*.015,1.00+n*.006)])
for i,pts in enumerate(locks):
    rad=.022 if i<7 else .014
    lock=sweep('Hair | tapered lock %02d'%i,pts,[rad*.55,rad,rad*.60,.001],hairmats[1+i%3],aspect=.65,sides=12,subdiv=2)
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    surface=BVHTree.FromObject(lock,bpy.context.evaluated_depsgraph_get())
    # Project fibres onto each lock so they cannot float in front of its surface.
    for strand in range(-5,6):
        line=[]
        for k in range(19):
            t=k/18*(len(pts)-1);j=min(int(t),len(pts)-2)
            p=Vector(pts[j]).lerp(Vector(pts[j+1]),t-j)
            p.x+=strand*rad*.10*(1-.8*k/18);p.y-=.020
            point,normal,_,_=surface.find_nearest(p)
            line.append(point+normal*.00035)
        curve('Hair | strand %02d'%i,line,.00032,hairline if strand%3 else hairmats[0])
for i in range(6):
    a,b=locks[i],locks[(i+1)%7]
    pts=[]
    for k in range(4):
        p=Vector(a[k]).lerp(Vector(b[k]),.48)
        p.y-=.008
        if k==3:
            p.x+=(-.008 if i%2 else .010);p.z-=.014
        pts.append(p)
    sweep('Hair | interleaved fine wisp '+str(i),pts,[.005,.013,.010,.0006],hairmats[2 if i%2 else 1],aspect=.30,sides=10,subdiv=2)

# A fitted dome and a descending tail are voxel-unioned into one cloth volume.
# This is a sculpt base; retopology is still needed before deformation rigging.
cv=[]; cf=[]; cn=64; rows=20
for k in range(rows):
    for j in range(cn):
        a=math.tau*j/cn
        edge_phi=1.68+.40*max(0,math.sin(a))
        phi=.01+(edge_phi-.01)*k/(rows-1)
        cv.append((.156*math.sin(phi)*math.cos(a),.023+.145*math.sin(phi)*math.sin(a),1.168+.117*math.cos(phi)))
for k in range(rows-1):
    for j in range(cn):
        cf.append((k*cn+j,(k+1)*cn+j,(k+1)*cn+(j+1)%cn,k*cn+(j+1)%cn))
cf.extend([tuple(range(cn)),tuple(reversed([(rows-1)*cn+j for j in range(cn)]))])
cap=mesh('Cap | fitted dome',cv,cf,cloth)
tail=sweep('Cap | tail sculpt',[(0,.119,1.196),(0,.177,1.183),(0,.219,1.121),(0,.241,1.037),(0,.231,.974),(0,.211,.938)], [.080,.078,.061,.038,.022,.001],cloth,aspect=.85,sides=32,subdiv=2)
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

# Short bare shins and a proportionally larger head match the child reference.
# Apply the same continuous mapping to every part so equipment stays attached.
def child_z(z):
    return z if z <= .23 else (.23+(z-.23)*.56 if z < .55 else z-.1408)
for ob in hero.objects:
    inv=ob.matrix_world.inverted()
    if ob.type=='MESH':
        for v in ob.data.vertices:
            p=ob.matrix_world@v.co;p.z=child_z(p.z);v.co=inv@p
    elif ob.type=='CURVE':
        for sp in ob.data.splines:
            for p in sp.bezier_points:
                for attr in ['co','handle_left','handle_right']:
                    q=ob.matrix_world@getattr(p,attr);q.z=child_z(q.z);setattr(p,attr,inv@q)

# Studio: neutral floor and soft key/fill/rim. No scenery can hide the model.
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
scene.render.threads_mode='FIXED';scene.render.threads=6
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
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-study.blend'))
print(json.dumps({'saved':str(ROOT/'link-study.blend'),'objects':len(hero.objects),'status':'original unrigged art study'}))
