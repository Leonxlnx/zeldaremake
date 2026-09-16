# Shorter-stride run review

Candidate `ace15addbd2478864f5e46d34e2ef12d18e1ddea60c598bf333d642bf3941e06` pairs with run stride 1.82 m, cycle 28/60 s, and normalized hero phase 15/34. Travel speed remains 3.9 m/s. The prior cycle was 34/60 s and 2.21 m.

The existing Blender leg solver rebuilds the hip and leg channels. Other run channels retain their output values with retimed inputs; idle, walk, stairs, mesh, images, bind data, and reviewed blink data remain exact. `export_run_cadence.py` appends animation accessors to the retained GLB without modifying its original binary bytes. Do not replace the game asset with the full native exporter output: it lacks the reviewed blink-normal postprocess.

Native shoe clearance was sampled at 137 phases. Minimum height improves from 3.82 to 4.06 mm; maximum stance height stays 6.97 mm. The cadence-change check compares the contact envelope rather than identical phase heights, since the leg poses differ. Minimum knee-to-hip vertical separation improves from 20.8 to 63.4 mm. The native loop closes exactly and solver stance residual is below 0.000001 m.

Actual-game comparisons use 300 frames at 60 Hz. The IK root offset alone worsens (maximum step 7.52 to 13.06 mm), but measured world-space hip steps improve: running maximum 45.29 to 31.59 mm, stopping 50.59 to 15.65 mm. Head and chest measurements agree; walking is unchanged. These metrics are not a perceptual quality score. The saved five-second video and still show the candidate; final character quality is not achieved.

`run-cadence-action.blend` contains the editable native action only. The complete 118.96 MB study stays locally at `art/characters/link/experiments/2026-09-13/source-runtime/run-cadence-study.blend` in the primary workspace, scene `Link | shorter stride run study v2`. Generation, clearance and export helpers live beside that source-runtime directory. The earlier restricted tunic-weight experiment was not included because its visual gain was too small.

Full 1,620-frame gameplay review completed without page errors or reach clamps. All 1,320 stair records match the retained baseline exactly, excluding the newly added torso measurements. Sampled shoe-to-stair gaps stay positive (ascent minimum 4.05 mm, descent 3.23 mm). See `stair-validation.json`; this is sampled contact evidence, not an exhaustive collision proof.
