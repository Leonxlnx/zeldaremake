import bpy
s=bpy.context.scene
h=next(o for o in s.objects if o.name.startswith('Link | fine rooted hair tips'))
p=h.data.materials[0].node_tree.nodes['Principled BSDF']
for link in list(p.inputs['Base Color'].links): h.data.materials[0].node_tree.links.remove(link)
p.inputs['Base Color'].default_value=(.56,.31,.105,1)
p.inputs['Roughness'].default_value=.48
s.render.filepath='E:/zeldaremake/art/characters/link/progress/2026-09-16-owner-video-review/tips-colour-after.png'
bpy.ops.render.render(write_still=True)
