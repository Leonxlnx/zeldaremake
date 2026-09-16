"""Current-character fringe shaping using the existing checked surface deformation workflow."""
from pathlib import Path
source=Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/study_hair_surface.py')
code=source.read_text()
code=code.replace("root=Path(__file__).resolve().parent/'source-runtime'", "root=Path('E:/zeldaremake/art/characters/link/progress/2026-09-16-owner-video-review')")
code=code.replace("root/'remaining-shoulders-study.blend'", "Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/source-runtime/cc0-arm-narrow-study.blend')")
code=code.replace("['Link | remaining shoulder seams study']", "['Link | narrow CC0 arm study']")
code=code.replace('front hair surface study','asymmetric fringe shape study')
code=code.replace("root/'hair-front-mask.json'", "Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/source-runtime/hair-front-mask.json')")
code=code.replace('hair-surface','fringe-shape').replace('ortho_scale=.43','ortho_scale=.46')
a=code.index('for _ in range(2):');b=code.index('changes={',a)
code=code[:a]+'''# Existing mask boundary stays fixed; blend inward over four adjacency rings.
fade={i:0.0 if i in boundary else 1.0 for i in selected}
for _ in range(4):
 fade={i:0.0 if i in boundary else min(fade[i],min((fade.get(j,0.0)+.25 for j in adj[i]),default=0.0)) for i in selected}
def smooth(t):
 t=max(0.0,min(1.0,t));return t*t*(3-2*t)
for i in selected-boundary:
 p=before[i];tip=smooth((1.125-p.z)/.085);central=1-smooth((abs(p.x)-.055)/.06)
 w=tip*central*fade[i]
 center=.036 if p.x>=0 else -.036
 # Narrow the heavy central ends and vary their length to open the brow line.
 points[i]=p+Vector((-(p.x-center)*.24,.002,.012 if p.x<0 else .006))*w
m.calc_loop_triangles()
for attempt in range(24):
 bad=set()
 for tri in m.loop_triangles:
  a,b,c=tri.vertices
  old=(before[b]-before[a]).cross(before[c]-before[a])
  new=(points[b]-points[a]).cross(points[c]-points[a])
  if old.dot(new)<0:bad.update(tri.vertices)
 if not bad:break
 for i in bad:points[i]=before[i]+(points[i]-before[i])*.5
assert not bad,len(bad)
''' +code[b:]
# A vertex can keep its position while its incident face changes. Its normal must
# follow that face; verify unrelated vertices outside this one-ring instead.
code=code.replace('asymmetric fringe shape study','asymmetric fringe shape study v2')
code=code.replace('fixed=[old_geo',"normal_vertices=set(changes)\nfor p in m.polygons:\n if set(p.vertices)&changes.keys():normal_vertices.update(p.vertices)\nfixed=[old_geo")
code=code.replace('if l.vertex_index in changes else n','if l.vertex_index in normal_vertices else n')
code=code.replace('if l.vertex_index not in changes)','if l.vertex_index not in normal_vertices)')
exec(compile(code,str(source),'exec'))

