import 'server-only';
import { viewer } from '../data/viewer';
import { outboxItemsRepository } from '../outbox-items/outbox-items.repository';
import { outboxItemsService } from '../outbox-items/outbox-items.service';
import { withOutboxAppTold } from '../server-event/server-event-live';
import type { QuestionsHandlerDeps } from './questions.controller';
import { questionsService } from './questions.service';

// The Questions tab's answer route's real dependencies (PRD 1548 s9), for /api/outbox/answer: the
// signed-in person's client from the request's cookies, as viewer() reads it, so row-level security and
// outbox_settle() decide what it reads and writes. The question is read and settled through the outbox's
// own service (src/outbox-items), wrapped as the outbox's own routes wrap it, so the App is told
// `item-settled` once (src/server-event, s8). With no database here, closed; the demo and a signed-out
// request, nobody.

export function questionsDeps(): QuestionsHandlerDeps {
  return {
    async signedIn() {
      const seen = await viewer();
      if (seen.kind === 'closed') return 'closed';
      if (seen.kind !== 'signed-in') return null;
      const outbox = outboxItemsRepository(seen.db);
      const items = withOutboxAppTold(outboxItemsService(outbox), outbox.dossier);
      return questionsService({ items: (query) => items.items(query), settle: (request) => items.settle(request) });
    },
    log: (line) => { console.error(line); },
  };
}
