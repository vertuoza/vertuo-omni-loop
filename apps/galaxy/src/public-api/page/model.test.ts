import { describe, expect, it } from 'vitest';
import type { ApiKey } from '../keys/api-keys.contract';
import { apiKeysReducer, canMake, curlOf, dayOf, initialApiKeysState, lastUsedOf, makerOf, maskedKey, repoChip, reposOf, type ApiKeysState } from './model';

// Settings › API keys' model (PRD 2022 s1): how each action changes the panel, and what a key's row says.

const key = (id: string, name = id, more: Partial<ApiKey> = {}): ApiKey => ({
  id, name, lastFour: '9fQe', repos: [], createdAt: '2026-10-15T10:00:00Z', lastUsedAt: null, revokedAt: null,
  maker: { id: 'u-1', login: 'ada', name: 'Ada' }, working: true, ...more,
});
const SECRET = `oma_${'A'.repeat(39)}9fQe`;
const run = (state: ApiKeysState, ...actions: Parameters<typeof apiKeysReducer>[1][]) => actions.reduce(apiKeysReducer, state);

describe('the panel’s state', () => {
  it('starts with the keys, the form closed, no secret shown', () => {
    const state = initialApiKeysState([key('k-1')]);
    expect(state).toMatchObject({ keys: [key('k-1')], form: { open: false }, made: null, busy: false, refusal: null });
  });

  it('opens the form on All repositories, and sends none until a name is typed', () => {
    const open = run(initialApiKeysState([]), { type: 'open' });
    expect(open.form).toEqual({ open: true, name: '', all: true, repos: [] });
    expect(canMake(open)).toBe(false);
    expect(canMake(run(open, { type: 'name', name: '  ' }))).toBe(false);
    expect(canMake(run(open, { type: 'name', name: 'QA' }))).toBe(true);
  });

  it('needs a repository picked once All is left, and sends the picked ones in order', () => {
    const some = run(initialApiKeysState([]), { type: 'open' }, { type: 'name', name: 'QA' }, { type: 'all', all: false });
    expect(canMake(some)).toBe(false);
    const picked = run(some, { type: 'repo', repo: 'n/web', on: true }, { type: 'repo', repo: 'n/api', on: true }, { type: 'repo', repo: 'n/web', on: true });
    expect(canMake(picked)).toBe(true);
    expect(reposOf(picked.form)).toEqual(['n/api', 'n/web']);
    expect(reposOf(run(picked, { type: 'repo', repo: 'n/api', on: false }).form)).toEqual(['n/web']);
    expect(reposOf(run(picked, { type: 'all', all: true }).form)).toEqual([]);
  });

  it('sends nothing while a call is out', () => {
    expect(canMake(run(initialApiKeysState([]), { type: 'open' }, { type: 'name', name: 'QA' }, { type: 'busy' }))).toBe(false);
  });

  it('shows the key just made once, with its curl, puts it first and closes the form', () => {
    const state = run(initialApiKeysState([key('k-1')]), { type: 'open' }, { type: 'name', name: 'QA' }, { type: 'busy' },
      { type: 'made', key: key('k-2', 'QA'), secret: SECRET, origin: 'https://omni.test/' });
    expect(state.keys.map((k) => k.id)).toEqual(['k-2', 'k-1']);
    expect(state.made).toEqual({ name: 'QA', secret: SECRET, curl: `curl https://omni.test/api/v1/prds \\\n  -H "Authorization: Bearer ${SECRET}"` });
    expect(state.form.open).toBe(false);
    expect(state.busy).toBe(false);
  });

  it('asks Revoke twice, and takes the key out of the table once revoked', () => {
    const asked = run(initialApiKeysState([key('k-1'), key('k-2')]), { type: 'confirm', id: 'k-1' });
    expect(asked.confirming).toBe('k-1');
    expect(run(asked, { type: 'cancel' }).confirming).toBeNull();
    const gone = run(asked, { type: 'busy' }, { type: 'revoked', id: 'k-1' });
    expect(gone.keys.map((k) => k.id)).toEqual(['k-2']);
    expect(gone.confirming).toBeNull();
    expect(gone.busy).toBe(false);
  });

  it('says a refusal and lets the person try again', () => {
    const refused = run(initialApiKeysState([]), { type: 'busy' }, { type: 'refused', message: 'No.' });
    expect(refused).toMatchObject({ busy: false, refusal: 'No.' });
    expect(run(refused, { type: 'busy' }).refusal).toBeNull();
  });

  it('marks the secret copied until another key is made', () => {
    const copied = run(initialApiKeysState([]), { type: 'made', key: key('k-1'), secret: SECRET, origin: 'https://o.test' }, { type: 'copied' });
    expect(copied.copied).toBe(true);
    expect(run(copied, { type: 'made', key: key('k-2'), secret: SECRET, origin: 'https://o.test' }).copied).toBe(false);
  });
});

describe('a key’s row', () => {
  it('shows the key as oma_… and its last four', () => {
    expect(maskedKey(key('k-1'))).toBe('oma_…9fQe');
  });

  it('names a repository by its name, and the maker by their login', () => {
    expect(repoChip('vertuoza/backend-php')).toBe('backend-php');
    expect(makerOf(key('k-1'))).toBe('@ada');
    expect(makerOf(key('k-1', 'x', { maker: { id: 'u', login: null, name: 'Ada' } }))).toBe('Ada');
    expect(makerOf(key('k-1', 'x', { maker: { id: 'u', login: null, name: null } }))).toBe('someone');
  });

  it('says when it was last used: Never, then minutes, hours, days, then the day', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(lastUsedOf(null, now)).toBe('Never');
    expect(lastUsedOf('2026-10-15T11:59:40Z', now)).toBe('Just now');
    expect(lastUsedOf('2026-10-15T11:58:00Z', now)).toBe('2 min ago');
    expect(lastUsedOf('2026-10-15T09:00:00Z', now)).toBe('3 h ago');
    expect(lastUsedOf('2026-10-14T11:00:00Z', now)).toBe('1 day ago');
    expect(lastUsedOf('2026-10-10T12:00:00Z', now)).toBe('5 days ago');
    expect(lastUsedOf('2026-09-01T12:00:00Z', now)).toBe('1 Sept 2026');
    expect(dayOf('2026-10-15T10:00:00Z')).toBe('15 Oct 2026');
  });

  it('writes the curl with the origin, once', () => {
    expect(curlOf('https://omni.test///', 'oma_x')).toBe('curl https://omni.test/api/v1/prds \\\n  -H "Authorization: Bearer oma_x"');
  });
});
