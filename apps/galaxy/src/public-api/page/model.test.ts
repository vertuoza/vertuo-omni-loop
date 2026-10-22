import { describe, expect, it } from 'vitest';
import type { ApiKey } from '../keys/api-keys.contract';
import {
  apiKeysReducer, canAttach, canMake, curlOf, dayOf, initialApiKeysState, lastTokenOf, lastUsedOf, makerOf, maskedKey, repoChip, reposOf, type ApiKeysState,
} from './model';

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
    expect(repoChip('demo-org/backend-php')).toBe('backend-php');
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

// A key's GitHub App (PRD 2433 s5): the attach form's state, Remove asked twice, and the words under the slug.

const APP = { slug: 'acme-fixer', lastTokenAt: '2026-10-21T08:00:00Z' };
const PEM = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----\n';
const FILE = { name: 'acme-fixer.pem', text: PEM };

describe('a key’s GitHub App', () => {
  const keys = [key('k-1', 'QA', { githubApp: APP }), key('k-2', 'Digest', { githubApp: null })];
  const opened = () => run(initialApiKeysState(keys), { type: 'attach-open', key: key('k-2', 'Digest') });
  const filled = () => run(opened(), { type: 'attach-id', appId: '3141592' }, { type: 'attach-file', file: FILE });

  it('starts with no attach form and no Remove asked', () => {
    expect(initialApiKeysState(keys)).toMatchObject({ attach: null, removing: null });
  });

  it('opens the attach form on one key, empty, and shuts the New key form, which shuts it in turn', () => {
    const state = run(initialApiKeysState(keys), { type: 'open' }, { type: 'name', name: 'QA' }, { type: 'attach-open', key: key('k-2', 'Digest') });
    expect(state.attach).toEqual({ id: 'k-2', name: 'Digest', appId: '', file: null });
    expect(state.form.open).toBe(false);
    const back = run(state, { type: 'open' });
    expect(back.attach).toBeNull();
    expect(back.form.open).toBe(true);
  });

  it('drops a Revoke or a Remove waiting for its second click when the form opens', () => {
    const asked = run(initialApiKeysState(keys), { type: 'confirm', id: 'k-1' }, { type: 'remove-confirm', id: 'k-1' });
    expect(asked).toMatchObject({ confirming: null, removing: 'k-1' });
    expect(run(asked, { type: 'attach-open', key: key('k-2') })).toMatchObject({ confirming: null, removing: null });
  });

  it('sends nothing until the App ID is digits and a private key file is chosen', () => {
    expect(canAttach(opened())).toBe(false);
    expect(canAttach(run(opened(), { type: 'attach-id', appId: '3141592' }))).toBe(false);
    expect(canAttach(run(opened(), { type: 'attach-file', file: FILE }))).toBe(false);
    expect(canAttach(filled())).toBe(true);
    expect(canAttach(run(filled(), { type: 'attach-id', appId: '  3141592 ' }))).toBe(true);
    expect(canAttach(run(filled(), { type: 'attach-id', appId: '31x' }))).toBe(false);
    expect(canAttach(run(filled(), { type: 'attach-id', appId: '1234567890123456' }))).toBe(false);
    expect(canAttach(run(filled(), { type: 'attach-file', file: { name: 'empty.pem', text: ' \n' } }))).toBe(false);
    expect(canAttach(run(filled(), { type: 'attach-file', file: null }))).toBe(false);
    expect(canAttach(run(filled(), { type: 'busy' }))).toBe(false);
    expect(canAttach(initialApiKeysState(keys))).toBe(false);
  });

  it('puts the slug on the row, with no token yet, and closes the form without keeping the private key', () => {
    const state = run(filled(), { type: 'busy' }, { type: 'attached', id: 'k-2', slug: 'acme-triage' });
    expect(state.keys.map((k) => k.githubApp)).toEqual([APP, { slug: 'acme-triage', lastTokenAt: null }]);
    expect(state.attach).toBeNull();
    expect(state.busy).toBe(false);
    expect(JSON.stringify(state)).not.toContain('MIIEow');
  });

  it('starts a replaced pair at no token yet', () => {
    const state = run(initialApiKeysState(keys), { type: 'attach-open', key: key('k-1', 'QA') }, { type: 'attached', id: 'k-1', slug: 'acme-fixer-2' });
    expect(state.keys[0]?.githubApp).toEqual({ slug: 'acme-fixer-2', lastTokenAt: null });
  });

  it('drops what was typed and chosen when the form is cancelled', () => {
    const state = run(filled(), { type: 'attach-close' });
    expect(state.attach).toBeNull();
    expect(JSON.stringify(state)).not.toContain('MIIEow');
  });

  it('keeps the form and what was typed when the attach is refused, and says why', () => {
    const state = run(filled(), { type: 'busy' }, { type: 'refused', message: 'GitHub refused this App ID and private key.' });
    expect(state.attach).toEqual({ id: 'k-2', name: 'Digest', appId: '3141592', file: FILE });
    expect(state).toMatchObject({ busy: false, refusal: 'GitHub refused this App ID and private key.' });
    expect(canAttach(state)).toBe(true);
    expect(run(state, { type: 'attach-close' }).refusal).toBeNull();
  });

  it('asks Remove twice, and takes the App off the row once removed', () => {
    const asked = run(initialApiKeysState(keys), { type: 'remove-confirm', id: 'k-1' });
    expect(asked.removing).toBe('k-1');
    expect(run(asked, { type: 'remove-cancel' }).removing).toBeNull();
    expect(run(asked, { type: 'confirm', id: 'k-1' })).toMatchObject({ removing: null, confirming: 'k-1' });
    const gone = run(asked, { type: 'busy' }, { type: 'removed', id: 'k-1' });
    expect(gone.keys.map((k) => k.githubApp)).toEqual([null, null]);
    expect(gone).toMatchObject({ removing: null, busy: false });
    expect(gone.keys.map((k) => k.id)).toEqual(['k-1', 'k-2']);
  });

  it('forgets a Remove waiting when its key is revoked', () => {
    expect(run(initialApiKeysState(keys), { type: 'remove-confirm', id: 'k-1' }, { type: 'revoked', id: 'k-1' }).removing).toBeNull();
  });

  it('closes the attach form of a key that is revoked, and leaves another key’s form open', () => {
    expect(run(filled(), { type: 'revoked', id: 'k-2' }).attach).toBeNull();
    expect(run(filled(), { type: 'revoked', id: 'k-1' }).attach).toEqual({ id: 'k-2', name: 'Digest', appId: '3141592', file: FILE });
  });

  it('changes nothing for a typed ID or a chosen file once no form is open', () => {
    const idle = initialApiKeysState(keys);
    expect(run(idle, { type: 'attach-id', appId: '1' })).toBe(idle);
    expect(run(idle, { type: 'attach-file', file: FILE })).toBe(idle);
  });

  it('says what a key’s App last did: the day of its last token, or that it has none yet', () => {
    expect(lastTokenOf('2026-10-21T08:00:00Z')).toBe('last token 21 Oct 2026');
    expect(lastTokenOf(null)).toBe('no token yet');
    expect(lastTokenOf(undefined)).toBe('no token yet');
  });
});
