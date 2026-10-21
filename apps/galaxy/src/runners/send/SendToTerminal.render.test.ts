import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Job } from '../runners.contract';
import { SendToTerminal, SendToTerminalScope, SendToTerminalView, sendTo, type SendState } from './SendToTerminal';
import type { SendSetup } from './targets';

// Send to terminal (PRD 1830 s4), as the server renders it: hidden with no runner and for a line a
// runner does not run, the picker listing only the targets it is given with Send its one primary
// action, then `Queued for <target>` with a link to the job, or the route's refusal in the same place.

const RUNNER = '00000000-0000-4000-8000-000001830401';
const SETUP: SendSetup = {
  repo: 'demo-org/app',
  options: [
    { key: 'any', group: 'any', label: 'Any runner', state: null, target: { kind: 'any' } },
    { key: 'fleet:cyan', group: 'fleet', label: 'cyan', state: '1 online', target: { kind: 'fleet', fleet: 'cyan' } },
    { key: `runner:${RUNNER}`, group: 'runner', label: 'nimbus-agents', state: 'Busy', target: { kind: 'runner', runner: RUNNER } },
  ],
};
const JOB: Job = {
  id: '00000000-0000-4000-8000-000001830201', line: '/omni:yolo 1717', repo: 'demo-org/app', toRunner: null, toFleet: 'cyan',
  sentBy: '00000000-0000-4000-8000-0000018300b1', sentByLogin: 'mo', sentByKey: null, status: 'queued', runner: null, cancelRequested: false,
  logTail: '', prUrl: null, exitCode: null, reason: null, queuedAt: '2026-10-13T12:00:00.000Z', claimedAt: null, runningAt: null, endedAt: null,
};

const none = () => undefined;
const view = (state: SendState, setup: SendSetup | null = SETUP, line = '/omni:yolo 1717') =>
  renderToStaticMarkup(createElement(SendToTerminalView, { line, setup, state, name: 'send-1', onToggle: none, onChoose: none, onSend: none }));

function fetcher(status: number, body: unknown) {
  const calls: { url: string; body: unknown }[] = [];
  const fake = (url: string, init?: RequestInit) => {
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null });
    return Promise.resolve(Response.json(body, { status }));
  };
  return { fake: fake as unknown as typeof fetch, calls };
}

describe('Send to terminal', () => {
  it('is not drawn when the viewer has no runner to send to', () => {
    expect(view({ kind: 'closed' }, null)).toBe('');
    expect(view({ kind: 'closed' }, { ...SETUP, options: [] })).toBe('');
  });

  it('is not drawn for a line whose skill a runner does not run', () => {
    expect(view({ kind: 'closed' }, SETUP, '/omni:brainstorm --rework 1717')).toBe('');
    expect(view({ kind: 'closed' }, SETUP, '/omni:drive')).toBe('');
  });

  it('shows the button alone while closed', () => {
    const html = view({ kind: 'closed' });
    expect(html).toContain('<button type="button" class="ask-button quiet" aria-expanded="false">Send to terminal</button>');
    expect(html).not.toContain('role="group"');
  });

  it('lists the targets it is given, in groups, the chosen one checked, with Send its one primary action', () => {
    const html = view({ kind: 'open', choice: 'fleet:cyan', sending: false });
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('<div class="send-pick" role="group" aria-label="Send to terminal">');
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toContain('Any runner');
    expect(html.indexOf('Any runner')).toBeLessThan(html.indexOf('>Fleets<'));
    expect(html.indexOf('>Fleets<')).toBeLessThan(html.indexOf('>cyan'));
    expect(html.indexOf('>cyan')).toBeLessThan(html.indexOf('>Runners<'));
    expect(html).toContain('checked="" value="fleet:cyan"');
    expect(html).toContain('nimbus-agents <span class="send-state">Busy</span>');
    expect(html.match(/data-primary/g)).toHaveLength(1);
    expect(html).toContain('<button type="button" class="ask-button stage-action" data-primary="true">Send</button>');
  });

  it('leaves out a group with no target', () => {
    const html = view({ kind: 'open', choice: 'any', sending: false }, { ...SETUP, options: SETUP.options.slice(0, 1) });
    expect(html).not.toContain('Fleets');
    expect(html).not.toContain('Runners');
  });

  it('holds Send while it sends', () => {
    expect(view({ kind: 'open', choice: 'any', sending: true })).toContain('data-primary="true" disabled="">Sending…</button>');
  });

  it('says where the job was queued, with a link to it, once sent', () => {
    const html = view({ kind: 'queued', words: 'Queued for cyan', href: `/app/runners#job-${JOB.id}` });
    expect(html).toContain(`<span class="ask-hint" role="status">Queued for cyan · <a href="/app/runners#job-${JOB.id}">View job</a></span>`);
    expect(html).not.toContain('role="group"');
  });

  it('shows the route\'s refusal in the same place', () => {
    const html = view({ kind: 'refused', error: 'Only the players of cyan and the workspace\'s owners send to its runners.' });
    expect(html).toContain('<span class="ask-problem" role="alert">Only the players of cyan and the workspace&#x27;s owners send to its runners.</span>');
  });

  it('sends the line for the page\'s repository to the chosen target, and reads back where it went', async () => {
    const { fake, calls } = fetcher(200, { job: JOB });
    expect(await sendTo('/omni:yolo 1717', SETUP, 'fleet:cyan', fake)).toEqual({ kind: 'queued', words: 'Queued for cyan', href: `/app/runners#job-${JOB.id}` });
    expect(calls).toEqual([{ url: '/api/runners/jobs', body: { line: '/omni:yolo 1717', repo: 'demo-org/app', target: { kind: 'fleet', fleet: 'cyan' } } }]);
  });

  it('gives the route\'s words when it refuses, and refuses a choice that is not listed', async () => {
    const { fake } = fetcher(403, { error: 'demo-org/app is not in your workspace.' });
    expect(await sendTo('/omni:yolo 1717', SETUP, 'any', fake)).toEqual({ kind: 'refused', error: 'demo-org/app is not in your workspace.' });
    const unused = fetcher(200, { job: JOB });
    expect(await sendTo('/omni:yolo 1717', SETUP, 'fleet:red', unused.fake)).toEqual({ kind: 'refused', error: 'Pick where to send it.' });
    expect(unused.calls).toEqual([]);
  });

  it('shows on a page that gives it runners, and nowhere else', () => {
    const line = '/omni:pr-care 1801';
    expect(renderToStaticMarkup(createElement(SendToTerminal, { line }))).toBe('');
    expect(renderToStaticMarkup(createElement(SendToTerminalScope, { setup: SETUP, children: createElement(SendToTerminal, { line }) }))).toContain('>Send to terminal</button>');
    expect(renderToStaticMarkup(createElement(SendToTerminalScope, { setup: null, children: createElement(SendToTerminal, { line }) }))).toBe('');
  });
});
