import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../../test/fake-ask-server.ts';
import { homeTokens } from './client-tokens.ts';
import { credentials, credentialsHost, exchangeCode, signedInLine, SignInError, tokenEntry } from './credentials.ts';

const FILE = ['.config', 'omni', 'credentials.json'];
const ENTRY = { access_token: 'a', refresh_token: 'r', expires_at: 1790000000, email: 'ada@example.com' };

function home(entries?: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-home-'));
  if (entries !== undefined) {
    mkdirSync(join(dir, '.config', 'omni'), { recursive: true });
    writeFileSync(join(dir, ...FILE), JSON.stringify(entries));
  }
  return dir;
}

const onDisk = (dir: string) => JSON.parse(readFileSync(join(dir, ...FILE), 'utf8'));
const modeOf = (dir: string) => statSync(join(dir, ...FILE)).mode & 0o777;

/** The fake server, read loosely: a test reads its record of the calls as it expects. */
type FakeServer = { url: string; host: string; calls: any[]; close(): Promise<void>; [key: string]: any };
const startServer = startFakeAskServer as (options?: Record<string, unknown>) => Promise<FakeServer>;
let server: FakeServer | undefined;
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
  it('keeps the tokens, their expiry, and the email and GitHub login when the reply has them', () => {
    expect(tokenEntry({ ...ENTRY, extra: 'dropped', workspace: null, reason: 'dropped too' })).toEqual(ENTRY);
    expect(tokenEntry({ access_token: 'a', refresh_token: 'r', email: 'ada@example.com' })).toEqual({
      access_token: 'a', refresh_token: 'r', expires_at: null, email: 'ada@example.com',
    });
    expect(tokenEntry({ ...ENTRY, login: 'ada' })).toEqual({ ...ENTRY, login: 'ada' });
  });

  it('is kept without an email: GitHub lets a person keep theirs private (PRD 459)', () => {
    expect(tokenEntry({ access_token: 'a', refresh_token: 'r', expires_at: 1, login: 'ned' })).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: 1, login: 'ned' });
    expect(tokenEntry({ access_token: 'a', refresh_token: 'r', email: null })).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: null });
  });

  it('is refused without an access token or a refresh token', () => {
    for (const reply of [null, [], 'text', {}, { ...ENTRY, access_token: '' }, { ...ENTRY, refresh_token: 7 }]) {
      expect(tokenEntry(reply)).toBeNull();
    }
  });
});

describe('the line a sign-in ends on (PRD 459)', () => {
  const repo = 'acme/api';
  it('names the workspace the repository goes to', () => {
    expect(signedInLine({ login: 'ada', repo, workspace: { slug: 'acme', name: 'Acme' }, reason: null })).toBe('signed in as ada — acme/api goes to Acme');
  });

  it('says no workspace owns it yet, with the install link the server added', () => {
    const reason = 'no workspace owns acme/api yet — install the Omni App: https://github.com/apps/omni-loop/installations/new';
    expect(signedInLine({ login: 'ada', repo, workspace: null, reason })).toBe(`signed in as ada — ${reason}`);
  });

  it('says whose workspace owns it when the person is not a member', () => {
    const reason = 'you are not a member of Globex, which owns acme/api';
    expect(signedInLine({ login: 'ada', repo, workspace: null, reason })).toBe(`signed in as ada — ${reason}`);
  });

  it('names only the account when the server said nothing about the repository (an older page, or no repo.slug)', () => {
    expect(signedInLine({ login: 'ada', email: 'ada@example.com', repo, workspace: null, reason: null })).toBe('signed in as ada');
    expect(signedInLine({ email: 'ada@example.com', repo: null })).toBe('signed in as ada@example.com');
    expect(signedInLine({ login: 'ada', repo: null, workspace: { slug: 'acme', name: 'Acme' } })).toBe('signed in as ada');
    expect(signedInLine({})).toBe('signed in');
  });
});

describe('exchanging a one-time code', () => {
  it('posts {code} to <ask.url>/api/ask/token and returns the tokens', async () => {
    server = await startServer({ codes: ['code-1'], email: 'ada@example.com' });
    const { entry, workspace, reason } = await exchangeCode({ askUrl: `${server.url}/`, code: 'code-1' });
    expect(entry).toMatchObject({ access_token: 'access-2', refresh_token: 'refresh-2', email: 'ada@example.com' });
    expect({ workspace, reason }).toEqual({ workspace: null, reason: null });
    expect(server.calls.at(-1)).toMatchObject({ method: 'POST', path: '/api/ask/token', body: { code: 'code-1' }, authorization: null });
  });

  it('sends the repository with the code, and returns where it goes (PRD 459)', async () => {
    const sent: unknown[] = [];
    const fetch = async (_url: unknown, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return Response.json({ access_token: 'a', refresh_token: 'r', expires_at: 1, login: 'ned', workspace: { slug: 'acme', name: 'Acme', extra: 1 } });
    };
    const out = await exchangeCode({ askUrl: 'https://ask.example.com', code: 'c', repo: 'acme/api', fetch });
    expect(sent).toEqual([{ code: 'c', repo: 'acme/api' }]);
    expect(out).toEqual({ entry: { access_token: 'a', refresh_token: 'r', expires_at: 1, login: 'ned' }, login: 'ned', email: null, workspace: { slug: 'acme', name: 'Acme' }, reason: null });
    const refused = async () => Response.json({ access_token: 'a', refresh_token: 'r', login: 'ned', workspace: null, reason: 'you are not a member of Acme, which owns acme/api' });
    expect(await exchangeCode({ askUrl: 'https://ask.example.com', code: 'c', repo: 'acme/api', fetch: refused })).toMatchObject({ workspace: null, reason: 'you are not a member of Acme, which owns acme/api' });
  });

  it('is refused with the server\'s reason for a code it does not know, or knew once', async () => {
    server = await startServer({ codes: ['code-1'] });
    await exchangeCode({ askUrl: server.url, code: 'code-1' });
    await expect(exchangeCode({ askUrl: server.url, code: 'code-1' })).rejects.toThrow(/refused.*invalid grant/);
    await expect(exchangeCode({ askUrl: server.url, code: 'code-1' })).rejects.toBeInstanceOf(SignInError);
  });

  it('is refused when the server cannot be reached, or answers without tokens', async () => {
    server = await startServer();
    const { url } = server;
    await server.close();
    server = undefined;
    await expect(exchangeCode({ askUrl: url, code: 'c' })).rejects.toThrow(/could not reach/);
    const empty = async () => new Response('{}', { status: 200 });
    await expect(exchangeCode({ askUrl: url, code: 'c', fetch: empty })).rejects.toThrow(/no tokens/);
  });
});
