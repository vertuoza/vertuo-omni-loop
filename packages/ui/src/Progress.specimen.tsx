import { Progress } from './Progress.tsx';
import { PROGRESS_TONES } from './Progress.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Progress at 40% in each tone. */
export const progressSpecimen: Specimen = (_prop, value) => <Progress label="Tokens used" value={40} tone={one(PROGRESS_TONES, value)} />;
