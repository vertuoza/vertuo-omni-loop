// The three forms the arcade takes. The pointer picks the form, not the screen size: a fine primary
// pointer (a mouse, a trackpad) means a keyboard player, who gets the screen alone; anything else is
// touch, which gets a Game Boy held upright, or the Advance body held sideways.
import { useSyncExternalStore } from 'react';

export type Form = 'full' | 'handheld' | 'advance';

export function formFor({ finePointer, width, height }: { finePointer: boolean; width: number; height: number }): Form {
  if (finePointer) return 'full';
  return height >= width ? 'handheld' : 'advance';
}

const FINE = '(pointer: fine)';

function readForm(): Form {
  return formFor({ finePointer: window.matchMedia(FINE).matches, width: window.innerWidth, height: window.innerHeight });
}

function subscribe(onChange: () => void) {
  const fine = window.matchMedia(FINE);
  fine.addEventListener('change', onChange);
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    fine.removeEventListener('change', onChange);
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

/**
 * The form this device takes now, following the pointer and the orientation as they change. The
 * server cannot know it: the page is rendered `full`, and takes its form as it starts.
 */
export function useForm(): Form {
  return useSyncExternalStore(subscribe, readForm, () => 'full');
}
