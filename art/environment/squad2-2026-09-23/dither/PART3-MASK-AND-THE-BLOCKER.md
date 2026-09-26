# The mask is written; turning it on crashes on a freed CPU array, and that is the next step's real work

#181 landed the band's decision half and #186 the weight attribute, both inert. This adds the mask
itself — and reports that **the flag does not survive being switched on yet**, with the mechanism, so the
next attempt starts from the cause instead of rediscovering it.

## What landed (still inert: `TREE_LOD_DITHER = false`)

* the attribute is now a **drop fraction**, not a weight: 0 means "draw the whole tree", which is also
  what WebGL feeds a program for a mesh that has no such attribute. That matters because
  `mats.whiteTree` also paints the white-bark **roots** mesh, which `fillFamily` never fills — with a
  weight encoding the roots would have vanished the moment the flag went on;
* `injectLodDrop` adds `attribute float aLodDrop` / `varying float vLodDrop` and, at
  `#include <alphatest_fragment>`, discards a fragment when a `gl_FragCoord` hash falls under the drop;
* it is injected **only where a colour `extra` is passed**, never into the depth materials, because the
  white-barks' high bucket shares its geometry with round 53's shadow proxy in a different instance
  order (#186);
* the program cache key carries the flag, so flipping it cannot reuse a cached program.

Twelve tests in `lodFade.test.mjs` pin all of that, and `node --test` is at 238 with the flag off.

## Switching it on: `Cannot set properties of null (setting '0')`

Built with `TREE_LOD_DITHER = true` and a deliberately wide 12 m band (so a stipple would be obvious in
one frame), the world throws inside the first `setPose`, from `fillFamily`'s write into the attribute.

The cause is in this file, two hundred lines above the buckets:

```ts
const dropArray = function (this: { array: ArrayLike<number> | null }) { this.array = null; };
const releaseAfterUpload = (g: BufferGeometry) => {
  for (const a of Object.values(g.attributes)) (a as BufferAttribute).onUpload(dropArray …);
  …
};
```

Every attribute of a tree geometry is told to **free its CPU array once three has uploaded it** — that is
the policy behind the 219 MB of resident arrays fable-4 measured, and it is applied per geometry, over
whatever attributes the geometry has at the time. A per-frame attribute cannot live under it: after the
first upload its `array` is null, and the next `setX` is the crash above.

## The two ways out, for whoever takes the next step (me, next iteration)

1. **Attach `aLodDrop` at build time and exempt it.** Create it where the rung meshes are built, before
   `releaseAfterUpload` runs, and give it its own `onUpload(() => {})` afterwards so the sweep's callback
   is replaced rather than inherited. Cheapest, and keeps the attribute's lifetime obvious.
2. **Keep the array outside the attribute.** Hold the `Float32Array` in the variant, and after each
   upload re-point `attr.array` at it. Works, but it fights the policy every frame and hides a null
   window between upload and re-point.

(1) is the one to try. Neither is a large change; the value of this iteration is knowing which line to
change and why, rather than having flipped a flag and watched the world disappear.

## State of the shipped build

`TREE_LOD_DITHER` is back to false and the band back to 2.5 m. With the flag off none of this code runs:
#181 measured two poses byte-identical, and this commit adds no work to a flag-off frame — the mask is
not even compiled into the program, and the attribute is never attached.
