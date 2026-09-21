"""Reuse the existing 240 Hz armature carrier exporter for reviewed torso channels."""
import bpy
from pathlib import Path
from mathutils import Matrix
out=Path(__file__).resolve().parent
s=bpy.data.scenes['Link | September21 balanced torso']
r=next(o for o in s.objects if o.type=='ARMATURE')
a=r.animation_data.nla_tracks['run'].strips[0].action
carrier=bpy.data.scenes.new('Link | September21 balanced torso export')
carrier.render.fps=240
rig=r.copy();rig.data=r.data.copy();rig.animation_data_clear()
carrier.collection.objects.link(rig);rig.animation_data_create()
action=a.copy()
for layer in action.layers:
    for st in layer.strips:
        for bag in st.channelbags:
            for f in bag.fcurves:
                for k in f.keyframe_points:
                    k.co.x*=10;k.handle_left.x*=10;k.handle_right.x*=10
track=rig.animation_data.nla_tracks.new();track.name='run'
strip=track.strips.new('run',0,action);strip.action_slot=action.slots[0];track.mute=True
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
p=out.parent/'2026-09-19-run-contact/export_native.py'
exec(compile(p.read_text(encoding='utf-8'),str(p),'exec'),{'__file__':str(p),'JOB':{'scene':carrier.name,'out':str(out),'stem':'torso-balanced'}})
