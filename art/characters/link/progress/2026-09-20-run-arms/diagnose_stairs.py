"""Report the recorded worst stair poses without rendering another unchanged baseline."""
import json, math
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'game-stairs/manifest.json').read_text())
assert manifest['complete'] and not manifest['errors']
report = {}
for scenario in ['stairs-up', 'stairs-down']:
    rows = [r for r in manifest['samples'] if r['scenario'] == scenario]
    row, side = max(((r, s) for r in rows for s in ['L', 'R']),
                    key=lambda pair: pair[0]['legAngles'][pair[1]]['kneeFlexDeg'])
    points = row['bodyPoints']
    hip, knee, ankle = [points[j + side] for j in ['thigh', 'knee', 'ankle']]
    report[scenario] = {
        'frame': row['frame'], 'side': side, **row['legAngles'][side],
        'hip_to_ankle_vertical_m': hip[1] - ankle[1],
        'hip_to_ankle_horizontal_m': math.hypot(hip[0] - ankle[0], hip[2] - ankle[2]),
        'leg_length_m': math.dist(hip, knee) + math.dist(knee, ankle),
        'feet': row['feet'], 'root_step_m': row['rootStepY'],
    }
print(json.dumps(report, indent=2))
