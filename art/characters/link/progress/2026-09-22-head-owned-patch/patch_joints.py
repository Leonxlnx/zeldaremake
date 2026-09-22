"""Exact 243-entry GLB joint patch and native/preservation check; no geometry export."""
import argparse, hashlib, importlib.util, json, math, struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE_SHA = '4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850'
CANDIDATE_SHA = '1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5'
spec = importlib.util.spec_from_file_location('boot_preservation', HERE.parent / '2026-09-21-boot-tip/check.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def contract(doc, binary):
    evidence = json.loads((HERE / 'head-island-summary.json').read_text())
    assert evidence['assetSha256'] == SOURCE_SHA
    selected = evidence['selectedHeadVertexIndices']
    assert len(selected) == len(set(selected)) == 243
    attrs = doc['meshes'][2]['primitives'][0]['attributes']
    uses = [(mi, pi, name) for mi, mesh in enumerate(doc['meshes']) for pi, part in enumerate(mesh['primitives'])
            for name, index in part['attributes'].items() if index == attrs['JOINTS_0']]
    assert uses == [(2, 0, 'JOINTS_0')], 'The modified accessor must not serve another primitive'
    node = next(n for n in doc['nodes'] if n.get('mesh') == 2)
    names = [doc['nodes'][n]['name'] for n in doc['skins'][node['skin']]['joints']]
    weights, _ = reader.rows(doc, binary, attrs['WEIGHTS_0'])
    joints, _ = reader.rows(doc, binary, attrs['JOINTS_0'])
    accessor = doc['accessors'][attrs['JOINTS_0']]
    assert accessor['type'] == 'VEC4' and accessor['componentType'] in (5121, 5123) and not accessor.get('normalized')
    width, code = {5121: (1, 'B'), 5123: (2, 'H')}[accessor['componentType']]
    view = doc['bufferViews'][accessor['bufferView']]
    start = view.get('byteOffset', 0)+accessor.get('byteOffset', 0)
    offsets = []
    for vertex in selected:
        active = [k for k, weight in enumerate(weights[vertex]) if weight]
        assert len(active) == 1 and weights[vertex][active[0]] == 1
        offsets.append((vertex, active[0], start+vertex*view.get('byteStride', 4*width)+active[0]*width))
    return attrs, names, weights, joints, offsets, code

def verify_bytes(raw):
    length = struct.unpack_from('<I', raw, 12)[0]
    doc, binary_offset = json.loads(raw[20:20+length]), 28+length
    assert struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
    attrs, names, weights, joints, offsets, code = contract(doc, raw[binary_offset:])
    head, chest = names.index('head'), names.index('chest')
    restored = bytearray(raw)
    for vertex, slot, offset in offsets:
        assert joints[vertex][slot] == chest, 'Selected active joint was not reassigned to chest'
        struct.pack_into('<'+code, restored, binary_offset+offset, head)
    assert digest(restored) == SOURCE_SHA, 'Bytes outside the allowed joint entries changed'
    assert digest(raw) == CANDIDATE_SHA, 'The approved 243-row candidate changed'
    # This exact reverse hash proves JSON and all other bytes, including all weights,
    # original/active geometry arrays, textures and animation channels, are unchanged.
    old_binary = restored[binary_offset:]
    old_joints, _ = reader.rows(doc, old_binary, attrs['JOINTS_0'])
    protected_views = {image['bufferView'] for image in doc['images'] if 'bufferView' in image}
    for index, accessor in enumerate(doc['accessors']):
        if index == attrs['JOINTS_0']: continue
        if 'bufferView' in accessor: protected_views.add(accessor['bufferView'])
        if 'sparse' in accessor:
            protected_views.update(accessor['sparse'][key]['bufferView'] for key in ('indices', 'values'))
    for index in protected_views:
        view = doc['bufferViews'][index]
        start, length = view.get('byteOffset', 0), view['byteLength']
        assert old_binary[start:start+length] == raw[binary_offset+start:binary_offset+start+length], 'Another accessor or texture aliases changed bytes'
    arm = {i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'hand'))}
    before = [sum(w for j, w in zip(js, ws) if j in arm) for js, ws in zip(old_joints, weights)]
    after = [sum(w for j, w in zip(js, ws) if j in arm) for js, ws in zip(joints, weights)]
    assert before == after, 'Native contact census memberships changed'
    indices = [r[0] for r in reader.rows(doc, raw[binary_offset:], doc['meshes'][2]['primitives'][0]['indices'])[0]]
    faces = [indices[i:i+3] for i in range(0, len(indices), 3)]
    census = {'bodyPrimitiveArmFaces': sum(all(after[i] > .5 for i in face) for face in faces),
              'bodyPrimitiveOpposingFaces': sum(all(after[i] < .2 for i in face) for face in faces),
              'everyVertexArmWeightExact': True, 'allOtherPrimitivesExact': True}
    return doc, raw[binary_offset:], attrs, names, offsets, census

def check(candidate, native_path=None, report_path=None):
    raw = candidate.read_bytes()
    doc, binary, attrs, names, offsets, census = verify_bytes(raw)
    receipt = {'sourceSha256': SOURCE_SHA, 'candidateSha256': digest(raw), 'bytes': len(raw),
               'changedJointEntries': len(offsets), 'fullOriginalRecoveredSha256': SOURCE_SHA,
               'jsonWeightsGeometryActionsTexturesAndOtherBytesExact': True, 'census': census}
    if native_path is not None:
        native_raw = native_path.read_bytes()
        native = json.loads(native_raw)
        assert native['sourceSha256'] == SOURCE_SHA
        selected = [row[0] for row in offsets]
        assert native['vertexIndices'] == selected
        assert [p['name'] for p in native['poses']] == ['neutral', 'target-left30-default', 'target-right30-default', 'run-rear-phase102']
        positions, _ = reader.rows(doc, binary, attrs['POSITION'])
        errors = []
        for pose in native['poses']:
            matrix = pose['skinMatrices']['chest']  # glTF column-major, mesh rest -> world
            assert len(matrix) == 16 and all(math.isfinite(v) for v in matrix)
            assert len(pose['nativePositions']) == len(selected)
            assert all(len(p) == 3 and all(math.isfinite(v) for v in p) for p in pose['nativePositions'])
            expected = [[sum(matrix[k*4+j]*p[k] for k in range(4)) for j in range(3)]
                        for vertex in selected for p in [(*positions[vertex], 1)]]
            error = max(math.dist(a, b) for a, b in zip(expected, pose['nativePositions']))
            assert error < 5e-6, ('Native GLB correspondence', pose['name'], error)
            errors.append({'pose': pose['name'], 'vertices': len(selected), 'maximumErrorM': error})
        receipt.update(nativeReceiptSha256=digest(native_raw), nativeCorrespondence=errors,
                       status='PASS exact joint-only preservation and four-pose native correspondence')
    else:
        receipt['status'] = 'Prepared and byte-verified; native correspondence pending'
    if report_path:
        report_path.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    return receipt

def export(source, target):
    assert source.resolve() != target.resolve() and target.parent.resolve() == HERE.resolve()
    raw, doc, binary = reader.load(source, SOURCE_SHA)
    attrs, names, weights, joints, offsets, code = contract(doc, binary)
    binary_offset = 28+struct.unpack_from('<I', raw, 12)[0]
    patched = bytearray(raw)
    for vertex, slot, offset in offsets:
        assert joints[vertex][slot] == names.index('head')
        struct.pack_into('<'+code, patched, binary_offset+offset, names.index('chest'))
    verify_bytes(patched)
    with target.open('xb') as handle: handle.write(patched)
    return check(target)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['export', 'check'])
    parser.add_argument('paths', nargs='+', type=Path)
    args = parser.parse_args()
    if args.mode == 'export':
        assert len(args.paths) == 2
        result = export(*args.paths)
    else:
        assert len(args.paths) == 1
        result = check(args.paths[0], HERE/'native-joint-poses.json', HERE/'joint-verification.json')
    print(json.dumps(result))
