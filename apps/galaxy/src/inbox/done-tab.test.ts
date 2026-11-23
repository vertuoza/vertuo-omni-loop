import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({ supabaseEnv: () => ({ url: 'https://db.example', key: 'anon' }) }));

import { InboxDone } from './InboxScreen.done';

// Bug #3167: the Inbox's Done tab (/app/inbox/done, PRD omni-loop-22) draws the Questions history's
// filter form, whose classes live in src/ask/page/history.css and share.css. Only the /ask layout
// imported them, so under the /app layout the form came out unstyled; and the form still sent its
// filters to /ask/history, a redirect away.

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** Every module the Done tab's page is drawn through, from its route to the form itself. */
const DONE_CHAIN = [
  '../../app/app/layout.tsx',
  '../../app/app/inbox/done/page.tsx',
  './InboxScreen.done.tsx',
  '../ask/page/WorkspaceHistory.tsx',
];

const CHOICES = { repos: ['omni-loop/kit'], prds: [3097], skills: ['brainstorm'], askedBy: [], answeredBy: [] };

function done(filters: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(InboxDone, { view: { kind: 'history', items: [], choices: CHOICES, filters }, signinError: null } as never));
}

describe('the Inbox\'s Done tab (bug #3167)', () => {
  it('loads the stylesheets its filter form is drawn with', () => {
    const imports = DONE_CHAIN.map(source).join('\n');
    expect(imports, 'history.css').toMatch(/import\s+['"][^'"]*ask\/page\/history\.css['"]|import\s+['"]\.\/history\.css['"]/);
    expect(imports, 'share.css').toMatch(/import\s+['"][^'"]*ask\/page\/share\.css['"]|import\s+['"]\.\/share\.css['"]/);
  });

  it('sends its filters, and clears them, on its own page', () => {
    const html = done({ repo: 'omni-loop/kit' });
    expect(html).toContain('action="/app/inbox/done"');
    expect(html).toContain('href="/app/inbox/done"');
    expect(html).not.toContain('/ask/history');
  });
});
