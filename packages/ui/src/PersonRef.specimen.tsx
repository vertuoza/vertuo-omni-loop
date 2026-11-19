import { PersonRef } from './PersonRef.tsx';
import { PERSON_REF_VARIANTS } from './PersonRef.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A PersonRef in each variant. */
export const personRefSpecimen: Specimen = (_prop, value) => <PersonRef name="Ada Lovelace" href="#ada" variant={one(PERSON_REF_VARIANTS, value)} />;
