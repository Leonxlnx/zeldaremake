"""Check character behavior after the world merge; this is not an isolated asset A/B."""
import hashlib, json
from pathlib import Path

root = Path(__file__).resolve().parent
current = json.loads((root/'game/manifest.json').read_text())
stairs = json.loads((root.parent/'2026-09-20-stair-posture/game-after/manifest.json').read_text())
flat = json.loads((root.parent/'2026-09-20-run-arms/game-fixed/manifest.json').read_text())
assert current['complete'] and current['errors'] == []
assert current['glb_sha256'] == stairs['glb_sha256']
assert len(current['samples']) == 1620
report = {'world_commit': current['world_commit'], 'bundles': current['bundles'],
          'scope':'Same character runtime on a changed world; flat baseline has identical run/boot data but an earlier stair clip.', 'scenarios':{}}
for scenario, previous in [('flat-transitions', flat), ('stairs-up', stairs), ('stairs-down', stairs)]:
    assert previous['complete'] and previous['errors'] == []
    assert previous['character_source_sha256'] == current['character_source_sha256']
    assert previous['render_profile'] == current['render_profile'] == 'high defaults'
    a = [r for r in previous['samples'] if r['scenario'] == scenario]
    b = [r for r in current['samples'] if r['scenario'] == scenario]
    assert len(a) == len(b)
    assert all(x['frame'] == y['frame'] and all(x['root'][k] == y['root'][k] for k in [0,2]) for x,y in zip(a,b))
    before, after = previous['summary'][scenario], current['summary'][scenario]
    assert after['reachClampedFrames'] == after['shoeSamplesBelowMinus2cm'] == 0
    assert after['maxRootStepM'] <= before['maxRootStepM'] + .001
    assert after['maxKneeFlexDeg'] <= before['maxKneeFlexDeg'] + 1
    if scenario != 'flat-transitions':
        assert after['minRenderedStairGapM'] >= before['minRenderedStairGapM'] - .001
    report['scenarios'][scenario] = {'before':before, 'after':after}
report['image_sha256'] = {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'game').glob('*.png'))}
assert len(report['image_sha256']) == 9
(root/'comparison.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
