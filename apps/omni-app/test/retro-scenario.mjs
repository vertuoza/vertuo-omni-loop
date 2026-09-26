// A synthetic repository for the retro's tests (PRD 72): `acme/widgets`, whose PRD 7 (`widget`) was
// built in three slices over two waves and merged through feature PR #12. Each part can be swapped:
// the config, where the PRD folder sits, the feature PR, its sub-PRs and its issue events. Test
// support only; nothing in the app imports it.
import { RETRO_EVENT } from '../src/inngest-client.mjs';
import { replayGitHub } from './github-replay.mjs';

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

const pull = ({ number, head, base, createdAt, mergedAt, closedAt = mergedAt, title = `slice ${head}`, labels = [] }) => ({
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

export const FEATURE = {
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
export function mergeFiles({ config = CONFIG, state = 'shipped', settled = null } = {}) {
  const files = {};
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

/**
 * The stubbed GitHub and the retro event for one scenario.
 * @param {{ files?: Record<string, string>, feature?: object, subPulls?: object[], events?: object[] | null,
 *   recording?: object[] }} [options]
 */
export function widgetScenario({ files = mergeFiles(), feature = FEATURE, subPulls = SUB_PULLS, events = FEATURE_EVENTS, recording = [] } = {}) {
  const github = replayGitHub({
    commits: { [MERGE_SHA]: files },
    pulls: [feature, ...subPulls],
    events: events ? { [feature.number]: events } : {},
    recording,
  });
  return { github, event: retroEvent({ prNumber: feature.number, mergeSha: feature.merge_commit_sha ?? MERGE_SHA, mergedAt: feature.merged_at ?? MERGED_AT }) };
}

export function retroEvent(over = {}) {
  return {
    name: RETRO_EVENT,
    data: {
      installationId: 7,
      owner: OWNER,
      repo: REPO,
      repository: `${OWNER}/${REPO}`,
      prNumber: 12,
      mergeSha: MERGE_SHA,
      mergedAt: MERGED_AT,
      ...over,
    },
  };
}
