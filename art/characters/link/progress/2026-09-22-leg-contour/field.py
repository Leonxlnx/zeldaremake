"""Read-only contour proposal math; Blender axes, compatible with prior boots.field/normal.

Importing this module never accesses Blender, changes a mesh, or exports an asset.
"""
import json
import math
from pathlib import Path

PROPOSAL = json.loads(Path(__file__).with_name('proposal.json').read_text(encoding='utf-8'))
SOURCE_SHA = PROPOSAL['assetSha256']


def _slopes(rows, key):
    h = [b['heightM']-a['heightM'] for a, b in zip(rows, rows[1:])]
    d = [(rows[i+1][key]-rows[i][key])/v for i, v in enumerate(h)]
    m = [0.0]*len(rows)
    for i in range(1, len(rows)-1):
        if d[i-1]*d[i] > 0:
            w1, w2 = 2*h[i]+h[i-1], h[i]+2*h[i-1]
            m[i] = (w1+w2)/(w1/d[i-1]+w2/d[i])
    return m  # zero endpoint slopes make both profiles meet identity with C1 continuity


_PROFILES = {
    (area, side): (PROPOSAL[area][side], {
        key: _slopes(PROPOSAL[area][side], key) for key in ('a', 'bM')
    }) for area in ('cuff', 'calf') for side in ('L', 'R')
}


def _sample(profile, key, height):
    rows, slopes = profile
    i = next(i for i in range(len(rows)-1)
             if rows[i]['heightM'] <= height <= rows[i+1]['heightM'])
    h = rows[i+1]['heightM']-rows[i]['heightM']
    t = (height-rows[i]['heightM'])/h
    f0, f1, m0, m1 = rows[i][key], rows[i+1][key], slopes[key][i], slopes[key][i+1]
    value = ((2*t**3-3*t*t+1)*f0 + (t**3-2*t*t+t)*h*m0
             + (-2*t**3+3*t*t)*f1 + (t**3-t*t)*h*m1)
    derivative = ((6*t*t-6*t)*f0 + (3*t*t-4*t+1)*h*m0
                  + (-6*t*t+6*t)*f1 + (3*t*t-2*t)*h*m1)/h
    return value, derivative


def field(p):
    """Return (new_position, (sx, sy, dx/dheight, dy/dheight)) in Blender axes."""
    x, y, z = p
    if z <= .125 or z >= .325 or abs(x) >= .22:
        return tuple(p), (1, 1, 0, 0)
    sign = 1 if x >= 0 else -1
    profile = _PROFILES[('cuff' if z <= .25 else 'calf', 'L' if sign == 1 else 'R')]
    a, da = _sample(profile, 'a', z)
    b, db = _sample(profile, 'bM', z)
    return (a*x+sign*b, y, z), (a, 1, da*x+sign*db, 0)


def self_check():
    """Check only the proposed mathematical field; no model or native execution."""
    for (area, side), (rows, slopes) in _PROFILES.items():
        sign = 1 if side == 'L' else -1
        x = sign*.1
        for key in ('a', 'bM'):
            assert slopes[key][0] == slopes[key][-1] == 0
        for row in rows:
            q, j = field((x, -.07, row['heightM']))
            assert abs(q[0]-(row['a']*x+sign*row['bM'])) < 1e-14
            assert abs(j[0]-row['a']) < 1e-14
            assert q[1:] == (-.07, row['heightM']) and j[1] == 1 and j[3] == 0
    minimum_a = 1.0
    max_derivative_error = 0.0
    for sign in (-1, 1):
        x = sign*.1
        for z in (-.2, 0, .11, .125, .15, .25, .325, .34, 1):
            p = (x, -.07, z)
            assert field(p) == (p, (1, 1, 0, 0))
        for x_outside in (sign*.22, sign*.3):
            p = (x_outside, -.07, .2)
            assert field(p) == (p, (1, 1, 0, 0))
        for i in range(2000):
            z = .125+(i+.37)*.2/2000
            p = (x, -.07, z)
            q, j = field(p)
            assert all(math.isfinite(v) for v in q+j)
            assert j[0] > 0 and q[0]*x > 0
            minimum_a = min(minimum_a, j[0])
            e = 1e-7
            dx = (field((x+e, -.07, z))[0][0]-field((x-e, -.07, z))[0][0])/(2*e)
            dz = (field((x, -.07, z+e))[0][0]-field((x, -.07, z-e))[0][0])/(2*e)
            max_derivative_error = max(max_derivative_error, abs(dx-j[0]), abs(dz-j[2]))
    assert max_derivative_error < 1e-7
    return {'pass': True, 'declared_source_sha256': SOURCE_SHA,
            'identity_boundaries_join_and_controls_pass': True,
            'profile_endpoint_slopes_zero': True,
            'minimum_sampled_jacobian_determinant': minimum_a,
            'maximum_analytic_vs_fd_error': max_derivative_error,
            'native_or_export_executed': False}


if __name__ == '__main__':
    print(json.dumps(self_check(), indent=2))
