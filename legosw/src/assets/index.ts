import type { Object3D } from 'three';
import { testBricks } from './testBricks';
import { LAB_A } from './lab-a';
import { LAB_B } from './lab-b';
import { LAB_C } from './lab-c';
import { LAB_D } from './lab-d';
import { LAB_FIGS } from './lab-figs';

/**
 * Asset registry for the lab turntable (`?lab=<id>`) and the still renderer. Each asset owner keeps
 * its own lab-*.ts table so parallel work never edits the same file. A factory returns a fresh
 * Object3D; `userData.animate?.(t)` is called every lab frame if present.
 */
export type AssetFactory = () => Object3D;

export const ASSETS: Record<string, AssetFactory> = {
  'test-bricks': testBricks,
  ...LAB_A,
  ...LAB_B,
  ...LAB_C,
  ...LAB_D,
  ...LAB_FIGS,
};
