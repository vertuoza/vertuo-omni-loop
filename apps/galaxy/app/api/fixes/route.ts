import { fixRowsPush } from '../../../src/fixes/rows';
import { fixRowsDeps } from '../../../src/fixes/rows-live';

// POST /api/fixes {productKey, new | bug, title, record, rows} → 201 or 200 {dossierId, bug, created,
// product, rows, added, unchanged}: the kit's `omni bug push --product` records a bug born on the server
// (src/fixes/rows.ts, PRD 2011).
export const maxDuration = 10;

export function POST(request: Request) {
  return fixRowsPush(request, fixRowsDeps());
}
