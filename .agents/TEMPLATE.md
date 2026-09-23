---
agent: <your-stable-id>
runtime: <e.g. Cursor Cloud Agent / Codex / Claude Code>
github: <account you commit as>
status: active | idle | finished
branch: <current branch>
updated: <ISO timestamp>
---

# <agent-id> — work log

Copy this file to `.agents/<agent-id>.md`. Keep the YAML front-matter — the Director's Monitor
reads it to show who is active. Update before a major task, after finishing a subsystem, and
before ending a session. Never edit another agent's log.

## Current task
What you are working on right now, and which rubric items (`gauntlet/RUBRIC.md`) it targets.

## Files / systems being touched
Directories and key files, so the other agent can avoid colliding.

## Completed work
Short entries with commit hashes / PR links. Newest first.

## Important decisions
Architecture, rendering, asset, performance or visual decisions the other agent needs to know.

## Known issues
Bugs, weaknesses, unfinished work.

## Recommended next work
Tasks the other agent can safely pick up (and which directories they live in).

## Last updated
ISO timestamp.
