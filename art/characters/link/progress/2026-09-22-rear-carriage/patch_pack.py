"""Exact left-pack skin patch; preserve every byte except 484 selected skin rows."""
import argparse, collections, hashlib, importlib.util, json, math, struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = '7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda'
SELECTOR = '299c29a7026a41ef635d59526aa3651933a2e18550d014ecee7d9c83b4ca07e3'
CANDIDATE = 'd7426b4dd8c0b2ee7cecf02b0c5248d16986ec39c35b5b4bbf3d08a9e26cd6e0'
spec = importlib.util.spec_from_file_location('pack_gltf_reader', HERE.parent/'2026-09-21-boot-tip/check.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]

def selection():
    raw = (HERE/'pack-selection.json').read_bytes()
    assert sha(raw) == SELECTOR, 'Approved selector changed'
    report = json.loads(raw)
    assert report['sourceSha256'] == SOURCE
    left = next(c for c in report['cases'] if c['label'] == 'left_pack')
    selected = left['proposedVertexIndices']
    assert selected == sorted(set(selected)) and len(selected) == 484
    return selected

def native_body(doc, binary):
    """Native body joins the three glTF material primitives in their stored order."""
    positions, joints, weights, triangles = [], [], [], []
    for part in doc['meshes'][2]['primitives']:
        base = len(positions)
        for output, key in [(positions, 'POSITION'), (joints, 'JOINTS_0'), (weights, 'WEIGHTS_0')]:
            output.extend(reader.rows(doc, binary, part['attributes'][key])[0])
        draw = [base+r[0] for r in reader.rows(doc, binary, part['indices'])[0]]
        triangles.extend(tuple(draw[i:i+3]) for i in range(0, len(draw), 3))
    assert len(positions) == len(joints) == len(weights) == 88153 and len(triangles) == 68042
    return positions, joints, weights, triangles

def plan(doc, binary):
    selected = selection()
    attrs = doc['meshes'][2]['primitives'][0]['attributes']
    positions, joints, weights = [reader.rows(doc, binary, attrs[k])[0] for k in ('POSITION', 'JOINTS_0', 'WEIGHTS_0')]
    names = [doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']]
    chest, arm = names.index('chest'), {names.index('shoulderL'), names.index('elbowL')}
    aliases = collections.defaultdict(list)
    for i, position in enumerate(positions): aliases[position].append(i)
    assert {i for v in selected for i in aliases[positions[v]]} == set(selected), 'A coincident alias was omitted'
    assert all((joints[i], weights[i]) == (joints[v], weights[v]) for v in selected for i in aliases[positions[v]])
    formats, starts, strides = {}, {}, {}
    for key, fmt, component in [('JOINTS_0', '<4B', 5121), ('WEIGHTS_0', '<4f', 5126)]:
        accessor = doc['accessors'][attrs[key]]
        assert accessor['type'] == 'VEC4' and accessor['componentType'] == component and not accessor.get('normalized')
        view = doc['bufferViews'][accessor['bufferView']]
        uses = [(mi, pi, k) for mi, mesh in enumerate(doc['meshes']) for pi, p in enumerate(mesh['primitives'])
                for k, a in p['attributes'].items() if a == attrs[key]]
        assert uses == [(2, 0, key)]
        formats[key], starts[key], strides[key] = fmt, view.get('byteOffset', 0)+accessor.get('byteOffset', 0), view.get('byteStride', struct.calcsize(fmt))
    records, new_weights, new_joints, epsilons = [], list(weights), list(joints), []
    for v in selected:
        js, ws = joints[v], weights[v]
        active = [j for j, w in zip(js, ws) if w]
        assert len(active) == len(set(active)) and chest in active
        assert set(active) <= {chest, *arm, names.index('hips'), names.index('thighL')}
        removed = [k for k, (j, w) in enumerate(zip(js, ws)) if j in arm and w]
        assert removed
        slot = next(k for k, (j, w) in enumerate(zip(js, ws)) if j == chest and w)
        aj, aw = list(js), list(ws)
        aw[slot] = f32(ws[slot]+sum(ws[k] for k in removed))
        for k in removed: aj[k], aw[k] = 0, 0.0
        assert all((aj[k], aw[k]) == (js[k], ws[k]) for k in range(4) if k not in {*removed, slot})
        assert len([j for j, w in zip(aj, aw) if w]) == len({j for j, w in zip(aj, aw) if w})
        epsilons.append(abs(sum(aw)-sum(ws)))
        assert epsilons[-1] <= 2**-25 and abs(sum(aw)-1) < 2e-7
        new_joints[v], new_weights[v] = tuple(aj), tuple(aw)
        jo, wo = [starts[k]+v*strides[k] for k in ('JOINTS_0', 'WEIGHTS_0')]
        records.append([v, jo, wo, struct.pack('<4B', *js).hex(), struct.pack('<4B', *aj).hex(),
                        struct.pack('<4f', *ws).hex(), struct.pack('<4f', *aw).hex()])
    all_arm = {i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'hand'))}
    def masks(js, ws):
        influence = [sum(w for j, w in zip(a, b) if j in all_arm) for a, b in zip(js, ws)]
        draw = [r[0] for r in reader.rows(doc, binary, doc['meshes'][2]['primitives'][0]['indices'])[0]]
        faces = [draw[i:i+3] for i in range(0, len(draw), 3)]
        return ([i for i, tri in enumerate(faces) if all(influence[v] > .5 for v in tri)],
                [i for i, tri in enumerate(faces) if all(influence[v] < .2 for v in tri)])
    arms, opposing = masks(joints, weights)
    new_arms, new_opposing = masks(new_joints, new_weights)
    added = sorted(set(new_opposing)-set(opposing))
    assert arms == new_arms and set(opposing) <= set(new_opposing) and len(added) == 180
    return {'sourceSha256': SOURCE, 'selectorSha256': SELECTOR, 'selectedRows': 484,
            'uniquePositions': len({positions[v] for v in selected}), 'maxWeightSumChange': max(epsilons),
            'maxWeightSumError': max(abs(sum(new_weights[v])-1) for v in selected),
            'merge': 'float32(chest + shoulderL + elbowL), removed slots become joint 0 / weight 0; other slots exact',
            'bodyPrimitiveMasks': {'armsCount': len(arms), 'opposingCount': len(opposing),
                'armsSha256': sha(json.dumps(arms, separators=(',', ':')).encode()),
                'opposingSha256': sha(json.dumps(opposing, separators=(',', ':')).encode()), 'newOpposing': added}, 'rows': records}

def verify(raw, contract):
    assert contract['sourceSha256'] == SOURCE and contract['selectorSha256'] == SELECTOR
    assert [row[0] for row in contract['rows']] == selection()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc, offset = json.loads(raw[20:20+length]), 28+length
    assert struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
    restored = bytearray(raw)
    for _, jo, wo, jb, ja, wb, wa in contract['rows']:
        for start, before, after in [(jo, jb, ja), (wo, wb, wa)]:
            before, after = bytes.fromhex(before), bytes.fromhex(after)
            assert raw[offset+start:offset+start+len(after)] == after, 'An approved skin row differs'
            restored[offset+start:offset+start+len(before)] = before
    assert sha(restored) == SOURCE, 'A protected byte changed'
    assert plan(doc, restored[offset:]) == contract, 'The stored contract differs from the pinned source'
    if CANDIDATE is not None: assert sha(raw) == CANDIDATE
    attrs = doc['meshes'][2]['primitives'][0]['attributes']
    protected_views = {i['bufferView'] for i in doc['images'] if 'bufferView' in i}
    for i, accessor in enumerate(doc['accessors']):
        if i not in (attrs['JOINTS_0'], attrs['WEIGHTS_0']) and 'bufferView' in accessor:
            protected_views.add(accessor['bufferView'])
        if 'sparse' in accessor: protected_views.update(accessor['sparse'][k]['bufferView'] for k in ('indices', 'values'))
    for i in protected_views:
        view = doc['bufferViews'][i]
        start, end = offset+view.get('byteOffset', 0), offset+view.get('byteOffset', 0)+view['byteLength']
        assert raw[start:end] == restored[start:end], 'Protected data aliases a modified skin row'
    changes = [i for i, (a, b) in enumerate(zip(raw, restored)) if a != b]
    ranges = []
    for i in changes:
        if ranges and ranges[-1][1] == i: ranges[-1][1] = i+1
        else: ranges.append([i, i+1])
    return {'sourceSha256': SOURCE, 'candidateSha256': sha(raw), 'bytes': len(raw), 'changedBytes': len(changes),
            'changedByteRangesHalfOpen': ranges, 'selectedRows': 484, 'coincidentAliasesComplete': True,
            'weightSumMaxChange': contract['maxWeightSumChange'], 'weightSumMaxError': contract['maxWeightSumError'],
            'protectedJsonGeometryAnimationsTexturesAndOtherSkinRowsExact': True, 'reverseSourceSha256': sha(restored),
            'armFaces': contract['bodyPrimitiveMasks']['armsCount'], 'oldOpponentFaces': contract['bodyPrimitiveMasks']['opposingCount'],
            'additionalOpponentFaces': len(contract['bodyPrimitiveMasks']['newOpposing'])}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['prepare', 'check'])
    parser.add_argument('path', type=Path)
    args = parser.parse_args()
    if args.mode == 'prepare':
        raw, doc, binary = reader.load(args.path, SOURCE)
        contract = plan(doc, binary)
        offset = 28+struct.unpack_from('<I', raw, 12)[0]
        patched = bytearray(raw)
        for _, jo, wo, _, ja, _, wa in contract['rows']:
            patched[offset+jo:offset+jo+4] = bytes.fromhex(ja)
            patched[offset+wo:offset+wo+16] = bytes.fromhex(wa)
        result = verify(patched, contract)
        with (HERE/'pack-left-candidate.glb').open('xb') as stream: stream.write(patched)
        (HERE/'pack-skin-contract.json').write_text(json.dumps(contract, separators=(',', ':'))+'\n')
    else:
        raw = args.path.read_bytes()
        contract = json.loads((HERE/'pack-skin-contract.json').read_text())
        result = verify(raw, contract)
    (HERE/'pack-preservation.json').write_text(json.dumps(result, separators=(',', ':'))+'\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'changedByteRangesHalfOpen'}))

if __name__ == '__main__': main()
