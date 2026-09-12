# Continue the environment work locally

Owner direction, reaffirmed 2026-09-12: improve the environment, world detail, light and shadows.
Character modelling is paused until the owner resumes with Blender MCP on their own PC.
The character currently rendered on this environment branch is a placeholder, not the finished model.

## Get the right working branch

The current Astra environment work is on `agent/astra-environment-lighting`, draft PR6.
`main` is not the current game build. For a new checkout:

```sh
git clone --branch agent/astra-environment-lighting https://github.com/Leonxlnx/zeldaremake.git
cd zeldaremake
npm ci
npm run dev
```

For an existing checkout, inspect `git status` and preserve local work before switching branches.
Read `AGENTS.md`, `PROJECT_STATE.md`, `.agents/astra-environment.md`, the latest Fable log,
claims and PR2/PR6 before changing a shared subsystem. Fetch fresh commits; branch ownership
and partner activity may have changed since this note.

## Shared evidence and collaboration

- [Actual world screenshot archive](https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment)
- [Owner concept boards, compressed previews](https://github.com/Leonxlnx/zeldaremake/tree/agent/astra-owner-reference-previews/reference/owner-concept-previews)
- [Astra source / PR6](https://github.com/Leonxlnx/zeldaremake/pull/6)
- [Fable world source / PR2](https://github.com/Leonxlnx/zeldaremake/pull/2)

The dated comparison folders contain12 actual images, with10 distinct images because B/E use
the same saved camera. Supplemental `details/` folders contain four fixed full-scene closeups.
Capture metadata distinguishes source, controls, camera, time and depth. These are art-review
checkpoints, not formal gauntlet takes or declarations of completion.

Fable supplied the world geometry; Astra supplied the reviewed light/fog/shadow changes and
village prop work. Narrow integration corrections are documented under `docs/proposals/` with
pinned evidence. Their tests do not alter production source. The current adoption state and
known limitations belong in Astra's log and the PR discussions.

No automatic merge of main or another agent's PR, no force push, no scheduled tasks. Continue
using independent branches, deliberate integration, real game captures and named checkpoints.
Blender MCP has not been installed or configured by this cloud checkpoint; handle that in the
owner's actual local environment when they resume model work.
