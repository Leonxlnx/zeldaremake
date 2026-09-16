# Combined lower-tunic repair

Retained asset: 1c08dec3c7970bf4876e199c6495cf3d80b2eb46fe23b2bab56092a20e174a4b, parent 55cc8ef3.

1172 native vertices / 4313 exported vertices. No overlap with the 202-position shoulder repair. Export changes only 20423 joint/weight bytes; original rest geometry, images, animation clips, binds and reviewed blink data are preserved. Native/export baseline rounding is bounded at 0.0000998405, due to the existing exporter pruning very small weights.

48 native samples per gait pass: severe edge samples walk196->139, run714->327, stairs358->281, idle0->0. Peak ratios are unchanged, so this does not fix all stretch. Five run-phase front overlap counts improve 455/1429/350/1335/455 -> 430/1233/347/1243/430; rest remains zero. This is a regional triangle-contact diagnostic, not full collision acceptance.

The actual player capture completed 300 records identical to the retained parent, including blink, root and feet. 150 frames encoded at 30fps and validated with ffprobe. Native front frame26 and matched game frame152 inspected: modest improvement, major high-knee garment folding remains. No hair experiments included.

Reproduce native study with study_front_hip.py JOB lateral=true, stem=combined-lateral, source=remaining-shoulders-study.blend, source_scene=Link | remaining shoulder seams study. Patch JSON records exact before/after named weights and positions. Place the patch in source-runtime; export_combined_lateral.py reuses export_shoulder_weights.py and requires the exact 55cc8ef3 parent as remaining-shoulders-candidate.glb. Native blend source is saved locally as combined-lateral-study.blend.

Typecheck/build results recorded in the delivery checkpoint. This evidence is not a gauntlet take or a claim of reference-quality completion.
