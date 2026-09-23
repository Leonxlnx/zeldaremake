"""ROOT may run in Blender: load historical actions only and inspect, never bind them.

Existing scenes, objects and source actions are not changed. New diagnostic action
copies isolate fractional legacy keys, interpolation and retiming behavior.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Quaternion

out = Path(__file__).resolve().parent
target = out / 'native-action-diagnosis.json'
assert not target.exists()
files = [
    ('cc0Narrow', Path('E:/zeldaremake/art/characters/link/experiments/2026-09-13/source-runtime/cc0-arm-narrow-study.blend'), 56),
    ('retainedFlight', Path('E:/zeldaremake/art/characters/link/progress/2026-09-19-run-contact/run-flight-retained-action.blend'), 112),
]
names = [p+s for p in ['shoulder', 'elbow', 'hand'] for s in ['L', 'R']]

def curves(action):
    return [f for l in action.layers for st in l.strips for bag in st.channelbags for f in bag.fcurves]

def angle(a, b):
    return math.degrees(2*math.acos(min(1.0, abs(a.normalized().dot(b.normalized())))))

def inspect(action, end):
    result = {'name': action.name, 'frame_range': list(action.frame_range), 'bones': {}}
    for name in names:
        fs = sorted([f for f in curves(action) if f.data_path == 'pose.bones["'+name+'"].rotation_quaternion'], key=lambda f: f.array_index)
        if not fs:
            continue
        assert [f.array_index for f in fs] == [0, 1, 2, 3]
        times = [k.co.x for k in fs[0].keyframe_points]
        samples = [Quaternion(tuple(f.evaluate(end*i/112) for f in fs)).normalized() for i in range(113)]
        result['bones'][name] = {'key_counts': [len(f.keyframe_points) for f in fs],
            'times': times, 'off_integer_key_count': sum(abs(t-round(t)) > 1e-5 for t in times),
            'interpolation': sorted(set(k.interpolation for f in fs for k in f.keyframe_points)),
            'adjacent_240hz_max_degrees': max(angle(a, b) for a, b in zip(samples, samples[1:])),
            'samples_wxyz': [list(q) for q in samples],
            'key_rows_wxyz': [[float(f.keyframe_points[i].co.y) for f in fs] for i in range(len(times))]}
    return result

report = {'kind': 'Read-only historical action inspection; diagnostic copies are never bound to rigs', 'files': []}
for label, file, end in files:
    assert file.is_file(), file
    with bpy.data.libraries.load(str(file), link=False) as (available, loaded):
        loaded.actions = [n for n in available.actions if n.lower().startswith('run')]
    row = {'label': label, 'file': str(file), 'actions': []}
    for action in loaded.actions:
        if not any(f.data_path == 'pose.bones["shoulderL"].rotation_quaternion' for f in curves(action)):
            continue
        entry = {'original': inspect(action, end)}
        copied = action.copy()
        copied.name = 'diagnostic | integer keys only | ' + label
        for f in curves(copied):
            if f.data_path.split('"')[1] in names:
                for key in list(f.keyframe_points)[::-1]:
                    if abs(key.co.x / (end/56) - round(key.co.x / (end/56))) > 1e-5:
                        f.keyframe_points.remove(key, fast=True)
                f.update()
        entry['integer_grid_only'] = inspect(copied, end)
        if label == 'cc0Narrow':
            retimed = action.copy()
            retimed.name = 'diagnostic | original in-place retime'
            for f in curves(retimed):
                for key in f.keyframe_points:
                    key.co.x *= 2
                    key.handle_left.x *= 2
                    key.handle_right.x *= 2
            entry['retime_before_update'] = inspect(retimed, end*2)
            for f in curves(retimed):
                f.update()
            entry['retime_after_update'] = inspect(retimed, end*2)
        row['actions'].append(entry)
    report['files'].append(row)
target.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'file': str(target), 'files': [{**r, 'actions': [{k: {'name': v['name'], 'bones': {n: {a: b for a, b in s.items() if a not in ['samples_wxyz', 'key_rows_wxyz', 'times']} for n, s in v['bones'].items()}} for k, v in e.items()} for e in r['actions']]} for r in report['files']]}))
