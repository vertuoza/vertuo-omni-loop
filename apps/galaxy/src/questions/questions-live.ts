import 'server-only';
import { viewer } from '../data/viewer';
import { outboxItemsRepository } from '../outbox-items/outbox-items.repository';
import { outboxItemsService } from '../outbox-items/outbox-items.service';
import type { QuestionsHandlerDeps } from './questions.controller';
import { questionsRepository } from './questions.repository';
import { questionsService } from './questions.service';

// The Questions tab's answer route's real dependencies (PRD 1548 s9), for /api/outbox/answer: the
// signed-in person's client from the request's cookies, as viewer() reads it, so row-level security and
// outbox_settle() decide what it reads and writes. The question is read through the outbox's own service
// (src/outbox-items), the answer settled through the tab's repository. With no database here, closed;
// the demo and a signed-out request, nobody.

export function questionsDeps(): QuestionsHandlerDeps {
  return {
    async signedIn() {
      const seen = await viewer();
      if (seen.kind === 'closed') return 'closed';
      if (seen.kind !== 'signed-in') return null;
      return questionsService({ items: outboxItemsService(outboxItemsRepository(seen.db)).items, settle: questionsRepository(seen.db).settle });
    },
    log: (line) => { console.error(line); },
  };
}
