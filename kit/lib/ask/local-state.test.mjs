import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import {
  clearRound,
  clearSession,
  LOCAL_DIR,
  readRound,
  readSession,
  writeRound,
  writeSession,
} from './local-state.mjs';

const SESSION = { sessionId: 'sess-1', url: 'https://ask.example.com/ask/sess-1', host: 'ask.example.com' };

describe('the ask local state', () => {
  it('lives in .omni-loop/local', () => {
    expect(LOCAL_DIR).toBe('.omni-loop/local');
  });

  it('reads nothing when the folder or the file is missing', () => {
    const { root } = makeRepo();
    expect(readSession(root)).toBeNull();
    expect(readRound(root)).toBeNull();
  });

  it('writes, reads and clears the session', () => {
    const { root } = makeRepo();
    writeSession(root, SESSION);
    expect(readSession(root)).toEqual(SESSION);
    clearSession(root);
    expect(readSession(root)).toBeNull();
    expect(existsSync(join(root, LOCAL_DIR, 'ask.json'))).toBe(false);
    expect(() => clearSession(root)).not.toThrow();
  });

  it('writes, reads and clears the round', () => {
    const { root } = makeRepo();
    const round = { roundId: 'r-1', toolUseId: 'toolu_1', status: 'open' };
    writeRound(root, round);
    expect(readRound(root)).toEqual(round);
    clearRound(root);
    expect(readRound(root)).toBeNull();
    expect(() => clearRound(root)).not.toThrow();
  });

  it('reads a malformed or half-written file as missing', () => {
    const { root, write } = makeRepo();
    write(`${LOCAL_DIR}/ask.json`, '{"sessionId": ');
    expect(readSession(root)).toBeNull();
    write(`${LOCAL_DIR}/ask.json`, JSON.stringify({ sessionId: 'x', url: 'https://a.example/ask/x' }));
    expect(readSession(root)).toBeNull();
    write(`${LOCAL_DIR}/ask-round.json`, JSON.stringify({ toolUseId: 't' }));
    expect(readRound(root)).toBeNull();
  });

  it('gives the folder its own .gitignore, so git never sees what is in it', () => {
    const { root } = makeRepo({ git: true });
    writeSession(root, SESSION);
    writeRound(root, { roundId: 'r-1', toolUseId: null, status: 'open' });
    expect(readFileSync(join(root, LOCAL_DIR, '.gitignore'), 'utf8')).toBe('*\n');
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
    expect(status).toBe('');
  });

  it('leaves a .gitignore someone already wrote alone', () => {
    const { root, write } = makeRepo();
    write(`${LOCAL_DIR}/.gitignore`, '*\n!keep\n');
    writeSession(root, SESSION);
    expect(readFileSync(join(root, LOCAL_DIR, '.gitignore'), 'utf8')).toBe('*\n!keep\n');
  });
});
