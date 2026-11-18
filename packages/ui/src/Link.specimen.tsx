import { Link } from './Link.tsx';
import { LINK_VARIANTS } from './Link.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Link in each variant. */
export const linkSpecimen: Specimen = (_prop, value) => <Link href="#outbox" variant={one(LINK_VARIANTS, value)}>the outbox</Link>;
