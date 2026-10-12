import 'server-only';
import { serverEnv } from '../env';
import { productVoidRepository } from './server-event.repository';
import type { OutboxItemsService } from '../outbox-items/outbox-items.service';
import { OMNI_APP_URL, SERVER_EVENT_PATH, sendServerEvent, tellAppOfVoid, withOutboxTold, type DossierOf, type ServerEvent } from './server-event.service';

// The server events, for real (PRD 1548 s4): POSTed to the App's production route, signed with this
// deployment's STAGE_EVENT_SECRET (read per call), with the platform's fetch. Without the secret nothing is
// sent, said in the log.

const log = (line: string) => { console.error(line); };

/** Sends one server event to the App. Never throws. */
export function liveSendServerEvent(event: ServerEvent): Promise<boolean> {
  return sendServerEvent(event, { url: `${OMNI_APP_URL}${SERVER_EVENT_PATH}`, secret: serverEnv().stageEventSecret, fetch, log });
}

/** A push route's `tellVoids`, which then tells the App when the push voided a product PRD's approval. */
export function withAppTold<Db extends Parameters<typeof productVoidRepository>[0]>(
  tellVoids: (db: Db, dossier: string, origin: string) => Promise<void>,
): (db: Db, dossier: string, origin: string) => Promise<void> {
  return async (db, dossier, origin) => {
    await tellVoids(db, dossier, origin);
    await tellAppOfVoid({ voided: productVoidRepository(db).voidedByPush, send: liveSendServerEvent, log }, dossier);
  };
}

/** The outbox routes' service, which then tells the App of each item put or settled (PRD 1548 s8), finding the dossier through `dossierOf`. */
export function withOutboxAppTold(service: OutboxItemsService, dossierOf: DossierOf): OutboxItemsService {
  return withOutboxTold(service, { dossierOf, send: liveSendServerEvent, log });
}
