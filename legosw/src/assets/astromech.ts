import type { Astromech } from './types';
import { anchor, placeholderGroup } from './placeholder';

/** STUB — R2-D2 / R4-P17. `socket` = head + top of body only (for the fighter socket). Owner: asset agent A. */
export function astromech(o: { variant: 'r2d2' | 'r4p17'; socket?: boolean }): Astromech {
  const group = placeholderGroup(`astromech-${o.variant}`, 2, o.socket ? 1.4 : 4.2, 2, o.variant === 'r2d2' ? 'blue' : 'red');
  const head = anchor('head', group, 0, 1, 0);
  return { group, head, setHeadYaw: (a) => (head.rotation.y = a), setLights: () => {}, zapAnchor: anchor('zap', group, 0, 0.5, 1) };
}
