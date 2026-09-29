import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import {
  clearMode,
  clearOldShots,
  clearRound,
  clearTerminal,
  isSafeId,
  listTerminals,
  LOCAL_DIR,
  readMode,
  readRound,
  readTerminal,
  SHOTS_MAX_AGE_MS,
  writeMode,
  writeRound,
  writeShot,
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

  it('keeps a round\'s screenshots when the mode is cleared: `omni ask off` removes nothing of them (PRD 620)', () => {
    const { root } = makeRepo();
    writeMode(root, { host: HOST });
    writeTerminal(root, 'term-a', { sessionId: 'sess-1', host: HOST });
    writeRound(root, 'toolu_01', { roundId: 'r-1', status: 'open' });
    const shot = writeShot(root, 'r-1', '1.png', Buffer.from('png'));
    clearMode(root);
    expect(readMode(root)).toBeNull();
    expect(readTerminal(root, 'term-a')).toBeNull();
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(readdirSync(join(root, LOCAL_DIR, 'ask'))).toEqual(['shots']);
    expect(readFileSync(shot, 'utf8')).toBe('png');
  });
});

describe('a round\'s screenshots (PRD 620)', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('writes each into .omni-loop/local/ask/shots/<round>/, and gives its absolute path', () => {
    const { root } = makeRepo();
    const path = writeShot(root, 'round-1', '2.webp', Buffer.from([1, 2, 3]));
    expect(isAbsolute(path)).toBe(true);
    expect(path).toBe(join(root, LOCAL_DIR, 'ask', 'shots', 'round-1', '2.webp'));
    expect([...readFileSync(path)]).toEqual([1, 2, 3]);
    // Never committed: the local folder ignores everything in it.
    expect(readFileSync(join(root, LOCAL_DIR, '.gitignore'), 'utf8')).toBe('*\n');
  });

  it('refuses a round id or a file name that could leave its folder', () => {
    const { root } = makeRepo();
    for (const round of ['../x', 'a/b', '', '..']) expect(() => writeShot(root, round, '1.png', Buffer.from('x'))).toThrow();
    for (const name of ['../1.png', 'a/1.png', '.png', '1', '', '..', '1.png/x', `${'a'.repeat(80)}.png`]) {
      expect(() => writeShot(root, 'round-1', name, Buffer.from('x'))).toThrow();
    }
  });

  it('removes the folders older than 7 days, and keeps the others', () => {
    const { root } = makeRepo();
    const now = Date.parse('2026-09-29T12:00:00Z');
    writeShot(root, 'old', '1.png', Buffer.from('x'));
    writeShot(root, 'fresh', '1.png', Buffer.from('y'));
    const shots = join(root, LOCAL_DIR, 'ask', 'shots');
    const at = (ms) => new Date(ms);
    utimesSync(join(shots, 'old'), at(now - 8 * DAY), at(now - 8 * DAY));
    utimesSync(join(shots, 'fresh'), at(now - 6 * DAY), at(now - 6 * DAY));
    expect(SHOTS_MAX_AGE_MS).toBe(7 * DAY);
    expect(clearOldShots(root, now)).toEqual(['old']);
    expect(readdirSync(shots)).toEqual(['fresh']);
  });

  it('does nothing without a shots folder, and leaves a stray file in it alone', () => {
    const { root } = makeRepo();
    expect(clearOldShots(root, Date.now())).toEqual([]);
    const shots = join(root, LOCAL_DIR, 'ask', 'shots');
    mkdirSync(shots, { recursive: true });
    writeFileSync(join(shots, 'note.txt'), 'x');
    utimesSync(join(shots, 'note.txt'), new Date(0), new Date(0));
    expect(clearOldShots(root, Date.now())).toEqual([]);
    expect(existsSync(join(shots, 'note.txt'))).toBe(true);
  });
});
