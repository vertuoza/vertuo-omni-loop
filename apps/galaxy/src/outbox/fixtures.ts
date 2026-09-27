// Test data for the Outbox tab (PRD 251): outbox items written as the kit writes them (`omni item new`),
// and a stored outbox as the omni-loop App sends it (apps/omni-app/src/relay/relay.mjs) — two open
// questions (a high decision and a human action), one adopted medium, a pending answer and a settled
// entry. Only the tests and the demo import it.
import type { StoredOutbox } from './contract';
import type { OutboxRow } from './store';

type ItemSpec = {
  id: string;
  rank: 'human-action' | 'high' | 'medium';
  bearsOn?: string;
  question?: string;
  decision?: string;
  intro?: string | null;
  punchline?: string | null;
  options?: string[];
  steps?: string;
};

/** One outbox item's file, as `omni item new` writes it. */
export function itemText({
  id, rank, bearsOn = 'none', question = `The question of ${id}?`, decision = `The decision of ${id}.`,
  intro = `The intro of ${id}.`, punchline = `The punchline of ${id}.`, options, steps,
}: ItemSpec): string {
  const fun = intro && punchline ? ['## The intro, for fun', '', intro, '', '## The punchline, for fun', '', punchline, ''] : [];
  const choice = rank === 'human-action'
    ? ['## What a person must do', '', steps ?? '1. Add the secret to the project.', '']
    : ['## The options, in plain words', '', ...(options ?? [`A. Keep what was built for ${id}.`, `B. Change ${id}.`]), ''];
  return [
    '---', `id: ${id}`, 'prd: 7', `slice: ${id.split('-')[0]}`, `rank: ${rank}`, `bears-on: ${bearsOn}`, 'raised: 2026-09-27', 'wave: 2', '---', '',
    '## The question, in plain words', '', question, '',
    '## The decision, in plain words', '', decision, '',
    ...fun,
    ...choice,
    '## What I had to decide', '', `What ${id} had to decide.`, '',
    '## What I did meanwhile', '', `What ${id} did meanwhile.`, '',
    '## What it costs to change later', '', `What ${id} costs.`, '',
    '## What I could not know', '', `(author) What ${id} could not know.`, '',
  ].join('\n');
}

const SINCE = '2026-09-27T09:00:00.000Z';

export const STORED: StoredOutbox = {
  numbering: [
    { number: 1, id: 's2-01-secret', since: SINCE },
    { number: 2, id: 's1-01-colour', since: SINCE },
    { number: 3, id: 's1-02-size', since: SINCE },
  ],
  open: [
    {
      number: 2, id: 's1-01-colour', rank: 'high',
      text: itemText({
        id: 's1-01-colour', rank: 'high', bearsOn: 'P-PRODUCT-3, ADR-0004',
        question: 'Which colour should a **late** quote be?', decision: 'Red, like every warning.',
        options: ['A. Red, like every warning.', 'B. Orange, softer.', 'C. No colour at all.'],
      }),
    },
    {
      number: 1, id: 's2-01-secret', rank: 'human-action',
      text: itemText({ id: 's2-01-secret', rank: 'human-action', steps: '1. Add `OMNI_OUTBOX_SECRET` to the project.\n2. Redeploy.' }),
    },
  ],
  adopted: [
    { number: 3, id: 's1-02-size', text: itemText({ id: 's1-02-size', rank: 'medium', intro: null, punchline: null }) },
  ],
  pending: [
    {
      number: 2, id: 's1-01-colour', text: 'B because red frightens people', by: 'ada', at: '2026-09-27T09:30:00Z',
      url: 'https://github.com/acme/widgets/pull/12#issuecomment-5', via: 'github',
    },
  ],
  settled: [
    {
      number: null, id: 's1-00-name', verdict: 'agreed', approvedBy: 'ada', approvedAt: '2026-09-26',
      channel: 'feature pull request #12', channelUrl: 'https://github.com/acme/widgets/pull/12#issuecomment-2', answer: 'A. Keep it.',
    },
  ],
};

export function outboxRow(more: Partial<OutboxRow> = {}): OutboxRow {
  return {
    dossier_id: '00000000-0000-4000-8000-0000000000d1', pr_number: 12, pr_url: 'https://github.com/acme/widgets/pull/12',
    head_sha: 'abc1234def', state: 'open', outbox: STORED, evaluated_at: '2026-09-27T10:00:00.000Z', received_at: '2026-09-27T10:00:01.000Z',
    ...more,
  };
}
