import type { Eta2 } from './types';
import { anchor, placeholderGroup } from './placeholder';

/** STUB — Eta-2 Actis Jedi interceptor ('anakin' = yellow, 'obiwan' = red). Owner: asset agent A. */
export function eta2(o: { variant: 'anakin' | 'obiwan'; lod?: 0 | 1 }): Eta2 {
  const group = placeholderGroup(`eta2-${o.variant}`, 22, 3, 26, o.variant === 'anakin' ? 'yellow' : 'red');
  const canopy = anchor('canopy', group, 0, 2, -2);
  return {
    group,
    setFoils: () => {},
    setEngine: () => {},
    cockpitAnchor: anchor('cockpit', group, 0, 0.5, -2),
    astromechAnchor: anchor('astromech', group, 3, 1, 2),
    canopy,
    muzzles: [anchor('muzzleL', group, 4, 0, 13), anchor('muzzleR', group, -4, 0, 13)],
    engines: [anchor('engineL', group, 2, 0, -13), anchor('engineR', group, -2, 0, -13)],
    breakables: [],
    length: 26,
  };
}
