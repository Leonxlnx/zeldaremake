"""Bounded lower-face silhouette study; transport normals, retain blink and rig data."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix

out = Path(__file__).resolve().parent

def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)

def deform(p):
    x,y,z = p
    front = 1-smooth(-.095,-.045,y)
    lower = smooth(.845,.875,z)*(1-smooth(.925,.945,z))
    side = 1-smooth(.09,.125,abs(x))
    # Broad, compact falloffs preserve eye sockets and avoid a sharp mask edge.
    taper = .10*front*lower*side
    chin = .0045*front*(1-smooth(.035,.075,abs(x)))*smooth(.84,.866,z)*(1-smooth(.89,.922,z))
    return Vector((x*(1-taper),y,z-chin))

def jacobian(p):
    columns=[]
    for axis in range(3):
        a=p.copy();b=p.copy();a[axis]+=1e-5;b[axis]-=1e-5
        columns.append((deform(a)-deform(b))/2e-5)
    j=Matrix(columns).transposed()
    assert j.determinant()>.6, 'Folded deformation'
    return j

def main():
    s=bpy.context.scene
    body=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>30000)
    rig=next(o for o in s.objects if o.type=='ARMATURE')
    original=body.data; candidate=original.copy();body.data=candidate
    pose=rig.data.pose_position;rig.data.pose_position='REST'
    visibility={o.name:o.hide_render for o in s.objects}
    for o in s.objects:
        if any(t in o.name for t in ['secondary hair','forearm guard','guard stitching']):o.hide_render=True
    camera=s.camera;matrix=camera.matrix_world.copy();scale=camera.data.ortho_scale
    old_res=(s.render.resolution_x,s.render.resolution_y)
    s.render.resolution_x=720;s.render.resolution_y=820;s.cycles.samples=24;s.render.threads_mode='FIXED';s.render.threads=4
    positions=[v.co.copy() for v in original.vertices]
    changed=[i for i,p in enumerate(positions) if (deform(p)-p).length>1e-8]
    assert 50<len(changed)<4000,len(changed)
    keys=original.shape_keys.key_blocks
    # This field must not touch any authored blink displacement.
    assert all((k.data[i].co-keys[0].data[i].co).length<1e-8 for k in keys for i in changed)
    for i in changed:
        delta=deform(positions[i])-positions[i]
        for k in candidate.shape_keys.key_blocks:k.data[i].co+=delta
        candidate.vertices[i].co=positions[i]+delta
    normals=[];transforms={i:jacobian(positions[i]).inverted().transposed() for i in changed}
    for loop,n in zip(original.loops,original.corner_normals):
        normals.append((transforms[loop.vertex_index]@n.vector).normalized() if loop.vertex_index in transforms else n.vector.copy())
    candidate.normals_split_custom_set(normals);candidate.update()
    assert all(candidate.vertices[i].co==p for i,p in enumerate(positions) if i not in transforms)
    assert [[(g.group,g.weight) for g in v.groups] for v in original.vertices]==[[(g.group,g.weight) for g in v.groups] for v in candidate.vertices]
    focus=Vector((0,-.025,.97))
    try:
        for view,offset in [('front',(0,-3,.04)),('three-quarter',(1.6,-3,.06)),('profile',(3,-.25,.05))]:
            camera.location=focus+Vector(offset);camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.42
            for label,mesh in [('before',original),('after',candidate)]:
                body.data=mesh;s.render.filepath=str(out/(view+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
        body.data=candidate
        bpy.data.libraries.write(str(out/'face-proportions-study.blend'),{s},fake_user=True,compress=True)
        (out/'study.json').write_text(json.dumps({'changed_vertices':len(changed),'maximum_displacement_m':max((deform(p)-p).length for p in positions),'blink_displacements_untouched':True,'weights_unchanged':True,'status':'Native silhouette candidate; visual review pending'},indent=2))
    finally:
        body.data=original;rig.data.pose_position=pose;camera.matrix_world=matrix;camera.data.ortho_scale=scale
        s.render.resolution_x,s.render.resolution_y=old_res
        for o in s.objects:o.hide_render=visibility[o.name]

if __name__=='__main__':main()
