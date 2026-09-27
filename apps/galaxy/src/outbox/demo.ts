// The Outbox tab's demo (PRD 251), for a build without a database in development, as the dossier page
// has its demo: the demo dossier's feature pull request asking a human action and a high decision (with
// an answer typed on GitHub waiting to be settled), one adopted medium and one settled entry, so every
// card and group of the tab shows. Send is off in the demo, and the tab says so.
import { itemText } from './fixtures';
import type { StoredOutbox } from './contract';
import type { OutboxRow } from './store';

const PR = 'https://github.com/vertuoza/vertuo-omni-loop/pull/75';

export function demoOutbox(dossierId: string, now: number): OutboxRow {
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const outbox: StoredOutbox = {
    numbering: [
      { number: 1, id: 's3-01-page-secret', since: iso(90) },
      { number: 2, id: 's2-01-poll-interval', since: iso(90) },
      { number: 3, id: 's2-02-tab-title', since: iso(90) },
    ],
    open: [
      {
        number: 1, id: 's3-01-page-secret', rank: 'human-action',
        text: itemText({
          id: 's3-01-page-secret', rank: 'human-action',
          question: 'Can someone give the ask page the key it signs its links with?',
          decision: 'The page waits for the key: until it is there, a question opens only in the terminal.',
          intro: 'Every door needs a key, and this one is still in someone\'s pocket.',
          punchline: 'The locksmith is on holiday, so it is up to you.',
          steps: '1. Add `ASK_LINK_SECRET` to the page\'s project settings.\n2. Redeploy the page.',
        }),
      },
      {
        number: 2, id: 's2-01-poll-interval', rank: 'high',
        text: itemText({
          id: 's2-01-poll-interval', rank: 'high', bearsOn: 'P-PRODUCT-3',
          question: 'How often should the page look for a new question while its tab is open?',
          decision: 'Every **2 seconds**, and never while the tab is hidden.',
          intro: 'A page that never checks is quiet; one that always checks is loud.',
          punchline: 'Two seconds: long enough to blink, short enough not to miss anything.',
          options: ['A. Every 2 seconds, never while hidden.', 'B. Every 10 seconds, to spare the database.', 'C. Only when the person reloads.'],
        }),
      },
    ],
    adopted: [
      {
        number: 3, id: 's2-02-tab-title',
        text: itemText({
          id: 's2-02-tab-title', rank: 'medium',
          question: 'What should the browser tab say while a question waits?',
          decision: 'It starts with a dot and the number of questions waiting.',
          options: ['A. A dot and the count, like "• 2 questions".', 'B. Leave the title as it is.'],
        }),
      },
    ],
    pending: [
      { number: 2, id: 's2-01-poll-interval', text: 'B because the database is shared', by: 'uma', at: iso(20), url: `${PR}#issuecomment-1`, via: 'github' },
    ],
    settled: [
      {
        number: null, id: 's1-01-terminal-fallback', verdict: 'agreed', approvedBy: 'paula', approvedAt: iso(2 * 24 * 60).slice(0, 10),
        channel: 'feature pull request #75', channelUrl: `${PR}#issuecomment-0`, answer: 'A. The terminal takes over after 5 minutes.',
      },
    ],
  };
  return {
    dossier_id: dossierId, pr_number: 75, pr_url: PR, head_sha: 'a1b2c3d4e5f6', state: 'open', outbox,
    evaluated_at: iso(5), received_at: iso(5),
  };
}
