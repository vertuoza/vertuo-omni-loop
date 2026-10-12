import type { askClient } from '../ask.client';
import { sendWithShots, trayOf } from './attachments';
import type { AskPort, QuestionPort } from './source';

// What the ask pages write (PRD 1318, s3): answering, deleting, sorting and sharing, through the routes
// the terminal calls (src/ask/ask.client.ts), with the person's sign-in cookie. An answer's screenshots
// (PRD 620), staged in its round's tray by the answer form, go first, one per request, then the answer
// with their paths; a failed upload records nothing, and Send again uploads only what is missing.

/** The browser's client of the ask routes. */
type Client = ReturnType<typeof askClient>;

/** Sends a round's answer from the page, its staged screenshots first. */
function sendFromPage(client: Client, roundId: string, answers: Parameters<Client['answer']>[1]): Promise<'answered' | 'taken'> {
  const tray = trayOf(roundId);
  return sendWithShots(client.bucket(), roundId, tray, (attachments) => client.answer(roundId, answers, attachments), (progress) => {
    tray.setProgress(progress);
  });
}

/** A session page's writes. */
export function sessionWrites(client: Client, sessionId: string): Omit<AskPort, 'read'> {
  return {
    send: (roundId, answers) => sendFromPage(client, roundId, answers),
    remove: () => client.remove(sessionId),
    sort: (roundId, category) => client.sort(roundId, category),
    share: (roundId, member) => client.share(roundId, member),
  };
}

/** A shared round's writes. */
export function questionWrites(client: Client): Omit<QuestionPort, 'read'> {
  return {
    send: (roundId, answers) => sendFromPage(client, roundId, answers),
    sort: (roundId, category) => client.sort(roundId, category),
  };
}
