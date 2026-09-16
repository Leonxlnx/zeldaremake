from pathlib import Path
source=Path(__file__).with_name('study_surface_locks.py')
code=source.read_text().replace('secondary curved hair locks','secondary curved hair locks v2')
code=code.replace("tree.ray_cast(q-direction*.02,direction,.05)","tree.ray_cast(q-direction*2,direction,4)")
code=code.replace('if hit is None:row=[];break','if hit is None or (hit-q).length>.008:row=[];break')
code=code.replace("'locks-","'locks-v2-").replace("'hair-locks-study.blend'","'hair-locks-v2-study.blend'")
exec(compile(code,str(source),'exec'))
