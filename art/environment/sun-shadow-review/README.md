# Sun-sized penumbra

Change one existing filter constant: distance-dependent penumbra growth .016 -> .0093 metres per metre, using the sun's angular diameter already documented by shadowfilter.ts. Keep the minimum/maximum, bias, map resolution, tap count, canopy transmission, AO and governor unchanged. This makes the distant canopy's dapple less blurred while keeping softer shadows for more distant occluders.

Seven native default views were reviewed. Compared with the clear-air pass, clean-view sharpness rises by .013–.035; reference SSIM declines .0006–.0028. Palette hue differences remain below 10.3 degrees, overexposure is zero, D purple .00336. The source manifest and exact diff are retained.

Default standard take-0111: 24/50, phase 1 20/42; zero console errors, zero determinism difference and 84 anti-cheat checks pass. It is a local dirty-source take at parent 8341d8cd, not CI-attested monitor evidence. Both the real Three.js projection test and shadow-caster culling test pass. This is a visual tuning change, not a claim that the whole world is finished.

Reduced-resolution check: native 2048-map / 8-tap A, F and shadow-contact captures also complete without page errors. These remain softer/coarser than the 4096 default; no default quality reduction. Captures and actual lighting audits are in 2048/.
