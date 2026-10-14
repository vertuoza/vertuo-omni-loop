import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openSessionId, readStoredSession, SESSION_FILE, sessionIdOf } from './session.ts';

const fresh = (): string => mkdtempSync(join(tmpdir(), 'omni-session-'));
const UUID = '6f1c2e0a-1b2c-4d5e-8f90-123456789abc';
const store = (root: string, value: unknown): void => {
  mkdirSync(join(root, '.omni-loop/local'), { recursive: true });
  writeFileSync(join(root, SESSION_FILE), typeof value === 'string' ? value : JSON.stringify(value));
};

describe('the session id stored for a checkout (PRD 1739)', () => {
  it('lives in .omni-loop/local/session.json', () => {
    expect(SESSION_FILE).toBe(join('.omni-loop', 'local', 'session.json'));
  });

  it('reads the stored id, and null for a file that is missing, broken, of another shape or unsafe', () => {
    const root = fresh();
    expect(readStoredSession(root)).toBeNull();
    expect(readStoredSession(null)).toBeNull();
    store(root, { id: UUID });
    expect(readStoredSession(root)).toBe(UUID);
    for (const value of ['{', '[]', { id: 7 }, { id: '' }, { id: '../x' }, { id: 'a b' }, { other: UUID }]) {
      store(root, value);
      expect(readStoredSession(root), JSON.stringify(value)).toBeNull();
    }
  });

  it('gives the variable first, then the stored id, then none — and writes nothing', () => {
    const root = fresh();
    expect(sessionIdOf({ id: 'abc' }, root)).toBe('abc');
    expect(sessionIdOf(null, root)).toBeNull();
    expect(existsSync(join(root, '.omni-loop'))).toBe(false);
    store(root, { id: UUID });
    expect(sessionIdOf(null, root)).toBe(UUID);
    expect(sessionIdOf({ id: 'abc' }, root)).toBe('abc');
  });

  it('for dossier open: generates and stores an id when neither gives one, and reuses it after', () => {
    const root = fresh();
    let made = 0;
    const generate = () => {
      made += 1;
      return UUID;
    };
    expect(openSessionId(null, root, generate)).toBe(UUID);
    expect(JSON.parse(readFileSync(join(root, SESSION_FILE), 'utf8'))).toEqual({ id: UUID });
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
    expect(openSessionId(null, root, () => 'other')).toBe(UUID);
    expect(made).toBe(1);
  });

  it('for dossier open: a variable wins and writes no file', () => {
    const root = fresh();
    expect(openSessionId({ id: 'abc' }, root, () => UUID)).toBe('abc');
    expect(existsSync(join(root, SESSION_FILE))).toBe(false);
  });

  it('for dossier open: an id whose file cannot be written is still sent', () => {
    const root = join(fresh(), 'file');
    writeFileSync(root, 'not a folder');
    expect(openSessionId(null, root, () => UUID)).toBe(UUID);
  });
});
