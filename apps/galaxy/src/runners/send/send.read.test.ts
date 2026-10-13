import { describe, expect, it } from 'vitest';
import type { Board } from '../runners.contract';
import { sendSetupOf } from './send.read';

// What Send to terminal reads on a page (PRD 1830 s4): the picker's choices for the page's repository,
// or nothing — so the button stays hidden — with no runners here, a refused or failed read, or no runner
// the viewer may use.

const VIEWER = { id: '00000000-0000-4000-8000-0000018300b1', owner: false, fleet: null };
const RUNNER: Board['runners'][number] = {
  id: '00000000-0000-4000-8000-000001830401', name: 'mac-mini', owner: '00000000-0000-4000-8000-0000018300a1', fleet: null, slots: 2, used: 0,
  repos: ['vertuoza/app'], version: '0.0.389', lastSeenAt: '2026-10-13T12:00:00.000Z', state: 'online',
};
const answering = (runners: Board['runners']) => () => Promise.resolve({ ok: true as const, value: { runners, viewer: VIEWER } });
const quiet = () => undefined;

describe('Send to terminal\'s read', () => {
  it('gives the page\'s repository and the viewer\'s choices', async () => {
    const setup = await sendSetupOf(answering([RUNNER]), VIEWER.id, 'w1', 'vertuoza/app', quiet);
    expect(setup?.repo).toBe('vertuoza/app');
    expect(setup?.options.map((o) => o.label)).toEqual(['Any runner', 'mac-mini']);
  });

  it('hides the button with no runners here, no runner of the viewer\'s, or a refused read', async () => {
    expect(await sendSetupOf(null, VIEWER.id, 'w1', 'vertuoza/app', quiet)).toBeNull();
    expect(await sendSetupOf(answering([]), VIEWER.id, 'w1', 'vertuoza/app', quiet)).toBeNull();
    expect(await sendSetupOf(answering([{ ...RUNNER, fleet: 'red' }]), VIEWER.id, 'w1', 'vertuoza/app', quiet)).toBeNull();
    expect(await sendSetupOf(() => Promise.resolve({ ok: false as const }), VIEWER.id, 'w1', 'vertuoza/app', quiet)).toBeNull();
  });

  it('hides the button, and logs, when the read fails', async () => {
    const logged: unknown[] = [];
    const failing = () => Promise.reject(new Error('runners: down'));
    expect(await sendSetupOf(failing, VIEWER.id, 'w1', 'vertuoza/app', (error) => logged.push(error))).toBeNull();
    expect(logged).toEqual([new Error('runners: down')]);
  });
});
