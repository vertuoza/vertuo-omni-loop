import { PrdRef } from './PrdRef.tsx';
import { PRD_REF_VARIANTS } from './PrdRef.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A PrdRef in each variant. */
export const prdRefSpecimen: Specimen = (_prop, value) => <PrdRef number={12} title="Parts and the catalogue" href="#prd-12" variant={one(PRD_REF_VARIANTS, value)} />;
