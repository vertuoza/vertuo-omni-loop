import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../../test/fake-ask-server.mjs';
import { homeTokens } from './client-tokens.mjs';
import { credentials, credentialsHost, exchangeCode, SignInError, tokenEntry } from './credentials.mjs';

const FILE = ['.config', 'omni', 'credentials.json'];
const ENTRY = { access_token: 'a', refresh_token: 'r', expires_at: 1790000000, email: 'ada@example.com' };

function home(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-home-'));
  if (entries !== undefined) {
    mkdirSync(join(dir, '.config', 'omni'), { recursive: true });
    writeFileSync(join(dir, ...FILE), JSON.stringify(entries));
  }
  return dir;
}

const onDisk = (dir) => JSON.parse(readFileSync(join(dir, ...FILE), 'utf8'));
const modeOf = (dir) => statSync(join(dir, ...FILE)).mode & 0o777;

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('the credentials omni signin keeps', () => {
  it('are keyed by the host of ask.url, port included', () => {
    expect(credentialsHost('https://ask.example.com')).toBe('ask.example.com');
    expect(credentialsHost('https://ask.example.com/base/')).toBe('ask.example.com');
    expect(credentialsHost('http://127.0.0.1:47831')).toBe('127.0.0.1:47831');
  });

  it('live in ~/.config/omni/credentials.json at mode 0600, the file the hooks read', () => {
    const dir = home();
    const store = credentials({ home: dir });
    expect(store.file).toBe(join(dir, ...FILE));
    store.write('ask.example.com', ENTRY);
    expect(modeOf(dir)).toBe(0o600);
    expect(onDisk(dir)).toEqual({ 'ask.example.com': ENTRY });
    // One store, not two: what signin writes is what the hooks read, and a refresh the hooks
    // write back is what whoami reads.
    expect(homeTokens({ home: dir }).read('ask.example.com')).toEqual(ENTRY);
    homeTokens({ home: dir }).write('ask.example.com', { ...ENTRY, access_token: 'a2' });
    expect(store.read('ask.example.com')).toEqual({ ...ENTRY, access_token: 'a2' });
  });

  it('keep every other host when one is written', () => {
    const dir = home({ 'other.example.com': { access_token: 'x' } });
    credentials({ home: dir }).write('ask.example.com', ENTRY);
    expect(onDisk(dir)).toEqual({ 'other.example.com': { access_token: 'x' }, 'ask.example.com': ENTRY });
  });

  it('remove one host and keep the others, still at mode 0600', () => {
    const dir = home({ 'other.example.com': { access_token: 'x' }, 'ask.example.com': ENTRY });
    const store = credentials({ home: dir });
    expect(store.remove('ask.example.com')).toBe(true);
    expect(onDisk(dir)).toEqual({ 'other.example.com': { access_token: 'x' } });
    expect(modeOf(dir)).toBe(0o600);
    expect(store.read('ask.example.com')).toBeNull();
  });

  it('delete the file when the last host goes, and remove nothing that is not there', () => {
    const dir = home({ 'ask.example.com': ENTRY });
    const store = credentials({ home: dir });
    expect(store.remove('ask.example.com')).toBe(true);
    expect(existsSync(join(dir, ...FILE))).toBe(false);
    expect(store.remove('ask.example.com')).toBe(false);
    expect(credentials({ home: home() }).remove('ask.example.com')).toBe(false);
  });

  it('leave a file that is not theirs to read alone', () => {
    const dir = home();
    mkdirSync(join(dir, '.config', 'omni'), { recursive: true });
    writeFileSync(join(dir, ...FILE), '{ not json');
    expect(credentials({ home: dir }).remove('ask.example.com')).toBe(false);
    expect(readFileSync(join(dir, ...FILE), 'utf8')).toBe('{ not json');
  });
});

describe('the token exchange reply', () => {
  it('keeps exactly the four fields of the contract', () => {
    expect(tokenEntry({ ...ENTRY, extra: 'dropped' })).toEqual(ENTRY);
    expect(tokenEntry({ access_token: 'a', refresh_token: 'r', email: 'ada@example.com' })).toEqual({
      access_token: 'a', refresh_token: 'r', expires_at: null, email: 'ada@example.com',
    });
  });

  it('is refused without an access token, a refresh token or an email', () => {
    for (const reply of [null, [], 'text', {}, { ...ENTRY, access_token: '' }, { ...ENTRY, refresh_token: 7 }, { ...ENTRY, email: undefined }]) {
      expect(tokenEntry(reply)).toBeNull();
    }
  });
});

describe('exchanging a one-time code', () => {
  it('posts {code} to <ask.url>/api/ask/token and returns the tokens', async () => {
    server = await startFakeAskServer({ codes: ['code-1'], email: 'ada@example.com' });
    const entry = await exchangeCode({ askUrl: `${server.url}/`, code: 'code-1' });
    expect(entry).toMatchObject({ access_token: 'access-2', refresh_token: 'refresh-2', email: 'ada@example.com' });
    expect(server.calls.at(-1)).toMatchObject({ method: 'POST', path: '/api/ask/token', body: { code: 'code-1' }, authorization: null });
  });

  it('is refused with the server\'s reason for a code it does not know, or knew once', async () => {
    server = await startFakeAskServer({ codes: ['code-1'] });
    await exchangeCode({ askUrl: server.url, code: 'code-1' });
    await expect(exchangeCode({ askUrl: server.url, code: 'code-1' })).rejects.toThrow(/refused.*invalid grant/);
    await expect(exchangeCode({ askUrl: server.url, code: 'code-1' })).rejects.toBeInstanceOf(SignInError);
  });

  it('is refused when the server cannot be reached, or answers without tokens', async () => {
    server = await startFakeAskServer();
    const { url } = server;
    await server.close();
    server = undefined;
    await expect(exchangeCode({ askUrl: url, code: 'c' })).rejects.toThrow(/could not reach/);
    const empty = async () => new Response('{}', { status: 200 });
    await expect(exchangeCode({ askUrl: url, code: 'c', fetch: empty })).rejects.toThrow(/no tokens/);
  });
});
