// @ts-nocheck
// A synthetic repository for the knowledge harvest's tests (PRD 82): `acme/widgets`, whose PRD 42
// (`widgets`) was merged through feature PR #43 by @octocat over a red outbox — a high item and a
// human-action item still open, and the PRD still in `inbox/`. Its ledger already holds four settled
// decisions. A second PRD, 44 (`gadgets`), merged through #45, lets two harvests run one after the
// other. The model is a fake OpenRouter answering each decision from `REPLIES`. Test support only;
// nothing in the app imports it.
import { makeMarkers } from 'vertuo-omni-plan/kit/lib/markers.ts';
import { parseOutboxItem } from 'vertuo-omni-plan/kit/lib/outbox/outbox.ts';
import { renderAdoptedEntry, renderSettledEntry, settledHeader } from 'vertuo-omni-plan/kit/lib/outbox/settle.ts';
import { vi } from 'vitest';
import { HARVEST_EVENT } from '../src/inngest-client.ts';
import { replayGitHub } from './github-replay.ts';

export const OWNER = 'acme';
export const REPO = 'widgets';
export const TIP = 'tip1';
export const MERGE_SHA = 'merge43';
export const MERGED_AT = '2026-09-26T10:30:00Z';
export const MERGER = 'octocat';
export const KEY = 'test-key-not-a-secret';

export const K = '.omni-loop/knowledge';
export const D = '.omni-loop/delivery';
export const INBOX = `${D}/inbox/0042-widgets`;
export const OUTBOX = `${D}/outbox/0042-widgets`;
export const SHIPPED = `${D}/shipped/0042-widgets`;
export const LEDGER = `${SHIPPED}/outbox/settled.md`;

const markers = makeMarkers('omni-outbox');

export function itemText({ id, prd = 42, rank, slice = 's1', personSteps = false }) {
  const last = personSteps
    ? ['## What a person must do', '', '1. Set the secret in the console.', '']
    : ['## The options, in plain words', '', 'A. Keep what was built.', 'B. Change it.', ''];
  return [
    '---',
    `id: ${id}`,
    `prd: ${prd}`,
    `slice: ${slice}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-24',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    `Should ${id} ship as it is?`,
    '',
    '## The decision, in plain words',
    '',
    'Yes, this is the fixture answer.',
    '',
    ...last,
    '## What I had to decide',
    '',
    `How ${id} is built.`,
    '',
    '## What I did meanwhile',
    '',
    'Built the simple way.',
    '',
    '## What it costs to change later',
    '',
    'One constant.',
    '',
    '## What I could not know',
    '',
    '(author) Nothing settles it.',
    '',
  ].join('\n');
}

function adopted(id, prd = 42) {
  const text = itemText({ id, prd, rank: 'medium', slice: 's0' });
  return renderAdoptedEntry({ item: parseOutboxItem(text).item, itemText: text, markers });
}

function drifted(id) {
  const text = itemText({ id, rank: 'high', slice: 's0' });
  return renderSettledEntry({
    item: parseOutboxItem(text).item,
    itemText: text,
    answer: {
      text: 'No, build it the other way.',
      approvedBy: '@ada',
      approvedAt: '2026-09-25T10:00:00Z',
      channel: { kind: 'feature-pull-request', number: 43 },
    },
    judgement: { verdict: 'drifted', basis: 'stated', reason: 'a human said so' },
    markers,
  });
}

const header = (prd) => settledHeader(prd, { ctx: { config: { paths: { delivery: D } } } });

export const LEDGER_TEXT = [header(42), adopted('s0-01-local-name'), adopted('s0-02-cited'), adopted('s0-03-refused'), drifted('s0-04-drift')].join('\n');

const GADGETS = `${D}/shipped/0044-gadgets`;

/** The default branch's files: config, the knowledge base, PRD 42 in the inbox, PRD 44 shipped. */
export const FILES = {
  '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n',
  [`${K}/README.md`]: '# Knowledge\n',
  [`${K}/product/principles.md`]: [
    '# Product principles',
    '',
    '## P-PRODUCT-1',
    '',
    'A person reviews every change before it reaches the default branch.',
    '',
    'Why: nothing merges unseen.',
    'Decided: @ada, 2026-09-01',
    'Source: PRD #3',
    '',
  ].join('\n'),
  [`${K}/product/rules.md`]: '# Product rules\n\nNone yet.\n',
  [`${K}/product/invariants.md`]: '# Product invariants\n\nNone yet.\n',
  [`${K}/adr/README.md`]: '# Decisions\n',
  [`${K}/adr/0001-outbox-check-as-app.md`]: '# ADR-0001 — The outbox check runs as an app\n\nBody.\n',
  [`${INBOX}/spec.md`]: '---\nprd: 42\ntitle: Widgets that remember\n---\n\n# Widgets that remember\n\n## Problem\n\nThey forget.\n',
  [`${INBOX}/plan.md`]: `# Plan\n\nThe spec: \`${INBOX}/spec.md\`. The outbox: \`${OUTBOX}\`.\n`,
  [`${OUTBOX}/settled.md`]: LEDGER_TEXT,
  [`${OUTBOX}/s1-01-high-one.md`]: itemText({ id: 's1-01-high-one', rank: 'high' }),
  [`${OUTBOX}/s1-02-set-secret.md`]: itemText({ id: 's1-02-set-secret', rank: 'human-action', personSteps: true }),
  [`${GADGETS}/spec.md`]: '---\nprd: 44\ntitle: Gadgets\n---\n\n# Gadgets\n',
  [`${GADGETS}/outbox/settled.md`]: [header(44), adopted('s1-01-gadget-record', 44), adopted('s1-02-gadget-rule', 44)].join('\n'),
};

/** What the fake model answers for each decision. */
export const REPLIES = {
  's1-01-high-one': { kind: 'adr', title: 'Widgets are built the simple way', statement: 'Widgets are built the simple way.', reason: 'how it is built' },
  's1-02-set-secret': {
    kind: 'rule',
    place: 'product',
    statement: 'A secret is set in the console, never in the repository.',
    serves: 'new',
    principle: { statement: 'Secrets never live in the repository.', why: 'a leaked file leaks the secret.' },
    reason: 'a provable rule with no principle yet',
  },
  's0-01-local-name': { kind: 'stays-here', statement: 'A local naming choice.', reason: 'a local choice, nothing lasting' },
  's0-02-cited': { kind: 'invariant', place: 'product', statement: 'This holds as BR-GHOST-9 says.', reason: 'must always hold' },
  's0-03-refused': { kind: 'nonsense', reason: 'wrong' },
  's0-04-drift': { kind: 'covered', covers: 'ADR-0001', reason: 'the record says it' },
  's1-01-gadget-record': { kind: 'adr', title: 'Gadgets are numbered', statement: 'Gadgets are numbered.', reason: 'how gadgets work' },
  's1-02-gadget-rule': { kind: 'rule', place: 'product', statement: 'A gadget has one owner.', serves: 'P-PRODUCT-1', reason: 'a product rule' },
};

/** A fake OpenRouter: the reply the prompt's decision id is given, from `replies`. */
export function fakeFetch(replies = REPLIES) {
  return vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    const user = body.messages.find((m) => m.role === 'user').content;
    const id = /^## The decision: (\S+)$/m.exec(user)[1];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replies[id]) } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

const pull = ({ number, head, base = 'main', mergedAt = MERGED_AT, mergedBy = MERGER, mergeSha = MERGE_SHA, title = `PR ${number}` }) => ({
  number,
  title,
  state: 'closed',
  draft: false,
  merged: Boolean(mergedAt),
  html_url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
  head: { ref: head, sha: `head${number}` },
  base: { ref: base, sha: `base${number}` },
  labels: [],
  created_at: '2026-09-25T09:00:00Z',
  closed_at: mergedAt ?? '2026-09-26T09:00:00Z',
  merged_at: mergedAt,
  merged_by: mergedAt ? { login: mergedBy } : null,
  merge_commit_sha: mergedAt ? mergeSha : null,
});

/** PRD 42's feature PR, merged over red. */
export const FEATURE = pull({ number: 43, head: 'feat/widgets', title: 'feat(widgets): widgets that remember (PRD 42)' });
/** PRD 44's feature PR, merged too. */
export const GADGETS_FEATURE = pull({ number: 45, head: 'feat/gadgets', mergeSha: MERGE_SHA, title: 'feat(gadgets): gadgets (PRD 44)' });

/** Pull requests that must never start a harvest, each merged (but one) with its own number. */
export const NOT_HARVESTED = {
  'a merged sub-PR': pull({ number: 50, head: 'feat/widgets--s1', base: 'feat/widgets' }),
  'a merged phase-0 PR': pull({ number: 51, head: 'docs/phase-0-widgets' }),
  'a closed, unmerged feature PR': pull({ number: 52, head: 'feat/widgets', mergedAt: null }),
  'a merged knowledge PR': pull({ number: 53, head: 'docs/knowledge-widgets' }),
  'a merged retro PR': pull({ number: 54, head: 'docs/retro-widgets' }),
};

/**
 * The stubbed GitHub: the merge commit and the default branch's tip hold `files`; `heads/main`
 * points at the tip.
 */
export function harvestScenario({ files = FILES, pulls = [FEATURE, GADGETS_FEATURE, ...Object.values(NOT_HARVESTED)] } = {}) {
  const github = replayGitHub({ commits: { [MERGE_SHA]: files, [TIP]: files }, pulls });
  github.state.refs.set('heads/main', TIP);
  return github;
}

export function harvestEvent(prNumber = FEATURE.number) {
  return {
    name: HARVEST_EVENT,
    data: { installationId: 7, owner: OWNER, repo: REPO, repository: `${OWNER}/${REPO}`, prNumber },
  };
}
