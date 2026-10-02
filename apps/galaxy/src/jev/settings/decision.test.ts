import { describe, expect, it } from 'vitest';
import { JevStoreError, type JevDecisionSettings } from '../store';
import { readDecision, saveDecisionFor } from './decision';

// Saving one decision's mode, threshold and floor (PRD 812 s2): as the signed-in person, so the
// database's owner-only function decides; a malformed or coming decision is refused before it is sent;
// only the one decision is written.

const W = 'ws-1';
const ON: JevDecisionSettings = { decision: 'question-category', mode: 'on', threshold: 0.65, floor: 0.3 };

function store({ refuse }: { refuse?: string } = {}) {
  const set: Array<[string, JevDecisionSettings]> = [];
  return {
    set,
    store: {
      setDecision(workspace: string, settings: JevDecisionSettings) {
        if (refuse) return Promise.reject(new JevStoreError('save the Jev decision', refuse, 'Mode: switch Jev on with a key first.'));
        set.push([workspace, settings]);
        return Promise.resolve(settings);
      },
    },
  };
}

describe('readDecision', () => {
  it('reads a decision\'s settings, numbers rounded to two places', () => {
    expect(readDecision({ ...ON, threshold: '0.654', floor: 0.3 })).toEqual({ ok: true, settings: { ...ON, threshold: 0.65 } });
  });

  it('refuses an unknown decision, a bad mode and numbers outside 0 to 1', () => {
    expect(readDecision({ ...ON, decision: 'nope' })).toMatchObject({ ok: false });
    expect(readDecision({ ...ON, decision: 'bug-risk' })).toEqual({ ok: true, settings: { ...ON, decision: 'bug-risk' } });
    expect(readDecision({ ...ON, mode: 'maybe' })).toMatchObject({ ok: false });
    expect(readDecision({ ...ON, threshold: 1.2 })).toMatchObject({ ok: false });
    expect(readDecision({ ...ON, floor: -0.1 })).toMatchObject({ ok: false });
    expect(readDecision({ ...ON, floor: 'x' })).toMatchObject({ ok: false });
    expect(readDecision(null)).toMatchObject({ ok: false });
  });
});

describe('saveDecisionFor', () => {
  it('writes the one decision, and answers what was stored', async () => {
    const { store: s, set } = store();
    expect(await saveDecisionFor(s, W, ON)).toEqual({ ok: true, settings: ON });
    expect(set).toEqual([[W, ON]]);
  });

  it('asks to sign in, and sends nothing malformed', async () => {
    expect(await saveDecisionFor(null, W, ON)).toEqual({ ok: false, message: 'Sign in first.' });
    const { store: s, set } = store();
    expect((await saveDecisionFor(s, W, { ...ON, mode: 'loud' })).ok).toBe(false);
    expect((await saveDecisionFor(s, '', ON)).ok).toBe(false);
    expect(set).toEqual([]);
  });

  it('says only the owner may, and passes a refused value\'s reason on', async () => {
    expect(await saveDecisionFor(store({ refuse: '42501' }).store, W, ON)).toEqual({ ok: false, message: 'Only the workspace’s owner can change its Jev settings.' });
    const refused = await saveDecisionFor(store({ refuse: '22023' }).store, W, ON);
    expect(refused).toEqual({ ok: false, message: 'Mode: switch Jev on with a key first.' });
  });
});
