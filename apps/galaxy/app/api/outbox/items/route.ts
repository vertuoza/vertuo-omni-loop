import { outboxItemsDeps } from '../../../../src/outbox-items/outbox-items-live';
import { putOutboxItem, readOutboxItems } from '../../../../src/outbox-items/outbox-items.controller';

// GET /api/outbox/items?product=<key>&prd=<n>[&repo=<owner/name>] → 200 {prdId, items}: a product PRD's
// outbox items, each with its settlement. POST /api/outbox/items {product, prd, repo?, body, adopt?} → 200
// {id, item, prdId, …}: raises an item, or adopts a medium one at once. Both for the kit's `server` outbox
// store (src/outbox-items/outbox-items.controller.ts, PRD 1548 s7).
export const maxDuration = 60;

export function GET(request: Request) {
  return readOutboxItems(request, outboxItemsDeps());
}

export function POST(request: Request) {
  return putOutboxItem(request, outboxItemsDeps());
}
