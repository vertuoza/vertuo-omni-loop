import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import {
  clearMode,
  clearRound,
  clearTerminal,
  isSafeId,
  listTerminals,
  LOCAL_DIR,
  readMode,
  readRound,
  readTerminal,
  writeMode,
  writeRound,
  writeTerminal,
} from './local-state.mjs';

const HOST = 'ask.example.com';

describe('the ask local state', () => {
  it('lives in .omni-loop/local', () => {
    expect(LOCAL_DIR).toBe('.omni-loop/local');
  });

  it('reads nothing when the folder or the files are missing', () => {
    const { root } = makeRepo();
    expect(readMode(root)).toBeNull();
    expect(readTerminal(root, 'term-a')).toBeNull();
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(listTerminals(root)).toEqual([]);
  });

  it('writes and reads the mode as { host }', () => {
    const { root } = makeRepo();
    writeMode(root, { host: HOST });
    expect(readMode(root)).toEqual({ host: HOST, sessionId: null });
    expect(JSON.parse(readFileSync(join(root, LOCAL_DIR, 'ask.json'), 'utf8'))).toEqual({ host: HOST });
  });

  it('reads an ask.json in PRD 71\'s shape as on, keeping its session for off', () => {
    const { root, write } = makeRepo();
    write(`${LOCAL_DIR}/ask.json`, JSON.stringify({ sessionId: 'sess-71', url: `https://${HOST}/ask/sess-71`, host: HOST }));
    expect(readMode(root)).toEqual({ host: HOST, sessionId: 'sess-71' });
  });

  it('writes, reads, lists and clears one terminal\'s session', () => {
    const { root } = makeRepo();
    writeTerminal(root, 'term-a', { sessionId: 'sess-1', host: HOST });
    writeTerminal(root, 'term-b', { sessionId: 'sess-2', host: HOST });
    expect(readTerminal(root, 'term-a')).toEqual({ sessionId: 'sess-1', host: HOST });
    expect(existsSync(join(root, LOCAL_DIR, 'ask', 'term-a.json'))).toBe(true);
    expect(listTerminals(root)).toEqual([
      { terminalId: 'term-a', sessionId: 'sess-1', host: HOST },
      { terminalId: 'term-b', sessionId: 'sess-2', host: HOST },
    ]);
    clearTerminal(root, 'term-a');
    expect(readTerminal(root, 'term-a')).toBeNull();
    expect(readTerminal(root, 'term-b')).toEqual({ sessionId: 'sess-2', host: HOST });
    expect(() => clearTerminal(root, 'term-a')).not.toThrow();
  });

  it('writes, reads and clears one question\'s round, never another\'s', () => {
    const { root } = makeRepo();
    writeRound(root, 'toolu_01', { roundId: 'r-1', status: 'open' });
    writeRound(root, 'toolu_02', { roundId: 'r-2', status: 'answered' });
    expect(readRound(root, 'toolu_01')).toEqual({ roundId: 'r-1', status: 'open' });
    expect(existsSync(join(root, LOCAL_DIR, 'ask', 'rounds', 'toolu_01.json'))).toBe(true);
    clearRound(root, 'toolu_01');
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(readRound(root, 'toolu_02')).toEqual({ roundId: 'r-2', status: 'answered' });
    // The rounds folder is no terminal.
    expect(listTerminals(root)).toEqual([]);
  });

  it('clears the mode: ask.json, every terminal and round, and PRD 71\'s round file', () => {
    const { root, write } = makeRepo();
    writeMode(root, { host: HOST });
    writeTerminal(root, 'term-a', { sessionId: 'sess-1', host: HOST });
    writeRound(root, 'toolu_01', { roundId: 'r-1', status: 'open' });
    write(`${LOCAL_DIR}/ask-round.json`, JSON.stringify({ roundId: 'r-0', toolUseId: null, status: 'open' }));
    clearMode(root);
    expect(readMode(root)).toBeNull();
    expect(existsSync(join(root, LOCAL_DIR, 'ask'))).toBe(false);
    expect(existsSync(join(root, LOCAL_DIR, 'ask-round.json'))).toBe(false);
    expect(existsSync(join(root, LOCAL_DIR, '.gitignore'))).toBe(true);
    expect(() => clearMode(root)).not.toThrow();
  });

  it('takes an id as a file name only when it is a safe one', () => {
    for (const id of ['term-a', 'toolu_01ABC', 'a'.repeat(128), '6f1c2e0a-1b2c-4d5e-8f90-123456789abc']) expect(isSafeId(id)).toBe(true);
    for (const id of ['', '../ask', 'a/b', 'a.json', 'a b', 'a'.repeat(129), null, undefined, 7, {}]) expect(isSafeId(id)).toBe(false);
    const { root } = makeRepo();
    writeMode(root, { host: HOST });
    for (const id of ['../ask', '..', 'a/b', '']) {
      expect(readTerminal(root, id)).toBeNull();
      expect(readRound(root, id)).toBeNull();
      expect(() => writeTerminal(root, id, { sessionId: 's', host: HOST })).toThrow();
      expect(() => writeRound(root, id, { roundId: 'r', status: 'open' })).toThrow();
    }
    expect(readMode(root)).toEqual({ host: HOST, sessionId: null });
  });

  it('reads a malformed or half-written file as missing', () => {
    const { root, write } = makeRepo();
    write(`${LOCAL_DIR}/ask.json`, '{"host": ');
    expect(readMode(root)).toBeNull();
    write(`${LOCAL_DIR}/ask.json`, JSON.stringify({ sessionId: 'x' }));
    expect(readMode(root)).toBeNull();
    write(`${LOCAL_DIR}/ask/term-a.json`, JSON.stringify({ sessionId: 'x' }));
    expect(readTerminal(root, 'term-a')).toBeNull();
    expect(listTerminals(root)).toEqual([]);
    write(`${LOCAL_DIR}/ask/rounds/toolu_01.json`, JSON.stringify({ status: 'open' }));
    expect(readRound(root, 'toolu_01')).toBeNull();
  });

  it('gives the folder its own .gitignore, so git never sees what is in it', () => {
    const { root } = makeRepo({ git: true });
    writeMode(root, { host: HOST });
    writeTerminal(root, 'term-a', { sessionId: 'sess-1', host: HOST });
    writeRound(root, 'toolu_01', { roundId: 'r-1', status: 'open' });
    expect(readFileSync(join(root, LOCAL_DIR, '.gitignore'), 'utf8')).toBe('*\n');
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
    expect(status).toBe('');
  });

  it('leaves a .gitignore someone already wrote alone', () => {
    const { root, write } = makeRepo();
    write(`${LOCAL_DIR}/.gitignore`, '*\n!keep\n');
    writeMode(root, { host: HOST });
    expect(readFileSync(join(root, LOCAL_DIR, '.gitignore'), 'utf8')).toBe('*\n!keep\n');
  });
});
