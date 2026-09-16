"""Matched native pupil-radius study reusing the existing authored iris shader."""
import bpy,math,json,hashlib
from pathlib import Path
out=Path(__file__).resolve().parent
root=Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/source-runtime')
s=bpy.context.scene;eyes=[o for o in s.objects if o.type=='MESH' and 'anatomical eye' in o.name];assert len(eyes)==2
saved=[e.data.materials[0] for e in eyes];rig=next(o for o in s.objects if o.type=='ARMATURE');pose=rig.data.pose_position
hair=next(o for o in s.objects if o.type=='MESH' and 'secondary hair' in o.name);hidden=hair.hide_render
source=(root.parent/'study_iris_material.py').read_text();shader_code=source[source.index('nodes=material.node_tree.nodes'):source.index('assert .34/.61')]
rig.data.pose_position='REST';hair.hide_render=True;s.cycles.samples=16;s.render.threads=4
records=[]
try:
 s.render.filepath=str(out/'pupil-existing.png');bpy.ops.render.render(write_still=True)
 for pupil_radius,label in [(.34,'control'),(.24,'daylight')]:
  material=saved[0].copy();material.name='Pupil radius study '+label;textured=True
  exec(compile(shader_code.replace('.34',str(pupil_radius)),'existing-iris-shader','exec'))
  for e in eyes:e.data.materials[0]=material
  s.render.filepath=str(out/('pupil-'+label+'.png'));bpy.ops.render.render(write_still=True)
  records.append({'label':label,'pupil_to_iris_radius':pupil_radius/.61,'geometry_changed':False})
  if label=='daylight':bpy.data.libraries.write(str(out/'daylight-pupil-study.blend'),{s},fake_user=True,compress=True)
finally:
 for e,m in zip(eyes,saved):e.data.materials[0]=m
 rig.data.pose_position=pose;hair.hide_render=hidden
(out/'pupil-study.json').write_text(json.dumps({'status':'Native comparison only; original materials restored','variants':records},indent=2))
