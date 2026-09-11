# Movement timing checkpoint — not integrated

This preserves an unfinished movement solver separately from the playable source and the earlier [viability checkpoint](../movement-viability/README.md). Standing frames 0–203 and walking frames 0–239 pass the bounded numerical replay. **Running refuses frame 60** at the ordinary knee-rate gate during early liftoff, with graph, coordinator and geometry rollback intact.

The 24-file movement overlay is pinned to `f11559532805948079aaa0fdcf84b8a293ebab6b`. It contains contact timing, continuous orientation, recovery support, and early-release work; it excludes model/asset changes. `manifest.json` records changed sources and unchanged dependencies. The runner reads all remaining source, including character assets, directly from that Git revision.

From the repository root with dependencies installed and the pinned commit available:

```sh
node experiments/astra/movement-timing/replay.mjs
```

The runner verifies overlay hashes and writes `reproduced-prefix.json` beside itself. Keep that large generated report local. `latest-evidence.json` contains the frozen bounded results and costs; `reproduction-verified.json` records their original reproduction against pinned assets. These are numerical results, not screenshots or visual approval.

Existing physical limits remain enforced. The ordinary knee-rate domain is 40.964617 rad/s; the air-transition bound remains 10.75 rad/s. Known gaps include running 60, restart arbitration after simultaneous contacts, the unreachable historical running 216/217 calf-detail floor witness, continuous terrain clearance, and performance acceptance. A prior prototype's accidental extra release was rejected before this snapshot. Do not replace playable movement with this overlay.

Imported from the frozen timing publication manifest SHA-256 `6e0ce3df8bdf5f2985a5ce925ea8cf159809d0760bcbf9bae35784a6e8c51cd3`. All source, runner and evidence bytes are preserved; this README was shortened and its command relocated. Production source and the earlier experiment are unchanged.
