import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { PageHeader } from './PageHeader.tsx';
import { PAGE_HEADER_LEVELS } from './PageHeader.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A PageHeader at each level, with its eyebrow, subtitle, status, five facts, Actions menu, secondary and primary action. */
export const pageHeaderSpecimen: Specimen = (_prop, value) => (
  <PageHeader
    title="Checkout rewrite"
    eyebrow="PRD 12"
    lede="Pierre approves the spec and plan."
    status={<Badge>Building</Badge>}
    meta={['Approved by pierrederval, 17 Nov', 'omni-loop · vertuo-omni-loop', 'Feature PR #3020', '2 agent decisions adopted', 'Opened by Pierre, 17 Nov']}
    actions={[{ id: 'delete', label: 'Delete draft', tone: 'danger' }]}
    secondary={<Button variant="secondary">Copy link</Button>}
    action={<Button variant="primary">Review and approve</Button>}
    level={one(PAGE_HEADER_LEVELS, value)}
  />
);
