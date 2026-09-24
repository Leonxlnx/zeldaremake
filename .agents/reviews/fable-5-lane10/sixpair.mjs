// six-view pair: node sixpair.mjs <dirHead> <dirBranch> — SSIM head↔branch (256×144 grey, the gauntlet's ssim), pixels changed (full res, tol 8), each vs reference/frames
import path from 'node:path';
import { toGray, ssim, decodeNative, pixelDiffFraction } from '/workspace/gauntlet/scripts/lib/image.mjs';
const [dH, dB] = process.argv.slice(2);
const names = ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy'];
const W = 256, H = 144;
for (let i = 0; i < names.length; i++) {
  const fh = path.join(dH, `f000${i}.png`), fb = path.join(dB, `f000${i}.png`), fr = `/workspace/reference/frames/${names[i]}.jpg`;
  const [gh, gb, gr] = await Promise.all([toGray(fh, W, H), toGray(fb, W, H), toGray(fr, W, H)]);
  const [nh, nb] = await Promise.all([decodeNative(fh), decodeNative(fb)]);
  const pair = ssim(gh, gb, W, H), sh = ssim(gh, gr, W, H), sb = ssim(gb, gr, W, H);
  const changed = pixelDiffFraction(nh.rgb, nb.rgb, 8);
  console.log(`| ${names[i]} | ${pair.toFixed(4)} | ${(changed * 100).toFixed(2)} % | ${sh.toFixed(4)} → ${sb.toFixed(4)} | ${(sb - sh >= 0 ? '+' : '−') + Math.abs(sb - sh).toFixed(4)} |`);
}
