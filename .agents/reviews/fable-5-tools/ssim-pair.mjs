// usage: node ssim.mjs <a.png> <b.png> [ref.jpg]  → SSIM(a,b) at the gauntlet's compare size, plus SSIM(a,ref), SSIM(b,ref) when a reference is given
import { toGray, ssim, pixelDiffFraction, toRgb } from '../../../gauntlet/scripts/lib/image.mjs';
const [a, b, ref] = process.argv.slice(2);
const W = 256, H = 144;
const gA = await toGray(a, W, H), gB = await toGray(b, W, H);
const out = { ab: +ssim(gA, gB, W, H).toFixed(4), pixDiff: +pixelDiffFraction(await toRgb(a, W, H), await toRgb(b, W, H)).toFixed(4) };
if (ref) { const gR = await toGray(ref, W, H); out.aRef = +ssim(gA, gR, W, H).toFixed(4); out.bRef = +ssim(gB, gR, W, H).toFixed(4); out.delta = +(out.bRef - out.aRef).toFixed(4); }
console.log(JSON.stringify(out));
