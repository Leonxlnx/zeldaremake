"""Export one local contour candidate using the unchanged, previously reviewed boot writer."""
import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


profile = module('contour_field_export', HERE/'field.py')
adapter = module('contour_boot_adapter', HERE.parent/'2026-09-21-boot-tip/preview.py')
reader = module('contour_preservation_reader', HERE.parent/'2026-09-21-boot-tip/check.py')
adapter.field = adapter.prior.field = profile.field
adapter.SOURCE_SHA = profile.SOURCE_SHA


def export(source, target):
    source, target = source.resolve(), target.resolve()
    assert source != target, 'Never overwrite the source'
    assert target.parent == HERE and target.suffix == '.glb', 'Candidate must stay in this evidence directory'
    assert not target.exists() and not target.with_suffix('.json').exists(), 'Preserve existing candidates'
    raw, doc, binary = reader.load(source, profile.SOURCE_SHA)
    assert profile.self_check()['pass']
    native_path = HERE/'native-rows.json'
    native_raw = native_path.read_bytes()
    protected = [HERE/'field.py', HERE/'proposal.json', native_path,
                 HERE.parent/'2026-09-21-boot-tip/preview.py', HERE.parent/'2026-09-20-run-arms/boots.py']
    receipts = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
    contract = {
        'source_sha256': profile.SOURCE_SHA, 'source_bytes': len(raw),
        'canonical_json_sha256': hashlib.sha256(json.dumps(doc, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest(),
        'original_binary_bytes': len(binary), 'original_binary_sha256': hashlib.sha256(binary).hexdigest(),
        'accessor_count': len(doc['accessors']), 'buffer_view_count': len(doc['bufferViews']),
        'buffers': doc['buffers'],
        'body_attributes': {k: doc['meshes'][2]['primitives'][0]['attributes'][k] for k in ('POSITION', 'NORMAL', 'TANGENT')},
    }
    contract_path = HERE/'source-preservation.json'
    if contract_path.exists():
        assert json.loads(contract_path.read_text()) == contract, 'Existing source contract differs'
    with tempfile.TemporaryDirectory(prefix='.contour-export-', dir=HERE) as folder:
        stage = Path(folder).resolve()
        assert stage.parent == HERE, 'Temporary cleanup must stay in this evidence directory'
        (stage/'boots-native.json').write_bytes(native_raw)
        staged = stage/target.name
        adapter.export(source, staged)
        report = json.loads(staged.with_suffix('.json').read_text())
        for key in ('width_scale', 'distal_length_scale', 'forward_pivot_m', 'forward_fade_m', 'height_fade_m'):
            report.pop(key)
        report.update({
            'field': 'C1 calf/cuff X contour; glTF Y and Z preserved',
            'support_height_m': [.125, .325], 'identity_through_height_m': .15,
            'field_sha256': receipts[str(HERE/'field.py')],
            'profile_sha256': receipts[str(HERE/'proposal.json')],
            'native_rows_sha256': hashlib.sha256(native_raw).hexdigest(),
            'source_bytes': len(raw), 'candidate_bytes': staged.stat().st_size,
            'appended_bytes': staged.stat().st_size-len(raw),
            'status': 'Local export; independent preservation and native visual review still required',
        })
        with target.open('xb') as handle:
            handle.write(staged.read_bytes())
    with target.with_suffix('.json').open('x', encoding='utf-8') as handle:
        handle.write(json.dumps(report, indent=2)+'\n')
    if not contract_path.exists():
        with contract_path.open('x', encoding='utf-8') as handle:
            handle.write(json.dumps(contract, indent=2)+'\n')
    assert source.read_bytes() == raw
    assert all(hashlib.sha256(p.read_bytes()).hexdigest() == receipts[str(p)] for p in protected)
    print(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    import sys
    assert len(sys.argv) == 3, 'export.py SOURCE.glb CANDIDATE.glb'
    export(Path(sys.argv[1]), Path(sys.argv[2]))
