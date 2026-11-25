import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { Proposal } from '../api/supervisor.contract';
import { demoFinding } from '../page/demo';
import { choicesOf, hrefOf } from './choices';
import { dismissFinding, pressSuggestion } from './proposals.client';
import { Suggested } from './Suggested';

// The Suggested box (PRD omni-loop-34 s7, the before/after page's 2.A), rendered to static markup: the suggestions as
// buttons, the first the primary one, a link for Open Terminal, Not a problem; a pressed suggestion reads how it ended.
// The client's calls with a stubbed fetch. No database, no GitHub.

const NOW = '2026-11-25T14:42:00.000Z';
const JOB = '00000000-0000-4000-8000-0000000000e1';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const proposal = (change: Partial<Proposal>): Proposal => ({ id: 'x', kind: 'suggestion', action: null, label: null, target: null, replyTo: null, by: null, outcome: null, note: null, at: NOW, ...change });

describe('the Suggested box', () => {
  it('draws the suggestions in order, the first primary, Open Terminal as a link, then Not a problem (2.A)', () => {
    const html = renderToStaticMarkup(createElement(Suggested, { workspace: 'w', finding: demoFinding(NOW) }));
    expect(text(html)).toBe('Suggested Stop and resume the job Open Terminal Not a problem');
    expect(html).toMatch(/<button[^>]*data-primary[^>]*>Stop and resume the job<\/button>/);
    expect(html).toContain('href="/app/runners"');
  });

  it('reads a pressed suggestion as how it ended, and never offers it again', () => {
    const finding = demoFinding(NOW, { proposals: [
      proposal({ id: 's1', action: 'stop-resume-job', label: 'Stop and resume the job', target: { job: JOB } }),
      proposal({ id: 'p1', kind: 'press', replyTo: 's1', by: 'olga' }),
      proposal({ id: 'r1', kind: 'result', replyTo: 'p1', outcome: 'refused', note: 'Its automatic resume is already queued' }),
    ] });
    expect(choicesOf(finding)).toEqual([{ kind: 'pressed', id: 's1', label: 'Stop and resume the job', words: 'Refused: Its automatic resume is already queued' }]);
    const waiting = demoFinding(NOW, { proposals: [proposal({ id: 's1', action: 'pause-mission', label: 'Pause the mission', target: {} }), proposal({ id: 'p1', kind: 'press', replyTo: 's1', by: 'olga' })] });
    expect(choicesOf(waiting)[0]).toMatchObject({ kind: 'pressed', words: 'Pressed by olga' });
  });

  it('links a job\'s Terminal and a mission\'s room by their targets', () => {
    expect(hrefOf('open-terminal', { job: JOB })).toBe(`/app/runners?terminal=${JOB}#job-${JOB}`);
    expect(hrefOf('open-mission', { mission: JOB, fleet: 'blue fleet' })).toBe(`/app/ai-fleet?fleet=blue%20fleet&tab=room&mission=${JOB}`);
    expect(hrefOf('open-mission', {})).toBe('/app/ai-fleet');
  });
});

describe('the calls', () => {
  it('presses through POST /api/supervisor/proposals and says a refusal in its words', async () => {
    const calls: { url: string; body: string }[] = [];
    const pressed = { proposal: 's1', action: 'copy-kit-update', outcome: 'done', note: 'To update its kit, run on atlas-01: omni update', by: 'olga', finding: { id: 'f', state: 'acted' }, steps: 'omni update' };
    const fetcher = ((url: string, init: RequestInit) => { calls.push({ url, body: typeof init.body === 'string' ? init.body : '' }); return Promise.resolve(Response.json({ press: pressed })); }) as typeof fetch;
    expect(await pressSuggestion('w', 's1', fetcher)).toEqual({ ok: true, value: pressed });
    expect(calls).toEqual([{ url: '/api/supervisor/proposals', body: '{"workspace":"w","proposal":"s1"}' }]);
    const refusing = (() => Promise.resolve(Response.json({ error: 'Only a workspace owner acts on the Supervisor\'s suggestions.' }, { status: 403 }))) as typeof fetch;
    expect(await dismissFinding('w', 'f', refusing)).toEqual({ ok: false, error: 'Only a workspace owner acts on the Supervisor\'s suggestions.' });
  });
});
