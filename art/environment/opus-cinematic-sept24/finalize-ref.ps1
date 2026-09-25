# Finish the 40 s reference-angle cut: merge the three render jobs' frames and step logs, render the
# footstep stem from Link's real contacts, master the mix, then encode / poster / verify (assemble.mjs).
# Run from the repo root after ref-j1..3 finished:  pwsh art/environment/opus-cinematic-sept24/finalize-ref.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$out = Join-Path $root 'gauntlet\out\opus-cinematic-sept24'
$final = Join-Path $out 'ref-final'
$here = $PSScriptRoot
New-Item -ItemType Directory -Force (Join-Path $final 'frames') | Out-Null
foreach ($j in 'ref-j1', 'ref-j2', 'ref-j3') {
  Copy-Item (Join-Path $out "$j\frames\f*.png") (Join-Path $final 'frames') -Force
  Copy-Item (Join-Path $out "$j\steps-*.json") $final -Force
  Copy-Item (Join-Path $out "$j\receipt.json") (Join-Path $final "receipt-$j.json") -Force
}
$n = (Get-ChildItem (Join-Path $final 'frames') -Filter f*.png).Count
if ($n -ne 1200) { throw "expected 1200 frames, found $n" }
Push-Location (Join-Path $here 'audio')
node merge-steps.mjs $final (Join-Path $here 'audio\steps-ref.json')
node render-audio.mjs --cues cues-ref.json --steps steps-ref.json --stems steps
node finish-audio.mjs --cues cues-ref.json
Pop-Location
$cuts = '[{"start":0,"frames":210},{"start":210,"frames":90},{"start":300,"frames":210},{"start":510,"frames":120},{"start":630,"frames":240},{"start":870,"frames":210},{"start":1080,"frames":120}]'
Set-Content -Encoding utf8 (Join-Path $here 'reference-cuts.json') $cuts
node (Join-Path $here 'assemble.mjs') --frames (Join-Path $final 'frames') --audio (Join-Path $here 'audio\mix-30s-48k.wav') --out (Join-Path $here 'final') --cuts (Join-Path $here 'reference-cuts.json')
