"""Original Link art study. Run in Blender through MCP, or Blender --python.

Metres, Z up, facing -Y (glTF exports Y up, facing +Z). Only this script's
named scene is rebuilt; other open scenes are preserved. No external assets.
"""
import bpy
import math
import json
import hashlib
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
        bsdf.inputs['Subsurface Weight'].default_value = .065
        bsdf.inputs['Subsurface Radius'].default_value = (1, .45, .24)
        bsdf.inputs['Subsurface Scale'].default_value = .035
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
    return mat


skin = material('Skin | warm peach', (.62, .365, .22), .5)
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
    (.32,.135,.033), (.48,.245,.058), (.59,.33,.092), (.40,.186,.035)])]
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
    data.dimensions, data.resolution_u = '3D', 16
    data.bevel_depth, data.bevel_resolution = radius, 3
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


# Legs, anatomically tapered arms and fingers.
for side in [-1,1]:
    s='L' if side==1 else 'R'
    leg = rings('Bare leg '+s,[(.16,.047,.047,0),(.23,.050,.051,0),(.32,.056,.055,-.006),(.37,.049,.05,0),(.48,.066,.062,0),(.58,.072,.07,0)],skin,32,subdiv=2)
    leg.location.x=side*.080
    sweep('Arm '+s,[(side*.162,0,.855),(side*.189,-.001,.792),(side*.217,-.007,.688),(side*.231,-.014,.632),(side*.240,-.027,.573)], [.058,.052,.037,.037,.028],skin,subdiv=2)
    ellipsoid('Wrist '+s,(side*.239,-.023,.580),(.028,.025,.036),skin)
    ellipsoid('Palm '+s,(side*.242,-.033,.545),(.033,.025,.043),skin)
    for f in range(4):
        x=side*(.220+f*.014)
        z=.524 + .005*abs(f-1)
        sweep('Finger '+s+str(f),[(x,-.035,z+.016),(x,-.042,z-.012),(x,-.049,z-.02)], [.009,.008,.004],skin,sides=8,subdiv=2)
    sweep('Thumb '+s,[(side*.22,-.042,.558),(side*.208,-.060,.54),(side*.209,-.063,.526)],[.013,.012,.006],skin,subdiv=2)

# Boots: thick shaped toe, separate welt, cuff, tongue and crossed laces.
for side in [-1,1]:
    x=side*.083
    s='L' if side==1 else 'R'
    ellipsoid('Boot sole '+s,(x,-.032,.028),(.071,.115,.028),sole)
    ellipsoid('Boot welt '+s,(x,-.032,.047),(.069,.111,.020),edge)
    ellipsoid('Boot toe '+s,(x,-.052,.078),(.066,.088,.047),leather)
    shaft=rings('Boot shaft '+s,[(.062,.060,.071,-.008),(.098,.057,.067,0),(.14,.05,.052,.005),(.192,.054,.05,.006),(.213,.058,.053,.006)],leather,32,folds=.0015)
    shaft.location.x=x
    cuff=rings('Folded boot cuff '+s,[(.185,.064,.058,.007),(.19,.066,.060,.007),(.221,.063,.057,.007),(.228,.060,.054,.007)],edge,32,folds=.001)
    cuff.location.x=x
    rounded_box('Boot tongue '+s,(x,-.055,.151),(.041,.014,.106),leather,.008)
    curve('Toe cap seam '+s,[(x-.059,-.080,.081),(x-.038,-.11,.105),(x,-.12,.116),(x+.038,-.11,.105),(x+.059,-.08,.081)],.0016,thread)
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

# Head: continuous sculpted profile with cheek, bridge and nose displacement.
profile=[(.907,.016,.025,.025),(.919,.064,.081,.045),(.937,.096,.104,.080),(.963,.127,.119,.112),(1.005,.145,.132,.133),(1.046,.154,.135,.143),(1.088,.155,.130,.145),(1.131,.149,.126,.142),(1.174,.135,.109,.13),(1.208,.102,.075,.10),(1.235,.055,.036,.051),(1.246,.006,.005,.005)]
verts=[]; N=96
for z,rx,front,back in profile:
    for j in range(N):
        a=math.tau*j/N
        x=rx*math.cos(a)
        y=(front if math.sin(a)<0 else back)*math.sin(a)
        facing=max(0,-math.sin(a))**18
        nose=.031*math.exp(-(x/.022)**2-((z-1.027)/.018)**2)
        bridge=.008*math.exp(-(x/.018)**2-((z-1.061)/.038)**2)
        cheeks=.005*(math.exp(-((x-.084)/.035)**2)+math.exp(-((x+.084)/.035)**2))*math.exp(-((z-1.009)/.037)**2)
        y-=facing*(nose+bridge+cheeks)
        verts.append((x,y,z))
faces=[(i*N+j,i*N+(j+1)%N,(i+1)*N+(j+1)%N,(i+1)*N+j) for i in range(len(profile)-1) for j in range(N)]
faces += [tuple(reversed(range(N))),tuple((len(profile)-1)*N+j for j in range(N))]
mesh('Face | sculpted head',verts,faces,skin,2)
ellipsoid('Nose | soft tip',(0,-.153,1.025),(.019,.016,.014),skin)
for side in [-1,1]:
    # A broad root folded into a sharp, angled elfin ear, not a cone.
    pts=[(side*.136,.002,1.06),(side*.169,-.005,1.062),(side*.214,.005,1.087),(side*.200,.008,1.070),(side*.177,-.002,1.035),(side*.145,-.005,1.028)]
    e=mesh('Pointed ear '+str(side),pts,[tuple(range(6))],skin,2)
    so=e.modifiers.new('Ear thickness','SOLIDIFY');so.thickness=.014
    inner=[(side*.150,-.014,1.057),(side*.179,-.013,1.060),(side*.201,-.006,1.077),(side*.173,-.016,1.041)]
    e=mesh('Ear inner fold '+str(side),inner,[tuple(range(4))],earskin,2)
    curve('Ear helix '+str(side),[pts[0],pts[1],pts[2],pts[3],pts[4]],.005,skin)
    ellipsoid('Nostril '+str(side),(side*.011,-.162,1.018),(.0033,.0016,.0022),earskin,16,8)
curve('Mouth line',[(-.022,-.126,.980),(-.009,-.132,.982),(0,-.134,.981),(.010,-.132,.982),(.022,-.126,.980)],.0016,mouth)
curve('Lower lip',[(-.017,-.129,.977),(0,-.134,.975),(.017,-.129,.977)],.0030,lip)

# Almond whites and inset teal irises. Eye size is deliberately subordinate to the head.
def face_y(x):
    return -.131*math.sqrt(max(.01,1-(x/.155)**2))

for side in [-1,1]:
    x=side*.058; z=1.071
    ey=face_y(x)-.005
    ev=[(x,ey,z)]; ef=[]; steps=48
    for k in range(1,7):
        r=k/6
        for j in range(steps):
            a=math.tau*j/steps
            xx=.036*math.cos(a)*r
            zz=.022*math.sin(a)*r*(.72+.28*abs(math.sin(a)))
            ev.append((x+xx,face_y(x+xx)-.002-.003*(1-r*r),z+zz+side*xx*.055))
    ef += [(0,1+j,1+(j+1)%steps) for j in range(steps)]
    for k in range(5):
        a=1+k*steps; b=a+steps
        ef.extend((a+j,b+j,b+(j+1)%steps,a+(j+1)%steps) for j in range(steps))
    mesh('Eye white '+str(side),ev,ef,white,1)
    ellipsoid('Iris rim '+str(side),(x,ey-.001,z),(.017,.002,.018),irisrim,48,20)
    ellipsoid('Iris teal '+str(side),(x,ey-.003,z),(.0148,.0015,.0158),iris,48,20)
    ellipsoid('Pupil '+str(side),(x,ey-.005,z),(.0075,.001,.0104),pupil,32,20)
    for k in range(24):
        a=math.tau*k/24
        curve('Iris radial fleck',[(x+.0085*math.cos(a),ey-.005,z+.0105*math.sin(a)),(x+.0135*math.cos(a),ey-.004,z+.0145*math.sin(a))],.00045,metal if k%5==0 else irisrim)
    for offset,rad in [((-.004,ey-.007,.005),.0035),((.005,ey-.006,-.006),.0015)]:
        ellipsoid('Eye catchlight',(x+offset[0],offset[1],z+offset[2]),(rad,.001,rad),shine,16,8)
    for upper in [True,False]:
        angles=[math.pi*i/16+(0 if upper else math.pi) for i in range(17)]
        lidpts=[]
        for a in angles:
            xx=.036*math.cos(a)
            lidpts.append((x+xx,face_y(x+xx)-.003,z+.022*math.sin(a)*(.72+.28*abs(math.sin(a)))+side*xx*.055))
        curve(('Upper' if upper else 'Lower')+' eyelid '+str(side),lidpts,.0038 if upper else .0025,skin)
        if upper:
            curve('Fine upper lash '+str(side),[(p[0],p[1]-.002,p[2]-.0015) for p in lidpts],.0011,hairmats[0])
    curve('Golden eyebrow '+str(side),[(x-side*.032,-.112,1.107),(x,-.130,1.116),(x+side*.030,-.112,1.109)],.0038,hairmats[0])

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
    sweep('Hair | tapered lock %02d'%i,pts,[rad*.55,rad,rad*.60,.001],hairmats[1+i%3],aspect=.40,sides=12,subdiv=2)
    # Three slender ridges run with each lock and remain separate editable curves.
    for strand in [-1,0,1]:
        line=[(x+strand*rad*.24,y-.009*(1-k/len(pts)),z+.001) for k,(x,y,z) in enumerate(pts)]
        curve('Hair | strand %02d'%i,line,.0009,hairline)
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
curve('Shield | raised bound rim',[(x,sy(x)+.012,z) for x,z in outline],.008,edge,True)
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
    spiral.append((x,sy(x)+.023,z))
curve('Shield | red Kokiri spiral',spiral,.009,red)
curve('Shield | lower red sweep',[(-.054,sy(-.054)+.024,.742),(-.018,.264,.719),(.035,sy(.035)+.024,.728),(.06,sy(.06)+.024,.746)],.008,red)
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
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'link-study.blend'))
print(json.dumps({'saved':str(ROOT/'link-study.blend'),'objects':len(hero.objects),'status':'original unrigged art study'}))
