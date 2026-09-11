# Fable stair approach patch: integration evidence

Base source: `cea81f5c1e82efefb04caa3bfda67307901629a4` for both runs. Candidate changes ONLY the `fda213f` terrain blend in memory: `smoothstep(-0.4,-0.02,u)` becomes `smoothstep(0.04,0.36,u)`. Every loaded source hash otherwise matches. `MOVE.stepHeight=.28` and all controller/ground decisions remain unchanged.

The probe builds real current hardscape, attaches its flagstone geometry to `createGround`, and drives normal no-jump input through the real 120 Hz controller. This is CPU construction/simulation evidence, not rendered foot or body clearance proof. Only the main stair centreline and one short route were examined; the source change applies to all authored stair frames.

| Main stair centreline u | Baseline terrain / walk Y | Candidate terrain / walk Y |
|---:|---:|---:|
| -.100000 | -.146444383 / -.116444383 | .010476239 / .040476239 |
| -.050001 | -.163221859 / -.133221859 | .009866261 / .039866261 |
| -.049999 | -.163222530 / .300000000 | .009866237 / .300000000 |
| .040001 | -.151427862 / .300000000 | .003030382 / .300000000 |
| .200000 | -.037142856 / .300000000 | -.001838181 / .300000000 |
| .360001 | .077143573 / .300000000 | .075941414 / .300000000 |
| .419999 | .119999287 / .300000000 | .119815605 / .300000000 |
| .420001 | .120000715 / .600000000 | .119817068 / .600000000 |

**The unwanted entrance trench is removed in the examined route.** At the `ground.ts` footprint boundary u=-.05, the intended tread support step remains but shrinks from .433221859 m to .260133739 m, which is within the existing .28 m limit. Ground support is not mathematically continuous across this authored riser, nor should that discrete tread be described as a continuous ramp.

**Ordinary walking progresses farther but still cannot climb the full stair.** Both runs reach the same approach coordinate in 5.691667 s with zero airborne frames. Baseline then stalls at `(8.975168546,-.134398026,-1.946401218)`, u=-.051079602, rejected rise .434398026 m. Candidate climbs onto the first tread and stops at `(9.352265764,.300000000,-2.228979764)`, u=.419898631. The next requested step has walkY=.60, rise=.30, onStairs=true, blocked=false, and is rejected by the unchanged .28 guard. The separately initialized first-tread fixture reproduces the same second-riser rejection in both runs.

**No new terrain height jump at the shifted blend bounds was found.** At u=.04 and .36, samples ±1e-7 m yield terrain differences -3.11286e-8 m and +1.46252e-7 m respectively; walkY difference is zero. Across 321 samples every 1 mm from u=.04 through .36, terrain ranges from -.013016558 to .075940683 m and its largest neighbouring increment is .000731261 m. Walk support remains exactly .30 throughout. The small -1.3 cm depression is buried beneath the first tread. This checks heights, not smooth normals or hidden mesh intersections.

Rebuilding hardscape with the changed terrain keeps 65,772 rasterized slab triangles and 122,295 grid cells; covered cells change 33,695→33,694. No claim of pixel identity is made.

Action: acknowledge Fable's fix as addressing the entrance obstruction, while keeping the .32 stair-guard suggestion a proposal pending real whole-leg/boot movement validation. No generic limit increase or controller candidate was researched or applied.

Original CPU proof artifacts remain in gauntlet/tmp/current-stair-audit. The audited source is immutable local cea81f5 (tree f22eb7676ec373a28ad862cbf6a4f678d4d6c8f7, identical to published5529e85). The subsequent cloth pass changes only character materials/UVs. Integration copies the full terrain file byte-identically from Fable b70df65; its only source delta is fda213f. Root production build passes. No reference fidelity or full stair movement verdict is granted by this report.
