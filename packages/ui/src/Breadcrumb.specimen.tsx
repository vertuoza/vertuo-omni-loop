import { Breadcrumb } from './Breadcrumb.tsx';
import { BREADCRUMB_DEPTHS } from './Breadcrumb.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const trail = [
  { label: 'Home', href: '#home' },
  { label: 'PRDs', href: '#prds' },
  { label: 'PRD 12', href: '#prd-12' },
  { label: 'Slices' },
];

/** How many specimens were drawn: /design shows one per variant and theme, and each navigation needs its own name. */
let drawn = 0;

/** A trail of two or four crumbs. */
export const breadcrumbSpecimen: Specimen = (_prop, value) => {
  drawn += 1;
  const depth = Number(one(BREADCRUMB_DEPTHS, value));
  return <Breadcrumb items={[...trail.slice(0, depth - 1), ...trail.slice(-1)]} label={`Breadcrumb ${String(drawn)}`} />;
};
