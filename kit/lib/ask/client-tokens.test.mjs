import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { homeTokens } from './client-tokens.mjs';

const FILE = ['.config', 'omni', 'credentials.json'];

function home(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-home-'));
  if (entries !== undefined) {
    mkdirSync(join(dir, '.config', 'omni'), { recursive: true });
    writeFileSync(join(dir, ...FILE), typeof entries === 'string' ? entries : JSON.stringify(entries));
  }
  return dir;
}

describe('the token store the hooks read', () => {
  it('reads the sign-in kept in ~/.config/omni/credentials.json for one host', () => {
    const tokens = { access_token: 'a', refresh_token: 'r', expires_at: 1, email: 'p@example.com' };
    const store = homeTokens({ home: home({ 'ask.example.com': tokens, 'other.example.com': { access_token: 'x' } }) });
    expect(store.read('ask.example.com')).toEqual(tokens);
    expect(store.read('nowhere.example.com')).toBeNull();
  });

  it('reads nothing from a missing, malformed or tokenless file', () => {
    expect(homeTokens({ home: home() }).read('ask.example.com')).toBeNull();
    expect(homeTokens({ home: home('{ not json') }).read('ask.example.com')).toBeNull();
    expect(homeTokens({ home: home({ 'ask.example.com': { email: 'p@example.com' } }) }).read('ask.example.com')).toBeNull();
  });

  it('writes one host, keeps the others, and keeps the file at mode 0600', () => {
    const dir = home({ 'other.example.com': { access_token: 'x' } });
    const store = homeTokens({ home: dir });
    store.write('ask.example.com', { access_token: 'a2', refresh_token: 'r2' });
    expect(JSON.parse(readFileSync(join(dir, ...FILE), 'utf8'))).toEqual({
      'other.example.com': { access_token: 'x' },
      'ask.example.com': { access_token: 'a2', refresh_token: 'r2' },
    });
    expect(statSync(join(dir, ...FILE)).mode & 0o777).toBe(0o600);
  });

  it('creates the file at mode 0600 when there was none', () => {
    const dir = home();
    homeTokens({ home: dir }).write('ask.example.com', { access_token: 'a' });
    expect(statSync(join(dir, ...FILE)).mode & 0o777).toBe(0o600);
    expect(homeTokens({ home: dir }).read('ask.example.com')).toEqual({ access_token: 'a' });
  });
});
