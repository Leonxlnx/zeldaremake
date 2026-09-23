# Quaternius motion provenance receipt

The previously referenced `reference/animations/quaternius-standard/SOURCE.json` existed only as an untracked file in the original `E:/zeldaremake` checkout. It was absent from this worktree and was not excluded by a Git ignore rule. The original receipt and LICENSE have now been copied byte-for-byte to that referenced repository path: **851+7,048=7,899 bytes**. No motion binary or new asset was copied or downloaded.

The [author's Universal Animation Library page](https://quaternius.com/packs/universalanimationlibrary.html), checked on2026-09-21, identifies the library as CC0. The original retrieval receipt records2026-09-16 and pins mirror commit `e24c23cf2a1323488a3faa226ea7ea21f644b73e`. Those original values were preserved. The [pinned mirror LICENSE](https://raw.githubusercontent.com/J-Ponzo/gltf-universal-animation-library/e24c23cf2a1323488a3faa226ea7ea21f644b73e/LICENSE) is CC0 1.0 Universal.

The optional raw Standard motion source remains external. Exact pinned locations are:

- [AnimationLibrary_Godot_Standard.gltf](https://raw.githubusercontent.com/J-Ponzo/gltf-universal-animation-library/e24c23cf2a1323488a3faa226ea7ea21f644b73e/glTF/AnimationLibrary_Godot_Standard.gltf)
- [AnimationLibrary_Godot_Standard.bin](https://raw.githubusercontent.com/J-Ponzo/gltf-universal-animation-library/e24c23cf2a1323488a3faa226ea7ea21f644b73e/glTF/AnimationLibrary_Godot_Standard.bin)

Their expected SHA256 values are `0ff075c7ad6855c5c2c37a171592ee8f0d6ab2f58259e2be77a9b63dd8027765` and `6e65377d81558333c4093dbb144a48fd19019343d82b1a3a7992a98ec0e0543c`, respectively. The existing local copies match these receipt hashes and the pinned Git tree's blob identities. This check read the existing files and public tree metadata; it did not fetch or vendor new motion files.

The copied SOURCE.json SHA256 is `221f368f4e7c9d8c1f052ebd5a6ffec32ff1821faef061004467a6d5b195ffc2`; LICENSE is `a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499`. [receipt.json](receipt.json) preserves the byte counts, all four checked upstream-file hashes and pinned blob identities. The upstream README was not copied: its license hyperlink points to an unrelated medieval-village repository. Its original checksum remains in the unchanged retrieval receipt.

This receipt supports the recorded Quaternius `Jog_Fwd_Loop` run-motion input. The shipped stair changes are separately documented native edits to an existing clip; this receipt does not establish that the entire stair clip came from Quaternius. Reproducing the shipped character still uses the existing hash-pinned Git/native baselines and export scripts. These two metadata files do not regenerate it by themselves, and CC0 here does not relicense the separate model or whole game.
