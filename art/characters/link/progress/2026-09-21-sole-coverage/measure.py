"""Read-only foot-family coverage and toe/ankle animation diagnosis; stdlib only."""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
CURRENT_SHA = '89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b'
HELD_SHA = '4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850'


def load(path, expected):
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected
    n = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+n])
    binary = raw[28+n:28+n+doc['buffers'][0]['byteLength']]
    return doc, binary


def values(doc, binary, index):
    a = doc['accessors'][index]
    assert 'sparse' not in a
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    fmt = '<'+{5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]*width
    size = struct.calcsize(fmt)
    view = doc['bufferViews'][a['bufferView']]
    start = view.get('byteOffset', 0)+a.get('byteOffset', 0)
    chunks = [binary[start+i*view.get('byteStride', size):start+i*view.get('byteStride', size)+size]
              for i in range(a['count'])]
    return [struct.unpack(fmt, row) for row in chunks], b''.join(chunks)


def bounds(rows):
    return {name: [op(p[k] for p in rows) for k in range(3)] for name, op in [('min', min), ('max', max)]} if rows else None


def quaternion_angle(a, b):
    a = [v/math.sqrt(sum(x*x for x in a)) for v in a]
    b = [v/math.sqrt(sum(x*x for x in b)) for v in b]
    x, y, z, w = a
    u, v, s, t = b
    relative = (w*u-x*t-y*s+z*v, w*v+x*s-y*t-z*u, w*s-x*v+y*u-z*t)
    scalar = w*t+x*u+y*v+z*s
    return 2*math.atan2(math.sqrt(sum(v*v for v in relative)), abs(scalar))*180/math.pi


def inspect_asset(doc, binary):
    primitive = doc['meshes'][2]['primitives'][0]
    attrs = primitive['attributes']
    positions, raw_pos = values(doc, binary, attrs['POSITION'])
    joints, raw_joints = values(doc, binary, attrs['JOINTS_0'])
    weights, raw_weights = values(doc, binary, attrs['WEIGHTS_0'])
    node = next(n for n in doc['nodes'] if n.get('mesh') == 2)
    names = [doc['nodes'][i]['name'] for i in doc['skins'][node['skin']]['joints']]
    dominant = [names[js[max(range(4), key=lambda k: ws[k])]] for js, ws in zip(joints, weights)]
    draw_indices, _ = values(doc, binary, primitive['indices'])
    drawn = {r[0] for r in draw_indices}
    other_minima = []
    for mi, mesh in enumerate(doc['meshes']):
        for pi, part in enumerate(mesh['primitives']):
            if (mi, pi) != (2, 0):
                part_positions, _ = values(doc, binary, part['attributes']['POSITION'])
                other_minima.append({'mesh': mi, 'primitive': pi, 'minimumY': min(p[1] for p in part_positions)})
    assert all(row['minimumY'] > .20 for row in other_minima)
    report = {'mesh': node['name'], 'meshIndex': 2, 'primitiveIndex': 0, 'vertices': len(positions),
              'coordinates': 'raw glTF mesh rest coordinates: X lateral, Y up, Z forward',
              'positionAccessorSha256': hashlib.sha256(raw_pos).hexdigest(),
              'jointAccessorSha256': hashlib.sha256(raw_joints).hexdigest(),
              'weightAccessorSha256': hashlib.sha256(raw_weights).hexdigest(),
              'otherPrimitiveMinimumYs': other_minima, 'sides': {}}
    selected = {}
    for side, sign in [('L', 1), ('R', -1)]:
        ankle = [i for i, name in enumerate(dominant) if name == 'ankle'+side]
        toe = [i for i, name in enumerate(dominant) if name == 'toe'+side]
        family = sorted(ankle+toe)
        bottom = min(positions[i][1] for i in ankle)
        assert min(positions[i][1] for i in family) == bottom
        low_ankle = [i for i in ankle if positions[i][1] <= bottom+.012]
        low_toe = [i for i in toe if positions[i][1] <= bottom+.012]
        low = sorted(low_ankle+low_toe)
        assert set(low) <= drawn, 'A selected vertex is not referenced by rendered triangles'
        # No lower same-side body vertex is silently omitted by this family rule.
        all_low = [i for i, p in enumerate(positions) if sign*p[0] > 0 and p[1] <= bottom+.012]
        assert all_low == low
        bands = []
        for band in [.001, .003, .005, .008, .012, .020, .030, .060]:
            groups = {'ankle': [i for i in ankle if positions[i][1] <= bottom+band],
                      'toe': [i for i in toe if positions[i][1] <= bottom+band]}
            bands.append({'aboveBottomM': band, **{k: {'count': len(ids), 'bounds': bounds([positions[i] for i in ids])}
                                                  for k, ids in groups.items()}})
        profile = []
        for z0, z1 in zip([-.10, 0, .05, .09, .12, .15, .18], [0, .05, .09, .12, .15, .18, .21]):
            ids = [i for i in family if z0 <= positions[i][2] < z1]
            profile.append({'forwardIntervalM': [z0, z1], 'vertices': len(ids),
                            'minimumHeightAboveBottomM': min(positions[i][1] for i in ids)-bottom if ids else None,
                            'lowBandAnkle': sum(i in low_ankle for i in ids), 'lowBandToe': sum(i in low_toe for i in ids)})
        forward_old = max(positions[i][2] for i in low_ankle)
        farthest = max(low_toe, key=lambda i: positions[i][2])
        lowest = min(low_toe, key=lambda i: positions[i][1])
        beyond = [i for i in low_toe if positions[i][2] > forward_old]
        foot_weight_min = min(sum(w for j, w in zip(joints[i], weights[i]) if names[j] in ['ankle'+side, 'toe'+side]) for i in low)
        assert foot_weight_min > .999999
        selected[side] = {'bottomY': bottom,
                          'familyBones': [{'name': name, 'skinIndex': names.index(name)} for name in ['ankle'+side, 'toe'+side]],
                          'indices': low, 'ankleIndices': low_ankle, 'omittedToeIndices': low_toe}
        report['sides'][side] = {'ankleDominantVertices': len(ankle), 'toeDominantVertices': len(toe),
            'bottomY': bottom, 'bandUpperY': bottom+.012,
            'ankleLow': {'count': len(low_ankle), 'uniquePositions': len(set(positions[i] for i in low_ankle)), 'bounds': bounds([positions[i] for i in low_ankle])},
            'omittedToeLow': {'count': len(low_toe), 'uniquePositions': len(set(positions[i] for i in low_toe)), 'bounds': bounds([positions[i] for i in low_toe])},
            'familyLow': {'count': len(low), 'uniquePositions': len(set(positions[i] for i in low)), 'bounds': bounds([positions[i] for i in low])},
            'allSameSideBodyVerticesInsideBandCovered': True, 'allSelectedVerticesReferencedByRenderedTriangles': True,
            'minimumAnklePlusToeWeight': foot_weight_min,
            'omittedBeyondAnkleProxyCount': len(beyond),
            'forwardExtentUnderestimateM': positions[farthest][2]-forward_old,
            'farthestOmitted': {'index': farthest, 'position': positions[farthest], 'heightAboveBottomM': positions[farthest][1]-bottom},
            'lowestOmitted': {'index': lowest, 'position': positions[lowest], 'heightAboveBottomM': positions[lowest][1]-bottom},
            'heightBands': bands, 'forwardHeightProfile': profile}
    return report, selected


def toe_animation(doc, binary):
    parent = {i: j for j, node in enumerate(doc['nodes']) for i in node.get('children', [])}
    result = {}
    for side in ['L', 'R']:
        name = 'toe'+side
        index = next(i for i, n in enumerate(doc['nodes']) if n.get('name') == name)
        bind = doc['nodes'][index]
        assert doc['nodes'][parent[index]]['name'] == 'ankle'+side
        clips = {}
        rotations = []
        for animation in doc['animations']:
            rows = {}
            for channel in animation['channels']:
                if channel['target']['node'] != index:
                    continue
                sampler = animation['samplers'][channel['sampler']]
                v, raw = values(doc, binary, sampler['output'])
                times, _ = values(doc, binary, sampler['input'])
                interpolation = sampler.get('interpolation', 'LINEAR')
                assert len(v) == 2 and v[0] == v[1] and interpolation in ['STEP', 'LINEAR']
                rows[channel['target']['path']] = {'keys': len(v), 'times': [r[0] for r in times],
                    'interpolation': interpolation, 'constantValue': v[0], 'maximumComponentRange': 0, 'rawValuesSha256': hashlib.sha256(raw).hexdigest()}
            assert set(rows) == {'translation', 'rotation', 'scale'}
            rotations.append(rows['rotation']['constantValue'])
            clips[animation['name']] = {'channels': rows,
                'toeRotationRelativeToBindDeg': quaternion_angle(bind.get('rotation', [0, 0, 0, 1]), rotations[-1]),
                'toePositionRelativeToBindM': math.dist(bind.get('translation', [0, 0, 0]), rows['translation']['constantValue']),
                'maximumScaleComponentRelativeToBind': max(abs(a-b) for a, b in zip(bind.get('scale', [1, 1, 1]), rows['scale']['constantValue']))}
        result[side] = {'toe': name, 'directParent': 'ankle'+side, 'clips': clips,
                       'maximumCrossClipRelativeRotationDeg': max(quaternion_angle(a, b) for a in rotations for b in rotations),
                       'conclusion': 'All three local TRS channels are constant for the full duration of every clip; no toe lift relative to ankle is authored.'}
    return result


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--current', type=Path, default=ROOT/'public/models/link/link-runtime.glb',
                    help='Current asset, restricted to the reviewed89df or4dcf hash.')
parser.add_argument('--held', type=Path, help='Historical89df-to4dcf comparison; --current must be original89df.')
args = parser.parse_args()
current_file = args.current.resolve()
current_sha = hashlib.sha256(current_file.read_bytes()).hexdigest()
assert current_sha in (CURRENT_SHA, HELD_SHA), 'Unreviewed current asset'
sources = {'current': (current_file, current_sha)}
if args.held:
    assert current_sha == CURRENT_SHA, 'Historical comparison requires the original89df control via --current'
    sources['held'] = (args.held.resolve(), HELD_SHA)
mode = 'comparison' if args.held else 'current'
loaded = {key: load(*source) for key, source in sources.items()}
reports, selections, animations = {}, {}, {}
for key, (doc, binary) in loaded.items():
    reports[key], selections[key] = inspect_asset(doc, binary)
    animations[key] = toe_animation(doc, binary)
if args.held:
    assert selections['current'] == selections['held']
    assert animations['current'] == animations['held']
assert sum(len(v['indices']) for v in selections['current'].values()) == 537
assert {side: len(row['indices']) for side, row in selections['current'].items()} == {'L': 269, 'R': 268}
replay = HERE.parent/'2026-09-21-curved-support/replay.mjs'
report = {'mode': mode, 'scope': 'Raw source geometry and complete authored clips; no rendered-terrain intersection test.',
          'inputs': {k: {'file': str(v[0]), 'sha256': v[1]} for k, v in sources.items()},
          'runtimeSha256': hashlib.sha256((ROOT/'src/world/character/glbLink.ts').read_bytes()).hexdigest(),
          'replaySha256': hashlib.sha256(replay.read_bytes()).hexdigest() if replay.exists() else None,
          'selectorCorrection': 'Original327 evidence uses ankle-dominant +12mm; >.95 ankle/+5mm defines only the separate extremal markers.',
          'assets': reports, 'toeAnimation': animations['current'],
          'decision': 'The historical ankle-only327 rule omits a meaningful low toe region; the complete ankle+toe family is537. This static asset check is separate from the follow-up terrain replay in ../2026-09-21-complete-foot/cpu-comparison.json.'}
selection = {'sourceSha256': current_sha,
             'meshIndex': 2, 'primitiveIndex': 0, 'meshNode': reports['current']['mesh'],
             'rule': 'Dominant bone ankleSIDE OR toeSIDE, rest POSITION.y <= minimum ankle-family POSITION.y +0.012.',
             'bandM': .012, 'totalVertices': 537, 'bySide': selections['current']}
if args.held:
    report['toeAnimationIdenticalAcrossAssets'] = True
    selection['heldSha256'] = HELD_SHA
    selection['sameIndicesAcrossAssets'] = True
report_path = HERE/f'coverage-{mode}.json'
report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
(HERE/f'foot-family-selection-{mode}.json').write_text(json.dumps(selection, indent=2), encoding='utf-8')
print(json.dumps({'decision': report['decision'], 'counts': {s: {k: len(v) for k, v in row.items() if isinstance(v, list)} for s, row in selections['current'].items()},
                  'clips': list(animations['current']['L']['clips']), 'output': str(report_path)}))
