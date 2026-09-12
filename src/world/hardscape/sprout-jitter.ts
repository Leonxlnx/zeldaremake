/**
 * Joint-sprout jitter streams (round 14).
 *
 * `buildSproutMeshes` draws every instance's rotation / scale / tint from one stream in pack →
 * variant → list order, so each spot appended to the shared list re-rolled all the instances
 * after it in that traversal: round 13's lawn pocket re-rolled 3 417 of the 3 960 untouched
 * instances outside the pocket (all its grit and cushions) although their placements were
 * exact. Here every (source,
 * variant) pair has its own stream, consumed in that scatter's own order, so a scatter can be
 * reworked without touching any other — `SproutSpot.source` names the scatter.
 *
 * The scatters that existed in 77dd665 (round 12) keep the look they have had since: their
 * streams are the shared `sprouts` fork advanced to the exact draw where that build's traversal
 * reached the pair, so every instance of an untouched scatter gets the very randoms it got then.
 * `R12_TRAVERSAL` records that traversal — pack order [[TUFT_B], [TUFT_A], [TUFT_C, GRIT],
 * [CLOVER, CUSHION]], variant by variant, the scatters in list order — with the block counts of
 * that build at quality density 1, after the 86 903 draws its sowing loops had taken from the
 * same stream. They are frozen facts of that build (measured with the offline instance harness);
 * should a legacy scatter's sowing ever change, its positions change with it and the offsets
 * simply remain fixed, independent stream starts. New scatters get fresh forks.
 */
import type { Rng } from '../util/prng';
import { CLOVER, CUSHION, GRIT, TUFT_A, TUFT_B, TUFT_C, type SproutJitterStreams } from '../materials/sprouts';

export const SPROUT_JITTER_SCHEME = 'per-source-stream';

/** randoms `buildSproutMeshes` draws per instance: k, yaw, height jitter, 3 tint (tufts / clover); k, yaw, 3 scale, 3 tint (cushion); k, 2 axis, angle, 3 scale, 2 tint (grit) */
const DRAWS_PER_INSTANCE: Record<number, number> = { [TUFT_A]: 6, [TUFT_B]: 6, [TUFT_C]: 6, [CLOVER]: 6, [CUSHION]: 8, [GRIT]: 9 };

/** draws the round-12 sowing loops took from the `sprouts` fork before the instances were built */
const R12_SOWING_DRAWS = 86903;

/** round 12's instance traversal: [source, variant, instances] in draw order */
const R12_TRAVERSAL: [string, number, number][] = [
  ['joints', TUFT_B, 450],
  ['pocket-scatter', TUFT_B, 50],
  ['edge-turf', TUFT_B, 13],
  ['stairs', TUFT_B, 20],
  ['joints', TUFT_A, 418],
  ['lawn-paving', TUFT_A, 44],
  ['pocket-scatter', TUFT_A, 87],
  ['edge-turf', TUFT_A, 77],
  ['stairs', TUFT_A, 40],
  ['joints', TUFT_C, 343],
  ['lawn-paving', TUFT_C, 71],
  ['pocket-scatter', TUFT_C, 36],
  ['edge-turf', TUFT_C, 42],
  ['stairs', TUFT_C, 32],
  ['seam-grit', GRIT, 1600],
  ['stair-grit', GRIT, 95],
  ['joints', CLOVER, 289],
  ['lawn-paving', CLOVER, 17],
  ['pocket-scatter', CLOVER, 47],
  ['edge-turf', CLOVER, 27],
  ['stairs', CLOVER, 35],
  ['seam-cushions', CUSHION, 300],
  ['lawn-paving', CUSHION, 18],
  ['edge-turf', CUSHION, 31],
  ['stairs', CUSHION, 93],
];

/**
 * The jitter streams for the hardscape's joint sprouts. `rng` is the hardscape stream (the one
 * whose `fork('sprouts')` sows the joints), so the legacy streams replay the same sequence.
 */
export function createSproutJitterStreams(rng: Rng): SproutJitterStreams {
  const offsets = new Map<string, number>();
  let at = R12_SOWING_DRAWS;
  for (const [source, variant, count] of R12_TRAVERSAL) {
    offsets.set(`${source}/${variant}`, at);
    at += count * DRAWS_PER_INSTANCE[variant];
  }
  return (source, variant) => {
    const legacy = offsets.get(`${source}/${variant}`);
    if (legacy !== undefined) {
      const r = rng.fork('sprouts');
      for (let i = 0; i < legacy; i++) r();
      return r;
    }
    return rng.fork(`sprout-jitter/${source ?? 'unlabelled'}/${variant}`);
  };
}
