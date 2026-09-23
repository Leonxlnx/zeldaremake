# Clearer near air and restrained shafts

The owner's daylight direction is retained. Thin the 8–15 m fog segment from .028/m to .012/m (below the .018/m base); the existing catch-up calculation restores the same optical depth at 22 m. Reduce additive ray intensity from .5 to .32 and its sky contribution from .45 to .25. Geometry, flower materials, shadow culling and postfx softening are unchanged.

The eight-view native override probe is identified by manifest.json. Six clean HUD-off comparisons use the same baseline as the shadow stability review. D purple fraction rises .00298 → .00334; hue differences remain below 10 degrees; overexposure is zero. Reference SSIM declines further by .005–.009, an explicit tradeoff for clearer daylight, not a reference-match claim. The sky-opening and shadow-contact images are direct captures.

Default build validated separately in take-0110 (HUD on, time 12.5, settle 6): 24/50, phase 1 20/42; D purple .00334; zero console errors and determinism difference; 84 anti-cheat checks pass. Local ledger entry remains local and append-only; evidence is copied intact here, not published as another agent's monitor history. This is a dirty-source local take at parent 0db9ec27, with generated provenance in take.json.

The physical-only fanMix=0 experiment was rejected as too diffuse; the existing shaft structure remains. CI must independently confirm the colour margin.
