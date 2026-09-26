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
node legosw/scripts/render.mjs --size 1280x720 --subframes 4 --msaa 1 --audio   # frames → legosw/out/frames, soundtrack → legosw/out/audio.wav
node legosw/scripts/render.mjs --encode-only                                     # → legosw/out/lego-rots-battle-over-coruscant.mp4
```

Rendering runs headless Chrome (software WebGL works). Frames already on disk are skipped, so an
interrupted render resumes; `--shards 3 --shard 0|1|2` splits the work across processes.
`--subframes 4` averages four shutter samples per frame, each offset by a sub-pixel Halton jitter, so
the same pass gives motion blur and anti-aliasing (MSAA is then redundant, hence `--msaa 1`); shots
can ask for more samples and a shorter shutter (the long take uses 6 at 0.32).
`node legosw/scripts/still.mjs --film --times 25,42 --subframes 4 --msaa 1` renders individual stills.

## How it is built

| Folder | What |
| --- | --- |
| `src/core/` | The brick kit: chamfered moulded-brick primitives (`geom.ts`), the LEGO colour palette and ABS plastic materials (`palette.ts`), and the `Builder` that assembles models stud by stud and merges them per colour (`builder.ts`). |
| `src/assets/` | Every model: Jedi interceptors, astromechs, Venator, ARC-170, vulture droids, tri-fighters, discord missiles, buzz droids, battle droids, Munificent, the Invisible Hand and its hangar, minifigures with printed faces and sculpted hair, lightsabers. |
| `src/render/` | Reversed-Z HDR pipeline with MSAA, bloom with anamorphic streaks, screen-space ambient occlusion (per shutter sample), depth of field, optional shutter motion blur, ACES tone mapping, grading and grain; image-based lighting studios (space, and the hangar bay once its ray shield is down). |
| `src/world/` | Star field and galactic band (`sky.ts`), the battle 17–50 km beyond the fleet (`deep-battle.ts`: capital-ship silhouettes trading time-pure volleys) and Coruscant: a city of LEGO blocks ray-traced per pixel on a carrier cap under the camera (`planet.ts`), with facades, roofs, streets and parks close up and an area-averaged version far away, brick-built mega-towers that sink into the city at grazing angles, a cloud deck that casts shadows, a gold terminator, night windows and traffic lanes. District data, shadow maps and clouds are baked once at start-up (`planet-data.ts`). |
| `src/fx/` | Time-pure effects: laser bolts (faded near the lens), fireballs that move with their target, smoke, bursts of real LEGO pieces, hull impacts, sparks, landing dust. |
| `src/film/` | The shot list (`shots.ts`), the world (`world.ts`), the battle (`battle.ts`: fighter duels where every bolt has a target and every kill explodes on its frame, turbolaser salvos from real turrets onto real hulls), shared picture/sound timings (`choreo.ts`), the crawl, the end title over the flagships' broadside and the timeline. The film is a pure function of time, so any frame renders identically on its own. |
| `src/audio/` | The soundtrack, synthesised offline with WebAudio: an original orchestral score (brass, strings, choir, timpani, one cue per shot around a recurring theme), engines, cannons, turbolasers, explosions with plastic-brick clatter, buzz saws, astromech chatter, lightsabers and the spoken lines (stock Kokoro-82M TTS voices in `public/audio/dialogue`, made by `scripts/tts/make_dialogue.py`), mixed for phone speakers and mastered to -14 LUFS. |

Units are LEGO studs (1 = 8 mm): a plate is 0.4, a brick 1.2, a minifigure about 4.75 tall. Capital
ships are built from the same bricks at 8× scale, so their studs read at film scale.
