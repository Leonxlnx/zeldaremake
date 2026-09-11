/** Bounded adaptive actual-IK samples, not continuous/all-input certification. */
import { cloneRequest, interpolateRequest, type PairPose, type PairRequest, createPairIK } from './contact-pose';
import { createLowerBodyClearance, type LowerBodyResult } from './lower-body-clearance';

type IK = ReturnType<typeof createPairIK>;
type Geometry = ReturnType<typeof createLowerBodyClearance>;
export interface PathStats {
  samples: number; refinements: number; maximumSamples: number;
  minimumFraction: number; minimumLowerBound: number; nearSamples: number;
}
type Sample = { u: number; pose: PairPose; check: LowerBodyResult };
const NEAR = .004, BUDGET = 256, DEPTH = 12;

export function contactSample(geometry: Geometry, pose: PairPose) {
  // A zero-margin GJK query may stop at its first positive but very weak bound.
  // Instead prove successively smaller separating distances. These are query
  // targets, never permitted overlap or collision tolerances. At most twelve
  // bounded bracket queries precede the unchanged zero-margin classification.
  for (let level = 0; level < 12; level++) {
    const result = geometry.query(pose.frames, NEAR / 2 ** level);
    if (result.status === 'clear') return result;
    // A near-zero attainable upper bound already establishes contact at the
    // unchanged numerical precision; reconfirm with the original zero gate.
    if (result.distanceUpper <= 2e-9) break;
  }
  return geometry.query(pose.frames, 0);
}

export function checkContactPath(ik: IK, geometry: Geometry, from: PairPose, to: PairPose,
  coarseSteps: number, stats: PathStats, requestAt?:(u:number)=>PairRequest|null) {
  let calls = 0;
  let failure: { status: 'near-contact-budget' | 'near-contact-resolution' | 'trajectory' | 'trajectory-construction'; detail: unknown } | null = null;
  const cache = new Map<number, Sample>();
  const sample = (u: number): Sample | null => {
    const old = cache.get(u); if (old) return old;
    if (calls >= BUDGET) {
      failure = { status: 'near-contact-budget', detail: { calls, u, budget: BUDGET } }; return null;
    }
    const request = u === 0 ? from.request : u === 1 ? to.request : requestAt?requestAt(u):interpolateRequest(from.request,to.request,u);
    if(!request){failure={status:'trajectory-construction',detail:{u}};return null;}
    const pose = u === 0 ? from : u === 1 ? to : ik.solve(request);
    const check = contactSample(geometry, pose);
    calls++; stats.samples++; stats.maximumSamples = Math.max(stats.maximumSamples, calls);
    stats.minimumLowerBound = Math.min(stats.minimumLowerBound, check.distanceLower);
    if (check.distanceLower < NEAR) stats.nearSamples++;
    if (pose.status !== 'clear' || check.status !== 'clear') {
      failure = { status: 'trajectory', detail: { u, ik: pose.status, check, request: cloneRequest(pose.request) } };
      return null;
    }
    const result = { u, pose, check }; cache.set(u, result); return result;
  };
  const interval = (a: Sample, b: Sample, depth: number): boolean => {
    const clearance = Math.min(a.check.distanceLower, b.check.distanceLower);
    if (clearance >= NEAR) return true;
    // Always inspect the nonlinear IK midpoint near contact, even if the two
    // endpoint frame transforms barely differ.
    const middle = sample((a.u + b.u) / 2); if (!middle) return false;
    const gap = Math.min(clearance, middle.check.distanceLower);
    const travel = Math.max(geometry.motionBound(a.pose.frames, middle.pose.frames),
      geometry.motionBound(middle.pose.frames, b.pose.frames));
    stats.minimumFraction = Math.min(stats.minimumFraction, (b.u - a.u) / 2);
    if (travel <= gap * .25) return true;
    if (depth >= DEPTH) {
      failure = { status: 'near-contact-resolution', detail: { a: a.u, b: b.u, gap, travel, depth } }; return false;
    }
    stats.refinements++;
    return interval(a, middle, depth + 1) && interval(middle, b, depth + 1);
  };
  let previous = sample(0); if (!previous) return { ...failure!, samples: calls };
  for (let n = 1; n <= coarseSteps; n++) {
    const next = sample(n / coarseSteps);
    if (!next || !interval(previous, next, 0)) return { ...failure!, samples: calls };
    previous = next;
  }
  return { status: 'clear' as const, detail: null, samples: calls };
}
