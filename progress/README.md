# Progress screenshots

[Open the dated screenshot galleries](https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-progress/progress)

[First 12 screenshots](https://github.com/Leonxlnx/zeldaremake/tree/9b9b902d8762455c498e37873efdddd9a6d540ef/progress/2026-09-11_0809-first-12)
 · [Download those 12 as a ZIP](https://github.com/Leonxlnx/zeldaremake/archive/9b9b902d8762455c498e37873efdddd9a6d540ef.zip)

[Download the current project source](https://github.com/Leonxlnx/zeldaremake/archive/refs/heads/agent/astra-link-movement.zip)
includes the game code and assets. Extract it, open a terminal in the extracted project folder,
and run these commands with Node 22 installed:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. WASD or the arrow keys walk, Shift runs, Space jumps,
and dragging turns the camera. P switches between Link and the free camera. This is a source
download that runs through Vite; opening `index.html` directly will not run the game.

The character capture workflow renders meaningful source changes and pushes each completed
pass to its own dated folder on `captures/astra-progress`. Screenshots have descriptive names,
and each folder includes its source commit, capture time, and an image gallery. New galleries
contain twelve views, including the house and stairway. Older folders
remain available. Source-matched motion clips are included when the pass records them.

These are actual game renders from Astra and Fable's shared project. They show work in
progress, not a claim of completed reference fidelity. The latest working experiments may
still be awaiting a completed renderer pass.
