import { Kbd } from './Kbd.tsx';
import { KBD_SIZES } from './Kbd.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A key cap at each size. */
export const kbdSpecimen: Specimen = (prop, value) => (
  <Kbd {...(prop === 'size' ? { size: one(KBD_SIZES, value) } : {})}>Esc</Kbd>
);
