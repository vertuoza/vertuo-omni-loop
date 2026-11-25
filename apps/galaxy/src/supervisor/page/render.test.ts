import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/app/supervisor' }));

import { demoFinding, demoSeat, demoSupervisor } from './demo';
import { queryOf, type SupervisorData, type SupervisorPageView } from './model';
import { SupervisorPage } from './SupervisorPage';

// The Supervisor page (PRD omni-loop-34 s5), rendered to static markup against the before/after page's 2.A to 2.G: each
// header state, the list, the finding pane, a member's read-only view and the phone's switch. No database, no GitHub.

const NOW = '2026-11-25T14:42:00.000Z';
const page = (change: Partial<SupervisorData> = {}): SupervisorPageView => ({ kind: 'page', ...demoSupervisor(NOW, change) });
const render = (view: SupervisorPageView, params: Record<string, string> = {}) =>
  renderToStaticMarkup(createElement(SupervisorPage, { view, query: queryOf(params), supabase: null, signinError: null }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1] ?? ''));

describe('the header', () => {
  it('reads Watching with the seat, the last look, the next one and the tokens, and gives an owner Token limit and Pause (2.A)', () => {
    const html = render(page());
    expect(text(html)).toContain('Supervisor Watching seat atlas-01 · slot 4 last look 40 s ago next in 1 min 20 412k tokens today of 5M');
    expect(buttons(html)).toEqual(expect.arrayContaining(['Token limit', 'Pause']));
  });

  it('reads Paused by you, with Resume', () => {
    const html = render(page({ seat: demoSeat(NOW, { paused: true }) }));
    expect(text(html)).toContain('Supervisor Paused by you');
    expect(buttons(html)).toContain('Resume');
  });

  it('AC-7: reads "Thinking paused until midnight: 5M tokens used" past the limit', () => {
    expect(text(render(page({ seat: demoSeat(NOW, { tokensToday: 5_000_000, thinking: false }) })))).toContain('Thinking paused until midnight: 5M tokens used');
  });

  it('reads Offline since its last look, says the checks still run, and gives an owner Move the seat (2.E)', () => {
    const html = render(page({ seat: demoSeat(NOW, { lastLookAt: '2026-11-25T14:02:00.000Z', missedLooks: 3 }), open: [demoFinding(NOW, { lookedAt: null, explanation: null })] }));
    expect(text(html)).toContain('Supervisor Offline since 14:02');
    expect(text(html)).toContain('Offline since 14:02 on atlas-01. Checks still run. Move the seat');
    expect(html).toContain('href="/app/runners"');
  });

  it('says there is no seat yet, an owner sent to the Runners page', () => {
    const html = render(page({ seat: null, runner: null }));
    expect(text(html)).toContain('No Supervisor seat yet. Place it on one of your runners, on the Runners page. Open Runners');
    expect(buttons(html)).not.toContain('Pause');
  });
});

describe('the list', () => {
  it('shows the tabs, the chips, the Chat row, then Needs you now and When you have a minute (2.A)', () => {
    const t = text(render(page()));
    expect(t).toMatch(/Open 4 Done 2/);
    expect(t).toMatch(/All 4 Stuck work 2 Omni Loop bug 1 Runner health 1/);
    expect(t).toMatch(/Chat Ask the Supervisor anything Last: “Fix both: 9 free slots.” \d\d:\d\d Needs you now 2 Stuck work PRD 3232’s job silent for 52 min Silent job · No line for 52 min · 3× the 2.5 min usual 52 min High/);
    expect(t).toContain('When you have a minute 2');
  });

  it('says All quiet with nothing open (2.F)', () => {
    expect(text(render(page({ open: [] })))).toContain('All quiet. Nothing needs you. The Supervisor keeps watching.');
  });

  it('lists Done with how each ended', () => {
    const t = text(render(page(), { tab: 'done' }));
    expect(t).toContain('Done 2 Stuck work box-3 runs an old kit');
    expect(t).toContain('Resolved');
    expect(t).toContain('Not a problem');
  });

  it('links each row to its finding, keeping the chip', () => {
    expect(render(page(), { kind: 'stuck' })).toContain('href="/app/supervisor?kind=stuck&amp;finding=f-silent"');
  });
});

describe('the pane', () => {
  it('shows the general chat with no finding open, each answer signed Supervisor · agent, the note remembered (2.B)', () => {
    const t = text(render(page()));
    expect(t).toContain('General thread · read by every member Chat with the Supervisor');
    expect(t).toMatch(/Supervisor · agent \d\d:\d\d atlas-01 will be short on disk. box-3 needs a kit update. Fix both: 9 free slots. Remembered: “box-3 kit drift”/);
  });

  it('shows the open finding\'s suggestions, then the check that fired and its figures, then the evidence and the thread (2.A)', () => {
    const t = text(render(page(), { finding: 'f-silent' }));
    const order = ['Suggested Stop and resume the job Open Terminal', 'The check that fired Silent job No line for 52 min 3× the 2.5 min usual', 'Evidence Heartbeat fine', 'Supervisor · agent 14:10 Alive, but not moving.'];
    const at = order.map((part) => t.indexOf(part));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('says no check fired for a finding the Supervisor raised alone, and No Supervisor look yet for one the check wrote alone', () => {
    expect(text(render(page(), { finding: 'f-disk' }))).toContain('The check that fired Raised by the Supervisor, no check fired');
    expect(text(render(page({ open: [demoFinding(NOW, { lookedAt: null, explanation: null })] }), { finding: 'f-silent' }))).toContain('No Supervisor look yet.');
  });
});

describe('a member', () => {
  it('AC-11: reads the findings and the chat, and is drawn no suggestion button, chat box, Memory, Pause or Move', () => {
    const view = page({ owner: false, seat: demoSeat(NOW, { lastLookAt: '2026-11-25T14:02:00.000Z', missedLooks: 3 }) });
    const finding = render(view, { finding: 'f-silent' });
    const chat = render(view);
    expect(text(finding)).toContain('PRD 3232’s job silent for 52 min');
    expect(text(finding)).toContain('The check that fired Silent job');
    expect(text(chat)).toContain('Chat with the Supervisor');
    for (const html of [finding, chat]) {
      expect(text(html)).toContain('Read only · owners act');
      expect(text(html)).toContain('Only workspace owners write to the Supervisor.');
      expect(text(html)).not.toMatch(/Suggested|Stop and resume the job|Not a problem|Memory|Pause|Token limit|Move the seat/);
      expect(html).not.toMatch(/<textarea|<form/);
      expect(buttons(html)).toEqual([]);
    }
  });
});

describe('the phone', () => {
  it('switches between Actions · <n> and Chat, the list first (2.G)', () => {
    const list = render(page());
    expect(text(list)).toContain('Actions · 4 Chat');
    expect(list).toContain('data-side="list"');
    expect(render(page(), { view: 'chat' })).toContain('data-side="pane"');
    expect(render(page(), { finding: 'f-silent' })).toContain('data-side="pane"');
  });
});

describe('the gate', () => {
  it('says why the page cannot show', () => {
    expect(text(render({ kind: 'closed' }))).toContain('The Supervisor is not open on this deployment.');
    expect(text(render({ kind: 'unreadable' }))).toContain('could not be read');
    expect(text(render({ kind: 'no-workspace' }))).toContain('The Supervisor page is for the members of a workspace.');
  });
});
