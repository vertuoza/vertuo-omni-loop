import { outboxItemsDeps } from '../../../../../src/outbox-items/outbox-items-live';
import { settleOutboxItem } from '../../../../../src/outbox-items/outbox-items.controller';

// POST /api/outbox/items/settle {product, prd, repo?, item, verdict, basis, answer} → 200 {id, item, prdId,
// verdict, settledAt}: settles a product PRD's open item with an answer given in the terminal, for the
// kit's `server` outbox store (src/outbox-items/outbox-items.controller.ts, PRD 1548 s7).
export const maxDuration = 60;

export function POST(request: Request) {
  return settleOutboxItem(request, outboxItemsDeps());
}
