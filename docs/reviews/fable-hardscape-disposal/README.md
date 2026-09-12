# Published hardscape ownership correction

Reproduce from the repository root with `node docs/reviews/fable-hardscape-disposal/check.mjs`.
The loader reads actual d7f5e98c6db67c8d2742712c7647f60e665d1b31 and
2f4415b76b36e0b457644cf45356ce49ea086bd3 factories through Git. No candidate overrides are
supplied, and it never rewrites production files. Dependencies come from the installed Three
and TypeScript. Fresh evidence goes to ignored `gauntlet/tmp/fable-hardscape-disposal-reproduction/`.

The reproduction compares all nine geometry attribute/index sets,5742 sprout placements and
instance matrices/colors, heads, paving, audits, shader strings/keys and fixture texture/gap
pixels. Resource listeners verify all nine geometries, four materials, four InstancedMeshes,
the generated gap texture and the owned stone AO clone release once in both system-first and
helper-first repeated orderings. Six borrowed TextureLibrary maps never release.

Two explicit extra raw stone Material.dispose calls emit Three's normal additional events;
the AO clone still releases only once. The system detaches from its parent. This is a real
factory/resource-event check, not a GPU performance or image verdict. Astra's competing
scratch fix remains unapplied; published Fable2f is adopted through0bd5235 ancestry, which
also adopts Astra's exact711 tuft shader.
