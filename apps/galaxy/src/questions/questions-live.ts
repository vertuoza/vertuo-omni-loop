import 'server-only';
import { viewer } from '../data/viewer';
import { outboxItemsRepository } from '../outbox-items/outbox-items.repository';
import { outboxItemsService } from '../outbox-items/outbox-items.service';
import { liveSendServerEvent } from '../server-event/server-event-live';
import type { QuestionsHandlerDeps } from './questions.controller';
import { questionsRepository } from './questions.repository';
import { questionsService, tellSettled } from './questions.service';

// The Questions tab's answer route's real dependencies (PRD 1548 s9), for /api/outbox/answer: the
// signed-in person's client from the request's cookies, as viewer() reads it, so row-level security and
// outbox_settle() decide what it reads and writes. The question is read through the outbox's own service
// (src/outbox-items), the answer settled through the tab's repository, and the App then told
// `item-settled` (src/server-event, s8), as the outbox's own settle route tells it. With no database here,
// closed; the demo and a signed-out request, nobody.

const log = (line: string) => { console.error(line); };

export function questionsDeps(): QuestionsHandlerDeps {
  return {
    async signedIn() {
      const seen = await viewer();
      if (seen.kind === 'closed') return 'closed';
      if (seen.kind !== 'signed-in') return null;
      const outbox = outboxItemsRepository(seen.db);
      const items = outboxItemsService(outbox);
      const answers = questionsRepository(seen.db);
      return questionsService({
        items: (query) => items.items(query),
        settle: (prd, settlement) => answers.settle(prd, settlement),
        settled: tellSettled({ dossierOf: (prd) => outbox.dossier(prd), send: liveSendServerEvent, now: () => new Date(), log }),
      });
    },
    log,
  };
}
