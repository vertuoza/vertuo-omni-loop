// A synthetic repository for the retro's tests (PRD 72): `acme/widgets`, whose PRD 7 (`widget`) was
// built in three slices over two waves and merged through feature PR #12. Each part can be swapped:
// the config, where the PRD folder sits, the feature PR, its sub-PRs and its issue events. Test
// support only; nothing in the app imports it.
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { z } from 'zod';
import { RETRO_EVENT } from '../src/inngest-client.ts';
import { type Recorded, replayGitHub } from './github-replay.ts';

export const OWNER = 'acme';
export const REPO = 'widgets';
export const MERGE_SHA = 'merge1';
export const MERGED_AT = '2026-09-20T12:00:00Z';

export const CONFIG = 'kit: 1\nrepo:\n  defaultBranch: main\n';

export const SPEC = `---
prd: 7
title: Widgets that remember their colour
blocked-by: none
spec: file
---

# Widgets that remember their colour

## Problem

A widget forgets its colour when the page reloads, so people paint it again.

## Solution

Keep the colour.
`;

export const PLAN = `# Widgets — plan

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The colour is stored | \`src/store/\` | — | 1 |
| s2 | The colour is read back | \`src/read/\` | s1 | 2 |
| s3 | The colour is shown | \`src/show/\` | s1 | 2 |
`;

/** A pull request of the scenario, in the REST shape, as far as the retro reads it. */
export type ScenarioPull = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  merged: boolean;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  labels: { name: string }[];
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
};

type PullOptions = {
  number: number;
  head: string;
  base: string;
  createdAt: string;
  mergedAt: string | null;
  closedAt?: string | null;
  title?: string;
  labels?: readonly string[];
};

const pull = ({ number, head, base, createdAt, mergedAt, closedAt = mergedAt, title = `slice ${head}`, labels = [] }: PullOptions): ScenarioPull => ({
  number,
  title,
  state: closedAt ? 'closed' : 'open',
  draft: false,
  merged: Boolean(mergedAt),
  html_url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
  head: { ref: head, sha: `head${number}` },
  base: { ref: base, sha: `base${number}` },
  labels: labels.map((name) => ({ name })),
  created_at: createdAt,
  closed_at: closedAt,
  merged_at: mergedAt,
  merge_commit_sha: mergedAt ? `m${number}` : null,
});

export const FEATURE: ScenarioPull = {
  ...pull({
    number: 12,
    title: 'feat(widget): widgets remember their colour (PRD 7)',
    head: 'feat/widget',
    base: 'main',
    createdAt: '2026-09-20T09:00:00Z',
    mergedAt: MERGED_AT,
    labels: ['omni:feature'],
  }),
  merge_commit_sha: MERGE_SHA,
};

/** s1 takes 30 minutes; s2 20, s3 120: more than three times the median of 30, so s3 is slow. */
export const SUB_PULLS = [
  pull({ number: 13, head: 'feat/widget--s1', base: 'feat/widget', createdAt: '2026-09-20T09:10:00Z', mergedAt: '2026-09-20T09:40:00Z', labels: ['omni:sub'] }),
  pull({ number: 14, head: 'feat/widget--s2', base: 'feat/widget', createdAt: '2026-09-20T09:45:00Z', mergedAt: '2026-09-20T10:05:00Z', labels: ['omni:sub'] }),
  pull({ number: 15, head: 'feat/widget--s3', base: 'feat/widget', createdAt: '2026-09-20T09:46:00Z', mergedAt: '2026-09-20T11:46:00Z', labels: ['omni:sub'] }),
];

export const FEATURE_EVENTS = [
  { id: 1, event: 'labeled', created_at: '2026-09-20T09:00:05Z', label: { name: 'omni:feature' } },
  { id: 2, event: 'ready_for_review', created_at: '2026-09-20T11:50:00Z' },
];

/** The files of the merge commit: the config, and PRD 7's folder, shipped (or in the inbox). */
export function mergeFiles({ config = CONFIG, state = 'shipped', settled = null }: { config?: string | null; state?: string; settled?: string | null } = {}) {
  const files: Record<string, string> = {};
  if (config !== null) files['.omni-loop/config.yml'] = config;
  const folder = `.omni-loop/delivery/${state}/0007-widget`;
  files[`${folder}/spec.md`] = SPEC;
  files[`${folder}/plan.md`] = PLAN;
  files['.omni-loop/delivery/shipped/0003-older/spec.md'] = '---\nprd: 3\ntitle: Older\n---\n';
  if (settled !== null) {
    files[state === 'shipped' ? `${folder}/outbox/settled.md` : `.omni-loop/delivery/outbox/0007-widget/settled.md`] = settled;
  }
  return files;
}

/** One recorded read of `acme/widgets` for `replayGitHub({ recording })`: its data, or the status GitHub answers instead. */
export const recordedRead = (route: string, params: Record<string, unknown>, data: unknown, status: number | undefined) => ({
  route,
  params: { owner: OWNER, repo: REPO, ...params },
  ...(status ? { status } : { data }),
});

/** What one scenario may change: the merge's files, the feature PR, its sub-PRs, its issue events, the recorded reads. */
export type ScenarioOptions = {
  files?: Record<string, string>;
  feature?: ScenarioPull;
  subPulls?: readonly object[];
  events?: object[] | null;
  recording?: readonly Recorded[];
};

/** The stubbed GitHub and the retro event for one scenario. */
export function widgetScenario({ files = mergeFiles(), feature = FEATURE, subPulls = SUB_PULLS, events = FEATURE_EVENTS, recording = [] }: ScenarioOptions = {}) {
  const github = replayGitHub({
    commits: { [MERGE_SHA]: files },
    pulls: [feature, ...subPulls],
    events: events ? { [feature.number]: events } : {},
    recording,
  });
  return { github, event: retroEvent({ prNumber: parsePr(feature.number), mergeSha: feature.merge_commit_sha ?? MERGE_SHA, mergedAt: feature.merged_at ?? MERGED_AT }) };
}

export function retroEvent(over = {}) {
  return {
    name: RETRO_EVENT,
    data: {
      installationId: 7,
      owner: OWNER,
      repo: REPO,
      repository: `${OWNER}/${REPO}`,
      prNumber: parsePr(12),
      mergeSha: MERGE_SHA,
      mergedAt: MERGED_AT,
      ...over,
    },
  };
}

/** The environment that lets the retro ask its judge: a model key, never sent anywhere (see `judge`). */
export const JUDGE_ENV = Object.freeze({ OPENROUTER_API_KEY: 'test-key' });

/** The lesson and the why `judge` gives each finding: no digit, no refused word. */
export const KEPT_LESSON = 'Keep each slice small enough to merge within the day.';
export const KEPT_WHY = 'Neither the knowledge nor an earlier lesson says this yet.';
export const NOT_KEPT_WHY = 'The knowledge already says this.';

/** The request the retro sends its judge, as far as the stub reads it: the user message is the second. */
const JudgeRequest = z.object({ messages: z.array(z.object({ content: z.string() })) });

/** The judge's input, as far as the stub reads it: the findings it is asked about. */
const JudgeInput = z.object({ findings: z.array(z.object({ id: z.string() })) });

/**
 * A stubbed model for the retro's judge (PRD 487), handed to `createRetro` as its `fetch`: it
 * answers every request with a reply about exactly the findings it was asked about, keeping those
 * `keep(id)` accepts, and says the retro is worth a pull request when `worthIt` and one is kept.
 * Each request's user message is kept in `fetch.asked`, parsed. Nothing reaches OpenRouter.
 * @param {{ worthIt?: boolean, keep?: (id: string) => boolean, reason?: string, summary?: string }} [options]
 */
export function judge({
  worthIt = true,
  keep = () => worthIt,
  reason,
  summary = 'The delivery went as planned, and one slice ran long.',
}: { worthIt?: boolean; keep?: (id: string) => boolean; reason?: string; summary?: string } = {}) {
  const asked: unknown[] = [];
  const answer = (init: RequestInit | undefined): Response => {
    const { messages } = JudgeRequest.parse(JSON.parse(z.string().parse(init?.body)));
    const user = messages[1];
    assertDefined(user, "the judge request's user message");
    const input: unknown = JSON.parse(user.content);
    asked.push(input);
    const ids = JudgeInput.parse(input).findings.map((finding) => finding.id);
    const kept = ids.filter((id) => keep(id));
    const reply = {
      summary,
      findings: Object.fromEntries(
        ids.map((id) => [id, kept.includes(id) ? { lesson: KEPT_LESSON, keep: true, why: KEPT_WHY } : { keep: false, why: NOT_KEPT_WHY }]),
      ),
      lessons: kept.length > 0 ? [{ text: KEPT_LESSON, findings: kept }] : [],
      verdict: {
        worthIt: worthIt && kept.length > 0,
        reason: reason ?? (worthIt && kept.length > 0 ? 'One lesson is new.' : 'Every finding repeats a known pattern.'),
      },
    };
    return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });
  };
  // Settled as an async function settles: a request the stub cannot read rejects the promise, never throws.
  const fetch = (_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((resolve) => {
      resolve(answer(init));
    });
  fetch.asked = asked;
  return fetch;
}

/**
 * The knowledge base and one earlier retro at the merge commit, for the judge to compare with: one
 * product principle, one ADR, and PRD 3's `retro.json` holding one lesson.
 */
export const KNOWLEDGE_FILES = Object.freeze({
  '.omni-loop/knowledge/README.md': '# Knowledge\n',
  '.omni-loop/knowledge/product/principles.md': [
    '# Product principles',
    '',
    '## P-PRODUCT-1',
    '',
    'A widget keeps what a person chose for it.',
    '',
    'Why: nothing is chosen twice.',
    'Decided: @ada, 2026-09-01',
    'Source: spec.md',
    '',
  ].join('\n'),
  '.omni-loop/knowledge/adr/0001-colours-stored-per-widget.md':
    '# ADR-0001 — Colours are stored per widget\n\n**Status:** accepted · **Date:** 2026-09-01\n\n## Context\n\nA widget forgets.\n',
  '.omni-loop/delivery/shipped/0003-older/retro.json': `${JSON.stringify({
    prd: 3,
    runs: [{ run: 'merge', lessons: [{ text: 'Answer decisions before the wave that builds on them.', findings: ['drift:s1-01'] }] }],
  })}\n`,
});
