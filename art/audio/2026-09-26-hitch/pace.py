#!/usr/bin/env python3
"""pace.py -- turn pace.json into the three estimators' error, in the units a step is heard in.

    python3 art/audio/2026-09-26-hitch/pace.py /tmp/hitch/pace.json

A speed reaching the footstep system is not a number on a readout. It picks how hard the boot
lands (`strengthFor`), whether the boot is running (`speed > RUN_SPEED` swaps the whole design),
and how far to the next one (`strideFor`); and under 0.25 m/s `drive` returns early, so no step
sounds at all and the stride integrator is reset. The error is therefore reported three ways:
the level in dB against what the true speed would have given, the share of ticks whose gait flips
to a run, and the share on which the boots simply go silent.

The first 1.5 s of each run is dropped: Link accelerates into his walk over `PLAYER_ACCEL`, and a
low speed there is the truth, not an error.
"""
import json
import math
import sys

# src/audio/footsteps.ts
WALK_SPEED = 1.2
RUN_GROUND_SPEED = 2.2
RUN_SPEED = (WALK_SPEED + RUN_GROUND_SPEED) / 2
STEP_FORCE_STILL = 0.12
STEP_FORCE_WALK = 0.45
STEP_FORCE_RUN = 1.0
STOP_SPEED = 0.25
SETTLE_S = 1.5

EST = (("old", "wall, clamped"), ("wall", "wall, true"), ("sim", "sim"))


def strength_for(speed):
    if speed <= WALK_SPEED:
        return STEP_FORCE_STILL + (STEP_FORCE_WALK - STEP_FORCE_STILL) * max(0.0, speed / WALK_SPEED)
    over = (speed - WALK_SPEED) / max(0.1, RUN_GROUND_SPEED - WALK_SPEED)
    return min(1.0, STEP_FORCE_WALK + (STEP_FORCE_RUN - STEP_FORCE_WALK) * over)


def estimators(ticks):
    """(clamped-wall, true-wall, sim) speed per audio tick, plus both frame lengths."""
    rows = []
    held = 0.0
    t_start = ticks[0][0]
    for (t0, x0, z0, s0), (t1, x1, z1, s1) in zip(ticks, ticks[1:]):
        if not all(map(math.isfinite, (x0, z0, x1, z1))):
            continue
        d_wall = (t1 - t0) / 1000.0
        d_sim = s1 - s0
        moved = math.hypot(x1 - x0, z1 - z0)
        if d_sim > 0:
            sim = moved / d_sim
            held = sim
        else:
            # the simulation did not advance, so he did not move and there is no new speed to
            # read; the last one still stands, and the integrator is handed no distance
            sim = held
        rows.append(
            dict(
                at=(t1 - t_start) / 1000.0,
                d_wall=d_wall,
                d_sim=d_sim,
                moved=moved,
                old=moved / max(min(0.1, d_wall), 1e-3),
                wall=moved / max(d_wall, 1e-3),
                sim=sim,
            )
        )
    return rows


def q(v, p):
    return sorted(v)[min(len(v) - 1, int(p * len(v)))] if v else float("nan")


def db(a, b):
    return 20 * math.log10(max(a, 1e-9) / max(b, 1e-9))


def summarise(name, rows, truth):
    live = [r for r in rows if r["at"] >= SETTLE_S]
    if not live:
        return
    print(f"\n  {name}  ({len(live)} ticks after the {SETTLE_S:.1f} s ramp; he is walking at {truth:.2f} m/s)")
    print(f"    frame length      {'median':>9}{'p90':>9}{'max':>9}")
    for key, label in (("d_wall", "wall"), ("d_sim", "sim")):
        v = [r[key] for r in live]
        print(f"      {label:<15}{q(v,0.5)*1000:9.1f}{q(v,0.9)*1000:9.1f}{max(v)*1000:9.1f}  ms")
    want = strength_for(truth)
    print(f"    {'estimator':<15}{'median':>8}{'p95':>8}{'|level err|':>13}{'worst':>9}{'a run':>8}{'silent':>8}")
    for key, label in EST:
        v = [r[key] for r in live]
        errs = [db(strength_for(s), want) for s in v]
        runs = sum(1 for s in v if s > RUN_SPEED) / len(v)
        silent = sum(1 for s in v if s < STOP_SPEED) / len(v)
        worst = max(errs, key=abs)
        print(
            f"    {label:<15}{q(v,0.5):8.2f}{q(v,0.95):8.2f}"
            f"{q([abs(e) for e in errs],0.5):10.1f} dB{worst:+8.1f}{runs*100:7.0f}%{silent*100:7.0f}%"
        )


def main(pathname):
    doc = json.load(open(pathname))
    print(f"the speed the footstep system is told, at {doc['tickMs']:.1f} ms a tick, on a {WALK_SPEED} m/s walk")
    for run in doc["runs"]:
        rows = estimators(run["ticks"])
        # the truth: ground covered over SIMULATION time, which is the clock he moves on. Taken
        # over the whole run rather than per tick, so it cannot be an artefact of one sample.
        late = [r for r in rows if r["at"] >= SETTLE_S]
        span = sum(r["d_sim"] for r in late)
        truth = sum(r["moved"] for r in late) / span if span > 0 else 0.0
        summarise(run["mode"], rows, truth)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/hitch/pace.json")
