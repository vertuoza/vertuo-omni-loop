// The dossier page's demo (PRD 216), for a build without a database in development, as the ask pages
// have theirs: one numbered PRD of the ask demo's workspace, with two versions of its spec (the second
// read from the repository), one of its before/after page and no plan yet, so every state of a tab
// shows. Its viewer is the ask demo's owner, who opened it.
import { DEMO_MEMBERS, DEMO_OWNER } from '../../ask/page/demo';
import type { DossierVersionRow } from '../store';
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
  };
}

/** A demo version's content, or null for one that does not exist. */
export const demoContent = (versionId: string): string | null => CONTENT[versionId] ?? null;

/** Version `number` of the demo's before/after page. */
export function demoSandboxed(number: number): string | null {
  const page = demoDossier(0).versions.filter((v) => v.kind === 'before-after')[number - 1];
  return page ? demoContent(page.id) : null;
}
