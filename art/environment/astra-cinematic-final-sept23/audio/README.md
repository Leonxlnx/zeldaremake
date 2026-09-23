# Cinematic audio — e599075f

Final: **cinematic-30s-48k-stereo.wav**, 30.000s, stereo 48kHz PCM16.

Measured after processing: **-24.57 LUFS integrated**, **-8.90 dBTP**, **7.10 LU loudness range**. Fade-in 1.2s; fade-out from 27s to 30s. Both endpoints are digital silence.

Uses the frozen checkpoint's existing procedural forest ambience, seeded reverb and original “Under the Boughs” woodwind/harp score. The music's dry and reverb paths are each reduced to 0.45 before the final combined level pass. No footsteps or positional lantern sounds were guessed. No recordings, external assets, downloads, narration or music service.

The repository package metadata declares MIT; the music source explicitly documents the score as original. This checkout has no standalone LICENSE file. Source hashes and full processing measurements are in provenance.json.

Rendering used OfflineAudioContext in a blank headless Chrome page with GPU and WebGL disabled. No world was loaded or rendered, and no frozen source changed. Separate raw ambience/music/mix stems are retained.

The final MP4 adds 3 dB to this WAV before AAC encoding; its measured levels are -21.61 LUFS integrated and -5.89 dBTP. The WAV itself is unchanged.

The included helpers preserve the capture-machine commands. To reproduce elsewhere, adjust the Windows source/dependency paths in render-audio.mjs to a checkout of cinematic-2026-09-23 with installed dependencies, then run it followed by finish-audio.mjs. Existing TypeScript, Puppeteer and FFmpeg installations only. Raw stems remain local and are not included in this folder.
