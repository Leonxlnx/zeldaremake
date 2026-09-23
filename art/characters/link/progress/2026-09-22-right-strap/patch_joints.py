"""Exact right-strap patch, reusing the published left preservation/native checker."""
import argparse, importlib.util, inspect, json, struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE_SHA = '1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5'
CANDIDATE_SHA = '6ea975df1d3b70be38fc5154ad11f905ff5846b9e154e9178d369447653fa60c'
POSTURE_SHA = '143160f1c413694865a9b3273dbbf16bc22a89a1fdc62d2b35381c980ae47e69'
COMBINED_SHA = '7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda'
helper = HERE.parent/'2026-09-22-head-owned-patch/patch_joints.py'
spec = importlib.util.spec_from_file_location('left_strap_preservation', helper)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
base.HERE, base.SOURCE_SHA, base.CANDIDATE_SHA = HERE, SOURCE_SHA, CANDIDATE_SHA

# Adapt only the frozen selector's cardinality; all preservation/native checks
# stay in the published helper. Reversing these 100 bytes must recover 1873,
# including its already corrected 243 left-strap entries, exactly.
contract_source = inspect.getsource(base.contract)
old = 'assert len(selected) == len(set(selected)) == 243'
assert contract_source.count(old) == 1, 'Review the changed shared contract before adapting it'
exec(compile(contract_source.replace(old, old.replace('243', '100')), str(helper), 'exec'), base.__dict__)
check, export, verify_bytes = base.check, base.export, base.verify_bytes

def compose(source, target):
    """Add only the same right joints to the independently accepted chest clip."""
    assert source.resolve() != target.resolve() and target.parent.resolve() == HERE.resolve()
    raw, doc, binary = base.reader.load(source, POSTURE_SHA)
    _, names, _, joints, offsets, code = base.contract(doc, binary)
    binary_offset = 28+struct.unpack_from('<I', raw, 12)[0]
    patched = bytearray(raw)
    for vertex, slot, offset in offsets:
        assert joints[vertex][slot] == names.index('head')
        struct.pack_into('<'+code, patched, binary_offset+offset, names.index('chest'))
    restored = bytearray(patched)
    for _, _, offset in offsets:
        struct.pack_into('<'+code, restored, binary_offset+offset, names.index('head'))
    assert bytes(restored) == raw and base.digest(restored) == POSTURE_SHA
    assert base.digest(patched) == COMBINED_SHA
    with target.open('xb') as handle: handle.write(patched)
    return {'sourceSha256': POSTURE_SHA, 'candidateSha256': COMBINED_SHA, 'bytes': len(patched),
            'changedJointEntries': len(offsets), 'reversedSha256': base.digest(restored),
            'postureClipAndEveryOtherByteExact': True}

def check_combined(candidate):
    """Read-only proof for the combined default; no historical report is rewritten."""
    raw, doc, binary = base.reader.load(candidate, COMBINED_SHA)
    _, names, _, joints, offsets, code = base.contract(doc, binary)
    binary_offset = 28+struct.unpack_from('<I', raw, 12)[0]
    restored = bytearray(raw)
    for vertex, slot, offset in offsets:
        assert joints[vertex][slot] == names.index('chest'), 'Right strap joint is not chest-owned'
        struct.pack_into('<'+code, restored, binary_offset+offset, names.index('head'))
    assert base.digest(restored) == POSTURE_SHA, 'Bytes outside the 100 right entries changed'
    return {'candidateSha256': base.digest(raw), 'bytes': len(raw),
            'changedJointEntries': len(offsets), 'reversedSha256': base.digest(restored),
            'postureClipAndEveryOtherByteExact': True,
            'status': 'PASS combined bytes and exact recovery of the independently checked posture asset'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['export', 'check', 'compose', 'check-combined'])
    parser.add_argument('paths', nargs='+', type=Path)
    args = parser.parse_args()
    if args.mode in ('export', 'compose'):
        assert len(args.paths) == 2
        result = (compose if args.mode == 'compose' else export)(*args.paths)
    elif args.mode == 'check-combined':
        assert len(args.paths) == 1
        result = check_combined(args.paths[0])
    else:
        assert len(args.paths) == 1
        result = check(args.paths[0], HERE/'native-joint-poses.json', HERE/'joint-verification.json')
    print(json.dumps(result))
