# Rubric change proposals

`gauntlet/rubric.json` is hash-locked. Agents may not edit it. If a threshold is wrong (too easy,
impossible, or measuring the wrong thing), write a proposal here and the owner (`Leonxlnx`) decides.
Approved changes are committed by the owner with the trailer `Rubric-Change-Approved-By: Leonxlnx`
and `node gauntlet/scripts/rubric-lock.mjs --write`.

Format:

```
## <date> — <agent> — <item id>
Current: …
Proposed: …
Why: … (evidence: take id / image path)
Owner decision: pending | accepted <commit> | rejected (reason)
```

_(no proposals yet)_
