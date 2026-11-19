import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { PageHeader } from './PageHeader.tsx';
import { PAGE_HEADER_LEVELS } from './PageHeader.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A PageHeader at each level, with its eyebrow, lede, status and action. */
export const pageHeaderSpecimen: Specimen = (_prop, value) => (
  <PageHeader
    title="Checkout rewrite"
    eyebrow="PRD 12"
    lede="One line on what it changes"
    status={<Badge>Building</Badge>}
    action={<Button variant="primary">Approve</Button>}
    level={one(PAGE_HEADER_LEVELS, value)}
  />
);
