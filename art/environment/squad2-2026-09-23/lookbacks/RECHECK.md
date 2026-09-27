# The climbing look-backs re-measured: still over, and the plateau one is 7 draws from passing

`README.md` here (2026-09-25) found the two views a climbing player gets to be 25 % over the triangle
ceiling, with the plateau look-back also over on draws. Overnight the squad took 0.25–0.37 M and ~39 draws
off every fixed view, so this re-measures the same three poses on head `2b15f687` to see where they stand.

| pose | now | on 09-25 | status |
| --- | --- | --- | --- |
| plateau, looking north over the village | 456 / 6.29 M | 484 / 6.62 M | inside W38 |
| **plateau, looking back south** | **707 / 10.95 M** | 745 / 11.15 M | **over: draws by 7, triangles by 1.95 M** |
| **the ledge top, looking back south** | 635 / **11.05 M** | 673 / 11.23 M | **over: triangles by 2.05 M** |

Both look-backs improved (−38 draws each, −0.20 M and −0.18 M) and both are still out. The plateau view is
now **seven draws** from the 700 ceiling.

## Where the cheapest lines are, from this lane's own attribution

* **Draws** (`playcost.mjs` at the plateau look-back, 09-25): trees 186, structures 169, vegetation 164,
  **character 95 for 0.211 M — 13 % of the draws for 2 % of the triangles**, the most lopsided line in the
  frame. Seven draws is a rounding error against that.
* **Triangles**: vegetation was +1.29 M of the 2.19 M this pose gains over hero A, and at the flight foot
  it is still 3.471 M and unmoved (`../vegmenu/`). The two ceilings want the same owner's attention.

Lane 2's own share keeps falling without anything left to pull: trees gave up 0.314 M at the flight foot
overnight (fable-4's work in this lane's files), and every lever this lane owns is measured inert
(`../midspend/`, `../farring/`, `../shadowcost/DEPTH-SPLIT.md`).
