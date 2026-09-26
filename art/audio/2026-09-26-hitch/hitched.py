#!/usr/bin/env python3
"""hitched.py -- measure every boot plant in a recorded walk, where the system says it put it.

    python3 art/audio/2026-09-26-hitch/hitched.py /tmp/hitch/before [/tmp/hitch/after]

Finding a footstep in the mix by ear-shaped heuristics does not work here, and the two obvious
ways both failed before this one:

  - **a high-pass** does not isolate the boots, because the bed's leaves are bright. Above 800 Hz
    a whole take sits inside 12 dB and the steps do not stand out at all.
  - **spectral-flux onsets** find the attacks, but they find every attack: 59 and 66 of them in
    two takes that contain 37 steps each. The forest has more birds in it than boots, so pairing
    take against take by onset index compares a step with a wingbeat.

So the takes carry their own answer key. `FootstepStats.scheduledAt` is the context time a contact
was scheduled FOR, and `hitched.mjs` polls it per frame, so each take arrives with the exact time
of all 37 plants and the distance walked at each. This only has to find the one global offset
between the context clock and the recording — by cross-correlating the schedule against the
envelope — and then measure where it is told to.

Loudness is the peak of the 40-250 Hz envelope in the 60 ms after the plant: the band the boot's
body lands in, chosen by measurement: 17.0-17.8 dB of crest across that band's halves against
7.6 dB at 700-2000 Hz, and its envelope autocorrelates at 0.82-0.86 on a 0.367 s lag — 2.72 steps
a second, against the 2.73 `WALK_STEP_M` predicts. Both takes walk the same ground, so plant k is
the same boot on the same flagstone and they pair one for one.
"""
import json
import math
import pathlib
import subprocess
import sys

import numpy as np

RATE = 48000
BODY_LO, BODY_HI = 40.0, 250.0
LOOK_S = 0.060
MAX_SHIFT_S = 3.0


def load(path, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", str(path)]
    if af:
        cmd += ["-af", af]
    cmd += ["-f", "f32le", "-ac", "1", "-ar", str(RATE), "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def body_env(path):
    y = load(path, f"highpass=f={BODY_LO:.0f},highpass=f={BODY_LO:.0f},lowpass=f={BODY_HI:.0f},lowpass=f={BODY_HI:.0f}")
    n = int(RATE * 5 / 1000)
    return np.sqrt(np.convolve(y * y, np.ones(n) / n, mode="same"))


def align(env, sched):
    """the one offset between the context clock and the recording, from the schedule's own comb"""
    hop = int(RATE * 0.002)
    e = env[::hop]
    best, best_at = -1.0, 0.0
    rel = np.array(sched) - sched[0]
    for shift in np.arange(0.0, MAX_SHIFT_S, 0.002):
        idx = ((rel + shift) * RATE / hop).astype(int)
        idx = idx[idx < len(e)]
        if len(idx) < 4:
            break
        score = float(e[idx].mean())
        if score > best:
            best, best_at = score, shift
    return best_at


def take(root, mode):
    path = pathlib.Path(root) / f"{mode}.webm"
    meta_path = pathlib.Path(root) / f"{mode}.json"
    if not path.exists() or not meta_path.exists():
        return None
    meta = json.loads(meta_path.read_text())
    contacts = meta.get("contacts") or []
    if len(contacts) < 4:
        return None
    sched = [c[0] for c in contacts]
    walked = [c[1] for c in contacts]
    env = body_env(path)
    shift = align(env, sched)
    rel = np.array(sched) - sched[0] + shift
    amps = []
    for s in rel:
        a, b = int(s * RATE), int((s + LOOK_S) * RATE)
        amps.append(env[a:b].max() if b <= len(env) and a >= 0 else np.nan)
    amps = np.array(amps)
    ok = np.isfinite(amps)
    return dict(at=rel[ok], walked=np.array(walked)[ok], amps=amps[ok], meta=meta, shift=shift)


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


TAKES = ("smooth", "smooth2", "blocking", "burst")


def report(root):
    rows = {m: take(root, m) for m in TAKES}
    rows = {k: v for k, v in rows.items() if v}
    if "smooth" not in rows or "blocking" not in rows:
        print(f"  {root}: nothing to read")
        return None
    print(f"\n{root}")
    print(f"  {'take':<10}{'plants':>8}{'metres':>8}{'per m':>7}{'sim s':>7}{'wall s':>8}{'median':>9}{'p90':>8}{'max':>8}{'crest':>8}")
    for mode, r in rows.items():
        a, m = r["amps"], r["meta"]
        per = (m.get("steps", 0) / m["moved"]) if m.get("moved") else float("nan")
        print(
            f"  {mode:<10}{len(a):8d}{m.get('moved', float('nan')):8.2f}{per:7.2f}{m.get('sim', float('nan')):7.1f}{m.get('wall', float('nan')):8.1f}"
            f"{db(np.median(a)):9.1f}{db(np.percentile(a, 90)):8.1f}{db(a.max()):8.1f}{db(np.percentile(a, 90)) - db(np.median(a)):7.1f} dB"
        )
    out = {}
    if "smooth2" in rows:
        out["control"] = pair(rows["smooth"], rows["smooth2"])
    out["blocking"] = pair(rows["smooth"], rows["blocking"])
    if "burst" in rows:
        out["burst"] = pair(rows["smooth"], rows["burst"])
    for key, label in (("control", "smooth against smooth"), ("blocking", "hitched against smooth"), ("burst", "burst against smooth")):
        if key not in out:
            continue
        p = out[key]
        loud = int((np.abs(p) > 3).sum())
        print(
            f"  {label:<24} {len(p)} plants: median {np.median(p):+.1f} dB, p90 {np.percentile(p, 90):+.1f}, "
            f"worst {p[np.argmax(np.abs(p))]:+.1f}; {loud} ({loud / len(p) * 100:.0f}%) over 3 dB"
        )
    return out


def pair(a, b):
    """plant k against the plant nearest it on the ground, within half a stride"""
    out = []
    for i in range(len(b["amps"])):
        j = int(np.argmin(np.abs(a["walked"] - b["walked"][i])))
        if abs(a["walked"][j] - b["walked"][i]) < 0.22:
            out.append(db(b["amps"][i]) - db(a["amps"][j]))
    return np.array(out)


def line(label, p):
    loud = int((np.abs(p) > 3).sum())
    return f"    {label:<38}{len(p):8d}{np.median(p):+9.1f}{np.percentile(p, 90):+8.1f}{p[np.argmax(np.abs(p))]:+8.1f}{loud:6d} / {len(p)}"


def main(argv):
    roots = argv or ["/tmp/hitch/before"]
    got = {r: report(r) for r in roots}
    keys = [k for k in got if got[k]]
    if len(keys) < 2:
        return
    # The headline, and the only comparison here with nothing else moving in it: the SAME pacing
    # on the same ground, recorded off the build before the change and the build after it. A take
    # against a differently-paced take carries its own confound — `burst` compresses the walk in
    # context time, so its steps sit closer together and overlap more whatever their level, and
    # `blocking` stretches it, so they sit further apart. Holding the pacing fixed cancels both.
    print(f"\n  the same pacing over the same ground, {pathlib.Path(keys[1]).name} minus {pathlib.Path(keys[0]).name}, in dB")
    print(f"    {'pacing':<38}{'plants':>8}{'median':>9}{'p90':>8}{'worst':>8}{'over 3 dB':>12}")
    for mode, label in (
        ("smooth", "smooth (the control: nothing should move)"),
        ("blocking", "a 300 ms blocking frame a second"),
        ("burst", "the world at twice the audio's clock"),
    ):
        ta, tb = take(keys[0], mode), take(keys[1], mode)
        if ta and tb:
            p = pair(ta, tb)
            moved = p[np.abs(p) > 3]
            down = int((moved < 0).sum())
            note = f"  ({down} of {len(moved)} quieter)" if len(moved) else ""
            print(line(label, p) + note)
    print("\n  and each build's own takes against its own smooth one, which carries the pacing confound")
    print(f"    {'':<38}{'plants':>8}{'median':>9}{'p90':>8}{'worst':>8}{'over 3 dB':>12}")
    for key, label in (("control", "smooth twice (the instrument)"), ("blocking", "blocking against smooth"), ("burst", "burst against smooth")):
        for k in keys:
            if key in got[k]:
                print(line(f"{pathlib.Path(k).name:<8}{label}", got[k][key]))


if __name__ == "__main__":
    main(sys.argv[1:])
