# squad2 — whose brown? The trees' wood measured, and last hour's headline corrected

Last hour this lane reported that the upper band of the owner's walking poses is **21.5 %** and **19.3 %**
"bark" against the reference's 1.8–10.2 %, and called it his *"the trees show the brown"* (job 3). That
measurement classified pixels by hue. **It does not say the brown is trees, and most of it is not.**

The trees' wood materials were anonymous, so nothing could be attributed from a frame. They are named now —
`tree-white-bark`, `tree-giant-bark`, `tree-giant-bark-near`, `tree-column-bark`, `tree-giant-near-base`,
`tree-distant-wood` (one line each in `materials.ts`, lane 3's file, declared) — and `probe-look.mjs` marks
each in turn at the owner's two walking poses. The share is the pixels that turn red against the base.

| marked material | north, upper band | north, whole frame | west, upper band | west, whole frame |
| --- | --- | --- | --- | --- |
| `tree-giant-bark` (lane 3) | **5.6 %** | 2.4 % | **3.9 %** | 1.7 % |
| `tree-distant-wood` (this lane) | 0.0 % | 0.0 % | **1.1 %** | 0.5 % |
| `tree-white-bark` (lane 3) | 0.0 % | 0.0 % | 0.1 % | 0.0 % |
| **every tree's wood together** | **5.6 %** | **2.4 %** | **5.1 %** | **2.2 %** |

So of the 19–21 points of warm-hue pixels in those bands, the trees' wood is **5**. The other three quarters
are earth banks, the log arch, timber structures, props and paving — the hue classifier cannot tell wood from
soil, and neither can it in the reference frames, where the same 1.8–10.2 % includes his paths and banks.

Two consequences, both corrections to this lane's own work:

1. **"The trees show the brown" is not supported as a statement about trees** by that measurement. Our tree
   wood at his walking poses is 5.1–5.6 % of the upper band, inside the range the same classifier gives his
   frames. The `fake/README.md` headline is superseded by this table.
2. **Nothing in this lane's files is implicated.** `tree-distant-wood` — the distant and mid layers' boles,
   this lane's — paints 0.0 % of the north band and 1.1 % of the west. The tree wood a walker sees is lane 3's
   giants' bark, 3.9–5.6 points of it.

If the owner's "brown" is about quantity or colour, the systems to look at are the ground and the timber, not
the trees; and if it is about the giants' bark specifically, it is lane 3's material. Either way the naming
above makes it a one-render question for whoever picks it up, instead of an hour of guessing.

`north-giant-bark-marked.png` and `west-distant-wood-marked.png` are the marked frames; `north-base.png` is
the unmarked one they are differenced against.
