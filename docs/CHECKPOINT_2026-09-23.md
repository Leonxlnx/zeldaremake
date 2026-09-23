# September 23 cinematic checkpoint

This checkpoint freezes the reviewed forest and Link for a 30-second native 1920×1080 cinematic. It includes the partner village, stone, timber, lantern and audio work already integrated in `86d2a682`, current Link `7f406e40…`, the tilted-stance support repair `4cf09bc5`, and the accepted close-crown/pool files from `1d5f1280`, `e7fa0811` and `31d1de8c`.

The world remains playable. Background NPCs stay hidden as requested. Current camera, lighting and visibility policies are preserved; no source change is made solely for a filmed viewpoint. Other agents can continue on their branches; the recording will use this fixed checkout rather than a moving development server.

Validation before the final native checkpoint run: 23 pool tests, typecheck, build and source anti-cheat pass. Evidence:

- [Crown geometry and bounded memory](../art/environment/astra-distance-pool/README.md).
- [Actual-player stair contact replay](../art/characters/link/progress/2026-09-23-stance-native/README.md).
- [Earlier 15-frame native 1080p camera preflight](../art/environment/astra-cinematic-preflight-sept23/README.md).
- [Final five-shot cut](../art/environment/astra-cinematic-final-sept23/CUT.md).

This is a showcase checkpoint, not a Phase 1 exit declaration. Strong stair knee folds and some distant foliage planes remain visible limitations. The rejected pack weighting and subtle distal-finger study are not included. Newer partner canopy placement, atmosphere, camera and NPC changes need their separate reviews and are not silently merged here.

No social-media upload is performed by preparing or recording this checkpoint. Keep the final source commit, bundle/model hashes and capture settings beside the delivered video.
