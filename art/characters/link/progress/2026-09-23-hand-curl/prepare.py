"""Pinned, CPU-only long-finger curl plan; never exports or changes a GLB."""
import argparse, collections, importlib.util, json
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
SOURCE = '7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda'
SEEDS = {'L': [75512, 75592, 78323, 76365], 'R': [78136, 78015, 77299, 76829]}
ANGLE_DEG = 18
spec = importlib.util.spec_from_file_location('hand_pack_reader', HERE.parent/'2026-09-22-rear-carriage/patch_pack.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
QUAD_X, QUAD_W = np.polynomial.legendre.leggauss(8)


def components(selected, edges):
    remaining, result = set(selected), []
    while remaining:
        stack = [remaining.pop()]
        group = set(stack)
        while stack:
            for point in edges[stack.pop()] & remaining:
                remaining.remove(point)
                group.add(point)
                stack.append(point)
        result.append(group)
    return result


def curve(q, origin, basis, length, theta):
    """Arc-length centerline with angle theta*(s/length)^2, and exact Jacobian."""
    s, v, w = basis.T @ (q-origin)
    if s <= 0:
        return q.copy(), np.eye(3)
    u = (QUAD_X+1)*s/2
    angles = theta*(u/length)**2
    cx, cy = s/2*np.array([QUAD_W @ np.cos(angles), QUAD_W @ np.sin(angles)])
    angle, rate = theta*(s/length)**2, 2*theta*s/length**2
    cosine, sine = np.cos(angle), np.sin(angle)
    d, palm, across = basis.T
    tangent, normal = d*cosine+palm*sine, -d*sine+palm*cosine
    return (origin+d*(cx-v*sine)+palm*(cy+v*cosine)+across*w,
            np.column_stack(((1-v*rate)*tangent, normal, across)) @ basis.T)


def prepare():
    asset = HERE.parents[4]/'public/models/link/link-runtime.glb'
    raw, doc, binary = patch.reader.load(asset, SOURCE)
    positions, joints, weights, triangles = patch.native_body(doc, binary)
    names = [doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']]
    bind_inverse = patch.reader.rows(doc, binary, doc['skins'][0]['inverseBindMatrices'])[0]
    aliases, edges = collections.defaultdict(list), collections.defaultdict(set)
    for i, point in enumerate(positions):
        aliases[point].append(i)
    for triangle in triangles:
        for a, b in zip(triangle, (triangle[1], triangle[2], triangle[0])):
            edges[positions[a]].add(positions[b])
            edges[positions[b]].add(positions[a])
    native_rotation = np.array(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
    before = np.asarray(positions) @ native_rotation.T
    after = before.copy()
    rows, bands, selected_all, boundary_all = [], [], set(), set()
    min_det, max_fd, max_alias_error = float('inf'), 0., 0.
    rounded_unchanged, max_skipped_jacobian = 0, 0.
    theta = np.deg2rad(ANGLE_DEG)
    expected = {'L': [(314, 176), (294, 158), (296, 148), (191, 103)],
                'R': [(343, 179), (339, 172), (255, 134), (189, 97)]}
    for side, sign in [('L', 1), ('R', -1)]:
        joint = names.index('hand'+side)
        rigid = lambda i: [(j, w) for j, w in zip(joints[i], weights[i]) if w] == [(joint, 1.)]
        owned = {p for p, ids in aliases.items() if rigid(ids[0])}
        inverse = np.asarray(bind_inverse[joint]).reshape(4, 4).T
        local = {p: (inverse @ (*p, 1))[:3] for p in owned}
        plane = lambda p: local[p][1]-2*sign*local[p][0]-.4*local[p][2]
        groups = components({p for p in owned if plane(p) > -.032}, edges)
        groups.sort(key=lambda group: np.mean([local[p][2] for p in group]))
        assert len(groups) == 5 and all(positions[seed] in group for seed, group in zip(SEEDS[side], groups[1:]))
        for cut in [-.0325, -.0315]:
            stable = components({p for p in owned if plane(p) > cut}, edges)
            stable.sort(key=lambda group: np.mean([local[p][2] for p in group]))
            assert len(stable) == 5 and all(positions[seed] in group for seed, group in zip(SEEDS[side], stable[1:]))
        to_local = inverse[:3, :3] @ native_rotation.T
        to_native = np.linalg.inv(to_local)
        for band, (group, seed, label, counts) in enumerate(zip(groups[1:], SEEDS[side], ['index', 'middle', 'ring', 'pinky'], expected[side]), 2):
            indices = {i for p in group for i in aliases[p]}
            assert (len(indices), len(group)) == counts and all(rigid(i) for i in indices)
            assert {i for j in indices for i in aliases[positions[j]]} == indices
            assert not selected_all & indices
            selected_all.update(indices)
            boundary = set()
            for triangle in triangles:
                inside = indices.intersection(triangle)
                if inside and len(inside) < 3:
                    boundary.update(positions[i] for i in inside)
            frozen = {i for p in boundary for i in aliases[p]}
            boundary_all.update(frozen)
            base = np.mean([local[p] for p in sorted(boundary)], axis=0)
            cut_normal = np.array((-2*sign, 1, -.4)) / np.linalg.norm((-2*sign, 1, -.4))
            projection = {p: (local[p]-base) @ cut_normal for p in group}
            cap = np.mean([local[p] for p in sorted(group) if projection[p] >= max(projection.values())-.003], axis=0)
            direction = (cap-base)/np.linalg.norm(cap-base)
            palm = np.array((-sign, 0., 0.))
            palm -= direction*(palm @ direction)
            palm /= np.linalg.norm(palm)
            basis = np.column_stack((direction, palm, np.cross(direction, palm)))
            origin = base+direction*max((local[p]-base) @ direction for p in boundary)
            length = max((local[p]-origin) @ direction for p in group)
            assert length > .01 and np.max(np.abs(basis.T @ basis-np.eye(3))) < 1e-12
            moved = set()
            for point in sorted(group):
                q = local[point]
                transformed, jacobian = (q, np.eye(3)) if point in boundary else curve(q, origin, basis, length, theta)
                assert np.isfinite(transformed).all() and np.isfinite(jacobian).all()
                min_det = min(min_det, float(np.linalg.det(jacobian)))
                if point not in boundary:
                    step = np.eye(3)*1e-7
                    numeric = np.column_stack([(curve(q+h, origin, basis, length, theta)[0]-curve(q-h, origin, basis, length, theta)[0])/2e-7 for h in step])
                    max_fd = max(max_fd, float(np.max(np.abs(numeric-jacobian))))
                delta = to_native @ (transformed-q)
                native_jacobian = to_native @ jacobian @ to_local
                if np.array_equal(transformed, q):
                    native_jacobian = np.eye(3)
                native_after = before[aliases[point][0]] if np.array_equal(transformed, q) else (before[aliases[point][0]]+delta).astype(np.float32).astype(float)
                if not np.array_equal(transformed, q) and np.array_equal(native_after, before[aliases[point][0]]):
                    rounded_unchanged += len(aliases[point])
                    max_skipped_jacobian = max(max_skipped_jacobian, float(np.max(np.abs(native_jacobian-np.eye(3)))))
                for index in aliases[point]:
                    after[index] = native_after
                    if not np.array_equal(before[index], native_after):
                        moved.add(index)
                        rows.append({'index': index, 'before': before[index].tolist(), 'after': native_after.tolist(), 'jacobian': native_jacobian.tolist()})
                max_alias_error = max(max_alias_error, float(np.max(np.abs(after[aliases[point]]-native_after))))
            assert np.array_equal(before[sorted(frozen)], after[sorted(frozen)])
            bands.append({'side': side, 'band': band, 'label': label, 'seed': seed, 'selectedRows': len(indices), 'uniquePoints': len(group),
                          'boundaryRows': len(frozen), 'boundaryPoints': len(boundary), 'changedRows': len(moved),
                          'D': direction.tolist(), 'V': palm.tolist(), 'W': basis[:, 2].tolist(), 'P': origin.tolist(),
                          'usableLengthM': float(length), 'baseCapChordM': float(np.linalg.norm(cap-base)),
                          'maxDisplacementM': float(np.linalg.norm(after[sorted(indices)]-before[sorted(indices)], axis=1).max())})
    assert min_det > 0 and max_fd < 1e-6 and max_alias_error == 0
    assert len(selected_all) == 2221 and len(boundary_all) == 318
    assert len(rows) == len({r['index'] for r in rows}) and not boundary_all.intersection(r['index'] for r in rows)
    protected = sorted(set(range(len(positions)))-selected_all)
    assert np.array_equal(before[protected], after[protected])
    draw = np.asarray(triangles)
    affected = draw[np.any(np.any(before[draw] != after[draw], axis=2), axis=1)]
    old = np.cross(before[affected[:, 1]]-before[affected[:, 0]], before[affected[:, 2]]-before[affected[:, 0]])
    new = np.cross(after[affected[:, 1]]-after[affected[:, 0]], after[affected[:, 2]]-after[affected[:, 0]])
    valid = np.sum(old*old, axis=1) > 1e-24
    cosine = np.sum(old[valid]*new[valid], axis=1)/(np.linalg.norm(old[valid], axis=1)*np.linalg.norm(new[valid], axis=1))
    assert np.isfinite(after).all() and np.isfinite(cosine).all() and cosine.min() > 0, 'A triangle collapsed or flipped'
    assert asset.read_bytes() == raw
    checks = {'sourceVertices': len(positions), 'sourceFaces': len(triangles), 'selectedRows': len(selected_all), 'selectedUniquePoints': sum(b['uniquePoints'] for b in bands),
              'boundaryRows': len(boundary_all), 'changedRows': int(np.any(before != after, axis=1).sum()), 'protectedRows': len(protected),
              'minimumJacobianDeterminant': min_det, 'maximumFiniteDifferenceJacobianError': max_fd, 'maximumAliasErrorM': max_alias_error,
              'positionRoundedUnchangedRows': rounded_unchanged, 'maximumSkippedJacobianDeviationFromIdentity': max_skipped_jacobian,
              'affectedFaces': len(affected), 'minimumFaceNormalCosine': float(cosine.min()), 'maxDisplacementM': float(np.linalg.norm(after-before, axis=1).max()),
              'boundaryAndOutsideRowsExact': True, 'aliasesCompleteAndExactRigid': True, 'componentCountAndSeedIdentityStableAtHalfMillimeterOffsets': True, 'sourceUnchanged': True}
    return {'sourceSha256': SOURCE, 'seeds': SEEDS, 'angleDeg': ANGLE_DEG, 'bands': bands, 'rows': sorted(rows, key=lambda r: r['index']),
            'boundaryIndices': sorted(boundary_all), 'selectedIndices': sorted(selected_all), 'checks': checks}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Exclusively create hand-curl-plan.json after checks pass')
    args = parser.parse_args()
    plan = prepare()
    if args.write:
        with (HERE/'hand-curl-plan.json').open('x', encoding='utf-8') as stream:
            json.dump(plan, stream, separators=(',', ':'), allow_nan=False)
            stream.write('\n')
    print(json.dumps({'sourceSha256': plan['sourceSha256'], 'angleDeg': plan['angleDeg'], 'bands': plan['bands'], 'checks': plan['checks']}, allow_nan=False))
