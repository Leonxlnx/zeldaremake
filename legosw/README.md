# Battle over Coruscant — a brick-built Three.js short

The opening of *Star Wars: Episode III – Revenge of the Sith* (the space battle over Coruscant, up to
the hangar of General Grievous's flagship) retold beat for beat in the style of the LEGO Star Wars
games. Everything — every brick, minifigure, ship, planet, explosion and sound — is generated
procedurally in code. There are no downloaded models, textures, samples or logos.

Unofficial fan work. LEGO and Star Wars are trademarks of their respective owners; this project is
not affiliated with or endorsed by them. The opening crawl is paraphrased and the subtitles quote a
handful of short lines.

## Run it

```bash
npm install                      # once, at the repository root
npm run lsw:dev                  # http://localhost:5174 — the film plays in real time (space = pause, ←/→ = seek)
npm run lsw:dev  → /?lab=eta2-anakin&bg=space    # turntable of any asset (see src/assets/lab-*.ts)
```

## Render the film

```bash
npm run lsw:build
node legosw/scripts/render.mjs --size 1920x1080 --fps 24 --audio     # frames → legosw/out/frames, soundtrack → legosw/out/audio.wav
node legosw/scripts/render.mjs --encode-only                          # → legosw/out/lego-rots-battle-over-coruscant.mp4
```

Rendering runs headless Chrome (software WebGL works). Frames already on disk are skipped, so an
interrupted render resumes; `--shards 2 --shard 0|1` splits the work across processes.
`node legosw/scripts/still.mjs --film --times 25,42` renders individual stills.

## How it is built

| Folder | What |
| --- | --- |
| `src/core/` | The brick kit: chamfered moulded-brick primitives (`geom.ts`), the LEGO colour palette and ABS plastic materials (`palette.ts`), and the `Builder` that assembles models stud by stud and merges them per colour (`builder.ts`). |
| `src/assets/` | Every model: Jedi interceptors, astromechs, Venator, ARC-170, vulture droids, tri-fighters, discord missiles, buzz droids, battle droids, Munificent, the Invisible Hand and its hangar, minifigures with printed faces and sculpted hair, lightsabers. |
| `src/render/` | Reversed-Z HDR pipeline with MSAA, bloom, depth of field, optional shutter motion blur, ACES tone mapping, grading and grain; image-based lighting studios. |
| `src/world/` | Star field, nebula and the procedural city-planet Coruscant. |
| `src/fx/` | Time-pure effects: laser bolts, fireballs, smoke, bursts of real LEGO pieces, sparks. |
| `src/film/` | The shot list (`shots.ts`), the world (`world.ts`), the crawl and the timeline. The film is a pure function of time, so any frame renders identically on its own. |
| `src/audio/` | The soundtrack, synthesised offline with WebAudio: engines, cannons, turbolasers, explosions with plastic-brick clatter, buzz saws, astromech chatter, lightsabers, LEGO-game "mumble" dialogue and an original score. |

Units are LEGO studs (1 = 8 mm): a plate is 0.4, a brick 1.2, a minifigure about 4.75 tall. Capital
ships are built from the same bricks at 8× scale, so their studs read at film scale.
