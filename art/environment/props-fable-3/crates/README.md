# Crates that differ and show their use (owner rubric #4 / #19) — fable-3, 2026-09-24

`7adeee2f`, `70619139`, `931b323a`, `c6a2e74d` on `agent/fable-3-south-props` (`props/geometry.ts crateGeometry`).
Every crate already varied by seed — aspect, four or five board rows, one board askew, one lid gap wide — but every
lid was closed and whole. Now, seeded per crate: about a third have **lost one inner lid board** (never an outermost
one, so the box still reads closed from 20 m) and show a dark interior through the slot (a gloom board under the lid;
the lit floor boards alone read as one darker lid board — the first render taught that); of the rest, half have **one
lid board knocked askew**, tilted 6–9° and riding up on its neighbours. The seed's decision is recorded in the first
board's `userData.crate` for the audit.

With the world seed: Saria's crate (by the signpost) has a knocked board, the bridge crate and the west landing's have
lost one, the plateau's is whole — four crates, three states.

- `before-after-saria-crate-knocked.jpg` — Saria's crate at 2 m: the third lid board lies tilted on its neighbours.
- `before-after-bridge-crate-open.jpg` — the toll crate at the bridge head at 4 m: the slot where a board is gone, dark
  inside.

Six views (A / B / F, the three that hold props), before `1549688c` → after `7adeee2f`: SSIM to before 1.0000 with
28–40 px changed; vs the reference A 0.2014 → 0.2014, B 0.1862 → 0.1862, F 0.2105 → 0.2105; draws 639 / 628 / 599.
Saria's crate is in B at 12 m, its knocked board a few pixels. Cost: one board fewer or the same, plus the gloom board
(12 triangles) on the open ones.
