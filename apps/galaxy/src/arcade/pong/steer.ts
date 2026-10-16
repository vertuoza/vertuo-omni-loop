// Two sounds, two ways: above the band the paddle moves up, below it down, inside it and in silence it holds.
import { BAND_HZ } from './rules';

export type Steer = 'up' | 'down' | 'still';

export function steerOf(hz: number | null, limit: number): Steer {
  if (hz === null) return 'still';
  if (hz > limit + BAND_HZ) return 'up';
  if (hz < limit - BAND_HZ) return 'down';
  return 'still';
}
