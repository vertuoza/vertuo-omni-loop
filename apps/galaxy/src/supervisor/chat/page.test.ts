import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/app/supervisor' }));

import type { Message } from '../api/supervisor.contract';
import { demoSeat, demoSupervisor } from '../page/demo';
import { queryOf, type SupervisorData } from '../page/model';
import { SupervisorPage } from '../page/SupervisorPage';

// The chat and Memory on the Supervisor page (PRD omni-loop-34 s6), rendered to static markup: an owner's box under
// the general thread and under a finding's, the answer signed Supervisor · agent with the note that shaped it, the
// box's note while the seat is offline, `Memory · <n>` in the header, and none of it for a member (AC-11).

const NOW = '2026-11-25T14:42:00.000Z';
const render = (change: Partial<SupervisorData> = {}, params: Record<string, string> = {}) =>
  renderToStaticMarkup(createElement(SupervisorPage, { view: { kind: 'page', ...demoSupervisor(NOW, change) }, query: queryOf(params), supabase: null, signinError: null }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const message = (change: Partial<Message>): Message => ({ id: 'm', finding: 'f-silent', kind: 'owner', by: 'pierre', body: '', replyTo: null, remembered: null, at: '2026-11-25T14:30:00.000Z', ...change });
const THREAD = [
  message({ id: 'q', body: 'Why is it silent?' }),
  message({ id: 'a', kind: 'supervisor', by: null, body: 'vitest waits on a lock.', replyTo: 'q', remembered: 'atlas-02 locks on vitest', at: '2026-11-25T14:31:00.000Z' }),
];

describe('the chat box on the page', () => {
  it('gives an owner the box under the general thread, with the quick questions (2.B)', () => {
    const html = render({}, { view: 'chat' });
    expect(html).toContain('aria-label="Message to the Supervisor"');
    expect(text(html)).toContain('What is running now? Summarize today');
    expect(text(html)).toContain('Send Acts only when you press.');
    expect(text(html)).not.toContain('Only workspace owners write to the Supervisor.');
  });

  it('answers an owner in the finding\'s thread, signed Supervisor · agent, the remembered note under it', () => {
    const t = text(render({ thread: THREAD }, { finding: 'f-silent' }));
    expect(t).toMatch(/pierre 14:30 Why is it silent\? .*Supervisor · agent 14:31 vitest waits on a lock\. Remembered: “atlas-02 locks on vitest”/);
    expect(t).toContain('Send');
  });

  it('says the message waits while the seat is offline', () => {
    const t = text(render({ seat: demoSeat(NOW, { lastLookAt: '2026-11-25T14:02:00.000Z', missedLooks: 3 }) }, { view: 'chat' }));
    expect(t).toContain('The Supervisor is offline. Your message waits until it looks again.');
  });

  it('gives an owner Memory · <n> beside Token limit and Pause (2.C)', () => {
    expect(text(render())).toContain('Memory · 9 Token limit Pause');
  });

  it('AC-11: draws a member no chat box and no Memory', () => {
    const html = render({ owner: false, thread: THREAD }, { finding: 'f-silent' });
    expect(html).not.toContain('Message to the Supervisor');
    expect(text(html)).not.toContain('Memory ·');
    expect(text(html)).toContain('Only workspace owners write to the Supervisor.');
    expect(text(html)).toContain('Supervisor · agent');
  });
});
