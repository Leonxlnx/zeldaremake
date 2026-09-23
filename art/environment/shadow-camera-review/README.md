# Native camera translation

60 native D3D11 frames translate the camera 1.2 m across the plaza, with simulation time fixed at 12.6 seconds. This isolates camera-dependent shadow movement from wind and animation. The sampled first/middle/last frames retain shadow placement on the flagstones. This is visual evidence, not a numerical no-flicker guarantee or a live frame-rate benchmark; the separate projection test checks texel phase.

The video contains frames 1–59 at 30 fps. Frame 0 starts exactly on the reference camera and triggers reference character placement; it is omitted from the video so that the switch to the free-camera spawn does not masquerade as a shadow jump. All 60 hashes/camera positions remain in manifest.json; all raw frames remain in the local timestamped capture directory. The strip shows video frames 0,29,58. No source visual overrides or image retouching.

Production source is 8341d8cd. The capture helper has the new walkFrames option (views: [], walkFrames: 60); source diff SHA is empty. Capture SHA is in the manifest. Preview build returned to index-0Rbob-4s.js after bias experiments were rejected.

Smaller shadow bias/normal bias and a stronger, tighter near AO were separately reviewed and not retained: neither clearly improved contact, while AO emphasized the slab rims. Experimental frames remain local for comparison.
