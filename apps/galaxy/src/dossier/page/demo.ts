// The dossier page's demo (PRD 216), for a build without a database in development, as the ask pages
// have theirs: one numbered PRD of the ask demo's workspace, with two versions of its spec (the second
// read from the repository), one of its before/after page and no plan yet, so every state of a tab
// shows; and the questions that shaped it, three asked by its brainstorm and two while it was
// delivered, answered on the page, in the terminal, or not at all. Its viewer is the ask demo's owner,
// who opened it. Its planet has regions in two more repositories, so it shows three chips.
//
// The history's demo (/prd, step 4): that dossier as dossier_list() would list it, a draft whose
// brainstorm asked a question in another repository, and a PRD the page read from the repository, so
// every filter has something to keep and something to leave out.
//
// Its outbox (PRD 251) is src/outbox/demo.ts's: two open questions, one adopted, one settled.
import { DEMO_MEMBERS, DEMO_OWNER } from '../../ask/page/demo';
import { demoOutbox } from '../../outbox/demo';
import { openCount } from '../../outbox/count';
import { DOSSIER_KINDS, type DossierListRow, type DossierRoundRow, type DossierVersionRow, type LatestVersion } from '../store';
import type { DossierRead } from './view';

export const DEMO_DOSSIER_ID = '00000000-0000-4000-8000-00000000d055';
export const DEMO_VIEWER = DEMO_OWNER;

const MIN = 60_000;
const iso = (at: number) => new Date(at).toISOString();

const SPEC_V1 = `---
prd: 71
title: Ask mode — Claude's questions on a page made for reading
spec: file
---

# Ask mode

Claude asks its questions on a page the person reads and answers, a tab per terminal.

## Solution

- The page polls every 2 s while its tab is visible.
- The terminal takes over when the page does not answer in time.
`;

const SPEC_V2 = `${SPEC_V1}
## Decisions

| # | Decision |
| --- | --- |
| 1 | The page reads as the signed-in person, so row-level security decides. |
| 2 | Raw HTML in a question shows as text: <b>like this</b>. |
`;

const PAGE_V1 = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Ask mode · before / after</title>
<style>
  body { margin: 0; padding: 32px; font: 17px/1.6 system-ui, sans-serif; background: #f5f4fc; color: #17153d; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .side { padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #d9d6ee; }
  b { color: #6a2fd0; }
</style>
<h1>Ask mode</h1>
<div class="pair">
  <div class="side"><b>Today</b><p>Claude's questions wait in the terminal.</p></div>
  <div class="side"><b>After</b><p>They open on a page, a tab per terminal.</p></div>
</div>
<p id="sandbox"></p>
<script>
  // Shows the page runs in its sandbox: no cookies of the galaxy's reach it.
  var cookies = 'unreadable';
  try { cookies = document.cookie === '' ? 'none' : 'some'; } catch (e) {}
  document.getElementById('sandbox').textContent = 'Cookies this page can read: ' + cookies + '.';
</script>
</html>
`;

/** Every version's content, by version id. */
const CONTENT: Record<string, string> = { 'demo-spec-1': SPEC_V1, 'demo-spec-2': SPEC_V2, 'demo-page-1': PAGE_V1 };

const [PAULA, UMA] = [DEMO_MEMBERS[1].user_id, DEMO_MEMBERS[2].user_id];

const MODE = {
  question: 'How should the questions reach the page?', header: 'Mode', multiSelect: false,
  options: [
    { label: 'Hook mode + nudge (Recommended)', description: 'A PreToolUse hook sends every AskUserQuestion.' },
    { label: 'An instruction to the model', description: 'Each skill is told to call a tool of its own.' },
  ],
};
const HOST = {
  question: 'Where should the page live?', header: 'Host', multiSelect: false,
  options: [
    { label: 'The galaxy app', description: 'It already has the crew\'s Google sign-in.' },
    { label: 'A project of its own', description: 'One more deployment to keep.' },
  ],
};
const CHECKS = {
  question: 'Which checks should gate the slice?', header: 'Checks', multiSelect: true,
  options: [
    { label: 'Row-level security', description: 'Two accounts\' tokens against the migration.' },
    { label: 'Handler tests', description: 'The API as functions, with a stubbed client.' },
    { label: 'A live session', description: 'A real Claude Code session answered from the page.' },
  ],
};
const UPDATES = {
  question: 'Should the page poll, or listen for changes?', header: 'Updates', multiSelect: false,
  options: [
    { label: 'Poll every 2 s (Recommended)', description: 'No new service; cheap at the crew\'s volume.' },
    { label: 'Supabase Realtime', description: 'Instant, but one more moving part.' },
  ],
};
const THEME = {
  question: 'Which theme should a first visit get?', header: 'Theme', multiSelect: false,
  options: [
    { label: 'The system\'s (Recommended)', description: 'Light or dark, as the device is set.' },
    { label: 'Always dark', description: 'Like the arcade.' },
  ],
};

/** The demo's rounds: its brainstorm's, in the hour after it opened, then two of its delivery. */
function demoRounds(opened: number): DossierRoundRow[] {
  const round = (n: number, question: typeof MODE, at: number, more: Partial<DossierRoundRow> = {}): DossierRoundRow => ({
    rule: 'brainstorm', round_id: `demo-dossier-round-${n}`, session_id: 'demo-terminal-1', asked_by: DEMO_OWNER,
    repo: 'vertuoza/vertuo-omni-loop', branch: 'main', questions: [question], answers: null, status: 'open', answered_via: null,
    answered_by: null, category: null, category_by: null, prd: null, skill: '/omni:brainstorm', created_at: iso(at), answered_at: null, ...more,
  });
  const answered = (question: typeof MODE, answer: string, by: string, via: 'page' | 'terminal', at: number) => ({
    status: 'answered' as const, answers: { [question.question]: answer }, answered_by: by, answered_via: via, answered_at: iso(at),
  });
  const delivery = { rule: 'delivery' as const, prd: 71, branch: 'feat/ask-mode--s2', skill: '/omni:do-work', session_id: 'demo-terminal-2' };
  return [
    round(1, MODE, opened + 5 * MIN, { ...answered(MODE, MODE.options[0].label, PAULA, 'page', opened + 7 * MIN + 10_000), category: 'architecture', category_by: 'model' }),
    round(2, HOST, opened + 12 * MIN, { ...answered(HOST, HOST.options[0].label, DEMO_OWNER, 'terminal', opened + 12 * MIN + 40_000), category: 'product', category_by: DEMO_OWNER }),
    round(3, CHECKS, opened + 30 * MIN, { ...answered(CHECKS, 'Row-level security, Handler tests', UMA, 'page', opened + 36 * MIN), category: 'harness', category_by: 'model' }),
    round(4, UPDATES, opened + 2 * 24 * 60 * MIN, {
      ...delivery, ...answered(UPDATES, UPDATES.options[0].label, DEMO_OWNER, 'terminal', opened + 2 * 24 * 60 * MIN + 3 * MIN), category: 'architecture', category_by: 'model',
    }),
    round(5, THEME, opened + 2 * 24 * 60 * MIN + 40 * MIN, { ...delivery, status: 'abandoned' }),
  ];
}

/** The demo dossier's repositories: its home, then its planet's regions. */
const DEMO_REPOS = ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-core', 'vertuoza/vertuo-web'];

export function demoDossier(now: number): DossierRead {
  const opened = now - 3 * 24 * 60 * MIN;
  const version = (id: string, kind: DossierVersionRow['kind'], at: number, more: Partial<DossierVersionRow> = {}): DossierVersionRow => ({
    id, dossier_id: DEMO_DOSSIER_ID, kind, bytes: new TextEncoder().encode(CONTENT[id]).length, source: 'kit',
    uploaded_by: DEMO_OWNER, commit_sha: null, created_at: iso(at), ...more,
  });
  return {
    dossier: {
      id: DEMO_DOSSIER_ID, workspace_id: 'demo', home_repo: 'vertuoza/vertuo-omni-loop', prd: 71,
      title: 'Ask mode — Claude\'s questions on a page made for reading', opened_by: DEMO_OWNER,
      created_at: iso(opened), numbered_at: iso(opened + 90 * MIN),
    },
    versions: [
      version('demo-spec-1', 'spec', opened + 90 * MIN),
      version('demo-page-1', 'before-after', opened + 91 * MIN),
      version('demo-spec-2', 'spec', opened + 2 * 24 * 60 * MIN, { source: 'github', uploaded_by: null, commit_sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' }),
    ],
    members: DEMO_MEMBERS,
    rounds: demoRounds(opened),
    repos: DEMO_REPOS,
    outbox: { row: demoOutbox(DEMO_DOSSIER_ID, now) },
  };
}

/** A dossier the page read, as dossier_list() lists it. */
function listed({ dossier, versions, rounds, repos, outbox }: DossierRead): DossierListRow {
  const latest: Partial<Record<(typeof DOSSIER_KINDS)[number], LatestVersion>> = {};
  for (const kind of DOSSIER_KINDS) {
    const ofKind = versions.filter((v) => v.kind === kind);
    const last = ofKind.at(-1);
    if (last) latest[kind] = { id: last.id, version: ofKind.length, source: last.source, created_at: last.created_at };
  }
  const asked = rounds ?? [];
  const times = [dossier.created_at, dossier.numbered_at, ...versions.map((v) => v.created_at), ...asked.flatMap((r) => [r.created_at, r.answered_at])]
    .filter((t): t is string => t !== null);
  return {
    ...dossier,
    repos: repos ?? [dossier.home_repo],
    latest,
    asked: asked.length,
    answered: asked.filter((r) => r.status === 'answered').length,
    last_activity: iso(Math.max(...times.map((t) => Date.parse(t)))),
    open_questions: outbox ? openCount(outbox) : 0,
  };
}

/** The history's demo rows, as dossier_list() gives them. */
export function demoHistory(now: number): DossierListRow[] {
  const at = (minutesAgo: number) => iso(now - minutesAgo * MIN);
  const read = 'github' as const;
  return [
    listed(demoDossier(now)),
    {
      id: '00000000-0000-4000-8000-00000000d056', workspace_id: 'demo', home_repo: 'vertuoza/vertuo-omni-loop', prd: null,
      title: 'Offline quotes on the site app', opened_by: DEMO_OWNER, created_at: at(3 * 60), numbered_at: null,
      repos: ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-mobile'], latest: {}, asked: 3, answered: 2, last_activity: at(2 * 60),
    },
    {
      id: '00000000-0000-4000-8000-00000000d057', workspace_id: 'demo', home_repo: 'vertuoza/vertuo-omni-loop', prd: 144,
      title: 'Question history — every question kept, sorted and shareable', opened_by: null,
      created_at: at(9 * 24 * 60), numbered_at: at(9 * 24 * 60),
      repos: ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-ai-domain'],
      latest: {
        spec: { id: 'demo-144-spec-2', version: 2, source: read, created_at: at(6 * 24 * 60) },
        plan: { id: 'demo-144-plan-1', version: 1, source: read, created_at: at(9 * 24 * 60) },
        'before-after': { id: 'demo-144-page-1', version: 1, source: read, created_at: at(9 * 24 * 60) },
      },
      asked: 4, answered: 4, last_activity: at(6 * 24 * 60),
    },
  ];
}

/** A demo version's content, or null for one that does not exist. */
export const demoContent = (versionId: string): string | null => CONTENT[versionId] ?? null;

/** Version `number` of the demo's before/after page. */
export function demoSandboxed(number: number): string | null {
  const page = demoDossier(0).versions.filter((v) => v.kind === 'before-after')[number - 1];
  return page ? demoContent(page.id) : null;
}
