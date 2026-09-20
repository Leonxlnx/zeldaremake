"""Append the reviewed leg field and optional native run rotations to the exact 382ec9ec GLB.

python export_candidate.py SOURCE.glb TARGET.glb [--carrier run-arms-native.glb]
TARGET's directory supplies legs-native.json and, with a carrier, run-arms-study.json.
python export_candidate.py --self-check
"""
import argparse
import copy
import hashlib
import json
import math
import struct
from pathlib import Path

SOURCE_SHA = '382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb'


def field(p):
    x, y, z = p  # glTF: +Y up, +Z forward. Native JSON already converts (x, z, -y).
    if y >= .40 or abs(x) >= .22:
        return p, 0.0
    def fade(lo, hi):
        t = max(0, min(1, (y-lo)/(hi-lo)))
        return 1-t*t*(3-2*t), -6*t*(1-t)/(hi-lo) if lo < y < hi else 0
    a, da = fade(.18, .40)
    b, db = fade(.08, .18)
    sign = 1 if x >= 0 else -1
    new = x-sign*(.035*a+.010*b)
    assert new*x > 0, 'Leg alignment crossed the midline'
    return (new, y, z), -sign*(.035*da+.010*db)  # dx'/dy


def unit(v):
    length = math.sqrt(sum(x*x for x in v))
    assert math.isfinite(length) and length > 1e-12
    return tuple(x/length for x in v)


def frame(n, t, shear):
    normal = unit((n[0], n[1]-shear*n[0], n[2]))  # inverse-transpose Jacobian
    tangent = (t[0]+shear*t[1], t[1], t[2])  # forward Jacobian
    dot = sum(a*b for a, b in zip(tangent, normal))
    tangent = unit(tuple(a-dot*b for a, b in zip(tangent, normal)))
    return normal, (*tangent, t[3])  # determinant=1, so handedness is unchanged


def load(path):
    raw = path.read_bytes()
    assert len(raw) >= 28 and struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
    size, kind = struct.unpack_from('<I4s', raw, 12)
    assert kind == b'JSON' and size % 4 == 0
    doc = json.loads(raw[20:20+size])
    count, kind = struct.unpack_from('<I4s', raw, 20+size)
    assert kind == b'BIN\0' and 28+size+count == len(raw)
    assert len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0]
    assert 0 <= count-doc['buffers'][0]['byteLength'] <= 3
    return raw, doc, raw[28+size:28+size+doc['buffers'][0]['byteLength']]


def values(doc, binary, index):
    a = doc['accessors'][index]
    assert a['componentType'] == 5126 and not a.get('normalized', False)
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    def read(view_index, count, fmt, offset=0):
        view = doc['bufferViews'][view_index]
        assert view.get('buffer', 0) == 0
        size = struct.calcsize(fmt)
        start, stride = view.get('byteOffset', 0)+offset, view.get('byteStride', size)
        assert count == 0 or offset+(count-1)*stride+size <= view['byteLength']
        return [struct.unpack_from(fmt, binary, start+i*stride) for i in range(count)]
    fmt = '<'+'f'*width
    rows = read(a['bufferView'], a['count'], fmt, a.get('byteOffset', 0)) if 'bufferView' in a else [(0.,)*width]*a['count']
    if 'sparse' in a:
        sparse = a['sparse']; indices = sparse['indices']; data = sparse['values']
        ids = read(indices['bufferView'], sparse['count'], '<'+{5121:'B', 5123:'H', 5125:'I'}[indices['componentType']], indices.get('byteOffset', 0))
        replacements = read(data['bufferView'], sparse['count'], fmt, data.get('byteOffset', 0))
        assert all(0 <= i[0] < len(rows) for i in ids) and all(x[0] < y[0] for x, y in zip(ids, ids[1:]))
        for (i,), row in zip(ids, replacements): rows[i] = row
    assert all(math.isfinite(x) for row in rows for x in row)
    return rows


def export(source, target, carrier=None):
    assert source.resolve() != target.resolve() and (carrier is None or carrier.resolve() != target.resolve())
    raw, original, prefix = load(source)
    assert hashlib.sha256(raw).hexdigest() == SOURCE_SHA, 'Wrong source asset'
    doc, binary = copy.deepcopy(original), bytearray(prefix)
    native = json.loads((target.parent/'legs-native.json').read_text(encoding='utf-8'))
    assert isinstance(native, list) and native
    for row in native:
        assert set(row) == {'before', 'after'} and all(len(row[k]) == 3 for k in row)
        assert all(math.isfinite(v) for k in row for v in row[k])
    def append(rows, kind, old_index=None, geometry=False):
        assert rows and all(math.isfinite(x) for row in rows for x in row)
        binary.extend(b'\0'*(-len(binary)%4)); start = len(binary)
        for row in rows: binary.extend(struct.pack('<'+'f'*len(row), *row))
        view = {'buffer': 0, 'byteOffset': start, 'byteLength': len(binary)-start}
        if geometry: view['target'] = 34962
        a = copy.deepcopy(doc['accessors'][old_index]) if old_index is not None else {'componentType': 5126, 'count': len(rows), 'type': kind}
        a.update(bufferView=len(doc['bufferViews'])); a.pop('byteOffset', None); a.pop('sparse', None)
        # Bounds describe the encoded float32 positions, not Python's intermediate doubles.
        encoded = [struct.unpack('<'+'f'*len(row), struct.pack('<'+'f'*len(row), *row)) for row in rows]
        if kind == 'SCALAR' or old_index is not None:
            a['min'] = [min(row[k] for row in encoded) for k in range(len(rows[0]))]
            a['max'] = [max(row[k] for row in encoded) for k in range(len(rows[0]))]
        doc['bufferViews'].append(view); index = len(doc['accessors']); doc['accessors'].append(a)
        return index
    changed, encoded_changed, native_import_error, native_delta_error, morph_normal_noise = 0, 0, 0., 0., 0.
    changed_attributes = []
    for mi, mesh in enumerate(doc['meshes']):
        for pi, primitive in enumerate(mesh['primitives']):
            attrs = primitive['attributes']; positions = values(doc, binary, attrs['POSITION'])
            affected = [i for i, p in enumerate(positions) if p[1] < .40 and abs(p[0]) < .22]
            if not affected: continue
            normals = values(doc, binary, attrs['NORMAL']); tangents = values(doc, binary, attrs['TANGENT'])
            for morph in primitive.get('targets', []):
                for prop, accessor in morph.items():
                    rows = values(doc, binary, accessor)
                    noise = max(abs(v) for i in affected for v in rows[i])
                    if prop == 'POSITION': assert noise == 0, 'An affected vertex has a nonzero position morph'
                    else: morph_normal_noise = max(morph_normal_noise, noise); assert noise < 5e-7
            for i in affected:
                p = positions[i]; q, shear = field(p)
                assert changed < len(native), 'Native evidence has fewer affected vertices'
                row = native[changed]
                native_import_error = max(native_import_error, *(abs(a-b) for a, b in zip(p, row['before'])))
                native_delta_error = max(native_delta_error, *(abs((q[k]-p[k])-(row['after'][k]-row['before'][k])) for k in range(3)))
                assert native_import_error < 5e-6 and native_delta_error < 1e-6, 'Native vertex order/field differs'
                assert q[1:] == p[1:]
                positions[i] = q
                if shear: normals[i], tangents[i] = frame(normals[i], tangents[i], shear)
                changed += 1; encoded_changed += struct.pack('<fff', *q) != struct.pack('<fff', *p)
            for name, rows in [('POSITION', positions), ('NORMAL', normals), ('TANGENT', tangents)]:
                old_index = attrs[name]; attrs[name] = append(rows, doc['accessors'][old_index]['type'], old_index, True)
                changed_attributes.append((mi, pi, name, old_index))
    assert changed == len(native) and encoded_changed > 0
    changed_channels = []
    if carrier:
        _, native_doc, native_bin = load(carrier)
        study = json.loads((target.parent/'run-arms-study.json').read_text(encoding='utf-8'))
        edited = set(study['edited_bones'])
        assert edited and edited <= {'shoulderL', 'shoulderR', 'elbowL', 'elbowR'}
        assert set(study['rotation_only_bones']) == edited and study['preserve_hips']
        assert abs(study['cycle_s']-28/60) < 1e-6
        run = next(a for a in doc['animations'] if a['name'] == 'run')
        animation = next(a for a in native_doc['animations'] if a['name'] == 'run')
        native_nodes = {n.get('name'): n for n in native_doc['nodes']}
        for node in original['nodes']:
            if node.get('name') not in edited: continue
            for prop, default in [('translation', [0, 0, 0]), ('rotation', [0, 0, 0, 1]), ('scale', [1, 1, 1])]:
                a, b = node.get(prop, default), native_nodes[node['name']].get(prop, default)
                error = max(abs(x-y) for x, y in zip(a, b))
                if prop == 'rotation': error = min(error, max(abs(x+y) for x, y in zip(a, b)))
                assert error < 1e-5, (node['name'], prop, error)
        lookup = {(native_doc['nodes'][c['target']['node']]['name'], c['target']['path']): animation['samplers'][c['sampler']] for c in animation['channels']}
        for ci, channel in enumerate(run['channels']):
            name = original['nodes'][channel['target']['node']]['name']
            if name not in edited or channel['target']['path'] != 'rotation': continue
            sampler = lookup[(name, 'rotation')]
            times = values(native_doc, native_bin, sampler['input']); rows = values(native_doc, native_bin, sampler['output'])
            assert sampler.get('interpolation', 'LINEAR') == 'LINEAR' and len(times) == len(rows)
            assert len(times) >= 57 and abs(times[0][0]) < 1e-6 and abs(times[-1][0]-28/60) < 1e-6
            assert all(a[0] < b[0] for a, b in zip(times, times[1:]))
            assert all(abs(sum(v*v for v in q)-1) < 2e-5 for q in rows)
            assert min(max(abs(a-b) for a, b in zip(rows[0], rows[-1])), max(abs(a+b) for a, b in zip(rows[0], rows[-1]))) < 1e-5
            changed_channels.append((ci, channel['sampler'], name))
            channel['sampler'] = len(run['samplers'])
            run['samplers'].append({'input': append(times, 'SCALAR'), 'output': append(rows, 'VEC4'), 'interpolation': 'LINEAR'})
        assert {name for _, _, name in changed_channels} == edited
    doc['buffers'][0]['byteLength'] = len(binary)
    # Reverse only the permitted references: every other JSON value must be exactly original.
    restored = copy.deepcopy(doc)
    for mi, pi, name, old_index in changed_attributes: restored['meshes'][mi]['primitives'][pi]['attributes'][name] = old_index
    if changed_channels:
        run = next(a for a in restored['animations'] if a['name'] == 'run')
        old_run = next(a for a in original['animations'] if a['name'] == 'run')
        for ci, old_index, _ in changed_channels: run['channels'][ci]['sampler'] = old_index
        run['samplers'] = run['samplers'][:len(old_run['samplers'])]
    restored['accessors'] = restored['accessors'][:len(original['accessors'])]
    restored['bufferViews'] = restored['bufferViews'][:len(original['bufferViews'])]
    restored['buffers'] = original['buffers']
    assert restored == original and bytes(binary[:len(prefix)]) == prefix
    js = json.dumps(doc, separators=(',', ':')).encode(); js += b' '*(-len(js)%4)
    binary.extend(b'\0'*(-len(binary)%4))
    result = struct.pack('<4sII', b'glTF', 2, 28+len(js)+len(binary))+struct.pack('<I4s', len(js), b'JSON')+js+struct.pack('<I4s', len(binary), b'BIN\0')+binary
    target.write_bytes(result)
    report = {'source_sha256': SOURCE_SHA, 'sha256': hashlib.sha256(result).hexdigest(), 'affected_vertices': changed,
              'encoded_position_changes': encoded_changed, 'native_import_offset_m': native_import_error,
              'native_displacement_error_m': native_delta_error, 'preserved_morph_normal_noise_max': morph_normal_noise,
              'original_binary_prefix_exact': True, 'unedited_json_exact': True, 'height_depth_exact': True,
              'run_rotation_bones': [name for _, _, name in changed_channels], 'status': 'Export checked; visual/game acceptance pending'}
    target.with_suffix('.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


def self_check():
    # The smooth field derivative must match finite differences; transported tangent and normal stay orthogonal.
    for side in [-1, 1]:
        for y in [.02, .08, .12, .18, .27, .399, .40, .50]:
            p = (side*.12, y, .03); q, shear = field(p); eps = 1e-7
            numeric = (field((p[0], y+eps, p[2]))[0][0]-field((p[0], y-eps, p[2]))[0][0])/(2*eps)
            assert abs(numeric-shear) < 1e-5 and q[1:] == p[1:]
            n, t = frame(unit((1, 2, 3)), (*unit((2, -1, 0)), -1), shear)
            assert abs(sum(a*b for a, b in zip(n, t))) < 1e-12 and t[3] == -1
            expected = unit((2-shear, -1, 0))
            assert abs(sum(a*b for a, b in zip(n, expected))) < 1e-12
            assert sum(a*b for a, b in zip(t, expected)) > 1-1e-12
    print('Leg field/shear/normal/tangent checks pass')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', nargs='?', type=Path); parser.add_argument('target', nargs='?', type=Path)
    parser.add_argument('--carrier', type=Path); parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()
    if args.self_check: self_check()
    else:
        assert args.source and args.target, 'Source and target are required'
        export(args.source, args.target, args.carrier)
