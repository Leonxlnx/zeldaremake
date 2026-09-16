"""Reuse the checked weight-only transfer for the combined lower-tunic repair."""
from pathlib import Path
p=Path(__file__).with_name('export_shoulder_weights.py')
code=p.read_text().replace("load('closed-corner-separation')","load('remaining-shoulders')",1)
code=code.replace('4741cf3ec4fd1f8635a1bf980fc40ce5bc7722403076967b797cf2c2e4df1768','55cc8ef31f78b76f21e592d4771b085f3c0659bfd4bd2530af98a9737c4f69d9')
code=code.replace('remaining-shoulders-weight-patch','combined-lateral-weight-patch').replace('==202','==1172').replace("root/'remaining-shoulders-candidate.glb'","root/'combined-lateral-candidate.glb'").replace("new=load('remaining-shoulders')","new=load('combined-lateral')").replace('remaining-shoulders-export.json','combined-lateral-export.json')
exec(compile(code,str(p),'exec'))
