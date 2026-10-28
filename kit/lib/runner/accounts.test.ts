// A runner's accounts (PRD 2537, s2): the file read and each malformed field refused with its account and
// field, no file giving the one Claude account, the states kept across a restart, an out account ready
// again at its reset time, and the choice of the account a job starts on. No test reads the real home.
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountBook, AccountsError, accountsStateFile, allowsSkill, chooseAccount, DEFAULT_HANDOFF, parseAccounts, readAccounts, readSecret } from './accounts.ts';
import type { Account } from './accounts.ts';

const FILE = `
accounts:
  - id: claude-1
    instance: claude-1
    model: claude-opus-5-5
  - id: open-1
    instance: opencode-mistral
    model: mistral/devstral-medium-latest
    budget: 20000000
    takes: [pr-care, plan, bug-fix]
  - id: claude-direct
    agent: claude
    secret: ~/.config/omni/secrets/claude-direct
handoff:
  usage: 85
  context: 70
`;

const refusal = (source: string): string => {
  try {
    parseAccounts(source);
  } catch (error) {
    if (error instanceof AccountsError) return error.message;
    throw error;
  }
  return 'accepted';
};

const one = (fields: string): string => `accounts:\n  - id: a\n${fields}`;
const home = (): string => mkdtempSync(join(tmpdir(), 'omni-accounts-'));

describe('the accounts file', () => {
  it('reads the accounts in the order of the file, with their agent, model, budget, takes and the thresholds', () => {
    const read = parseAccounts(FILE);
    expect(read.file).toBe(true);
    expect(read.handoff).toEqual({ usage: 85, context: 70 });
    expect(read.accounts.map((account) => [account.id, account.agent, account.instance])).toEqual([
      ['claude-1', 't3', 'claude-1'],
      ['open-1', 't3', 'opencode-mistral'],
      ['claude-direct', 'claude', null],
    ]);
    expect(read.accounts[1]).toMatchObject({ model: 'mistral/devstral-medium-latest', budget: 20_000_000, takes: ['pr-care', 'plan', 'bug-fix'] });
    expect(read.accounts[2]).toMatchObject({ secret: '~/.config/omni/secrets/claude-direct', model: null, takes: null });
  });

  it('gives the default thresholds when the file sets none', () => {
    expect(parseAccounts(one('    instance: x\n')).handoff).toEqual(DEFAULT_HANDOFF);
  });

  it.each([
    ['a takes skill outside RUNNABLE_SKILLS', one('    instance: x\n    takes: [deploy]\n'), 'account a: takes holds "deploy", which is not a skill a runner runs'],
    ['an empty takes', one('    instance: x\n    takes: []\n'), 'account a: takes must be a list of skills, one at least'],
    ['a budget that is not a whole positive number', one('    instance: x\n    budget: 1.5\n'), 'account a: budget must be a whole positive number of tokens a day'],
    ['a zero budget', one('    instance: x\n    budget: 0\n'), 'account a: budget must be a whole positive number of tokens a day'],
    ['neither an instance nor agent claude', one('    model: m\n'), 'account a: name an instance (a T3 provider instance) or agent: claude'],
    ['an instance with agent claude', one('    instance: x\n    agent: claude\n'), 'account a: agent claude runs without T3, so it takes no instance'],
    ['an agent that is neither', one('    agent: gpt\n'), 'account a: agent must be claude or t3, got "gpt"'],
    ['a secret on a T3 account', one('    instance: x\n    secret: /tmp/s\n'), "account a: secret is for a direct claude account; a T3 account's sign-in lives in T3"],
    ['a field it does not know', one('    instance: x\n    colour: red\n'), 'account a: colour is not a field of an account'],
    ['a model that is not text', one('    instance: x\n    model: 3\n'), 'account a: model must be a non-empty text'],
    ['an id that is not a name', 'accounts:\n  - id: "a b"\n    instance: x\n', 'account 1: id must be 1 to 40 letters, digits, dots, dashes or underscores'],
    ['an id used twice', 'accounts:\n  - id: a\n    instance: x\n  - id: a\n    instance: y\n', 'account a: id is used twice'],
    ['no accounts', 'accounts: []\n', 'accounts must be a list of one account at least'],
    ['a threshold under 50', `${one('    instance: x\n')}handoff:\n  usage: 40\n`, 'handoff: usage must be a whole percent from 50 to 99'],
    ['a threshold of 100', `${one('    instance: x\n')}handoff:\n  context: 100\n`, 'handoff: context must be a whole percent from 50 to 99'],
    ['a threshold it does not know', `${one('    instance: x\n')}handoff:\n  speed: 90\n`, 'handoff: speed is not a threshold (usage, context)'],
    ['a section it does not know', `${one('    instance: x\n')}pool: 3\n`, 'pool is not a section of the file (accounts, handoff)'],
    ['text that is not YAML', 'accounts: [', 'the file is not valid YAML'],
  ])('refuses %s, naming the account and the field', (_name, source, words) => {
    expect(refusal(source)).toBe(words);
  });
});

describe('reading the file from the home', () => {
  it('gives one account, claude run directly, when there is no file', () => {
    const read = readAccounts({ home: home() });
    expect(read.file).toBe(false);
    expect(read.accounts).toEqual([{ id: 'claude', agent: 'claude', instance: null, model: null, secret: null, budget: null, takes: null }]);
    expect(read.handoff).toEqual(DEFAULT_HANDOFF);
  });

  it('reads the file at ~/.config/omni/accounts.yml', () => {
    const seen: string[] = [];
    const read = readAccounts({ home: '/home/box', read: (path) => { seen.push(path); return FILE; } });
    expect(seen).toEqual(['/home/box/.config/omni/accounts.yml']);
    expect(read.accounts).toHaveLength(3);
  });

  it('refuses a file it cannot read, without a detail of the error', () => {
    expect(() => readAccounts({ home: '/h', read: () => { throw Object.assign(new Error('EACCES: secret path'), { code: 'EACCES' }); } })).toThrow('/h/.config/omni/accounts.yml cannot be read');
  });

  it('reads a secret from its file, trimmed, and gives an empty text when the file is missing', () => {
    const dir = home();
    mkdirSync(join(dir, 's'));
    writeFileSync(join(dir, 's', 'token'), 'sk-secret\n');
    expect(readSecret('~/s/token', dir)).toBe('sk-secret');
    expect(readSecret('~/nowhere', dir)).toBe('');
  });
});

describe('the states', () => {
  it('keeps an out account across a restart, readable by its user only, and makes it ready again at its reset time', () => {
    const file = accountsStateFile(home());
    let now = Date.parse('2026-10-28T10:00:00.000Z');
    const first = accountBook({ file, now: () => now });
    expect(first.stateOf('a')).toEqual({ state: 'ready', resetsAt: null });
    first.markOut('a', '2026-10-28T12:00:00.000Z');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const restarted = accountBook({ file, now: () => now });
    expect(restarted.stateOf('a')).toEqual({ state: 'out', resetsAt: '2026-10-28T12:00:00.000Z' });
    now = Date.parse('2026-10-28T12:00:00.000Z');
    expect(restarted.stateOf('a')).toEqual({ state: 'ready', resetsAt: null });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({});
  });

  it('reads an account with a job as active, shared by every job it runs', () => {
    const book = accountBook({ file: accountsStateFile(home()) });
    book.activate('a');
    book.activate('a');
    book.release('a');
    expect(book.stateOf('a').state).toBe('active');
    book.release('a');
    expect(book.stateOf('a').state).toBe('ready');
  });

  it("sees an account another process marked out (a job's turnover), and keeps both marks (PRD 2537, s3)", () => {
    const file = accountsStateFile(home());
    const now = Date.parse('2026-10-28T10:00:00.000Z');
    const runner = accountBook({ file, now: () => now });
    const job = accountBook({ file, now: () => now });
    expect(runner.stateOf('a').state).toBe('ready');
    job.markOut('a', '2026-10-28T12:00:00.000Z');
    expect(runner.stateOf('a')).toEqual({ state: 'out', resetsAt: '2026-10-28T12:00:00.000Z' });
    runner.markOut('b', '2026-10-28T13:00:00.000Z');
    const kept: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(kept).toEqual({ a: { state: 'out', resetsAt: '2026-10-28T12:00:00.000Z' }, b: { state: 'out', resetsAt: '2026-10-28T13:00:00.000Z' } });
  });

  it('starts every account ready when the state file does not parse', () => {
    const file = accountsStateFile(home());
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'not json');
    expect(accountBook({ file }).stateOf('a').state).toBe('ready');
  });
});

describe('the account a job starts on', () => {
  const account = (id: string, takes: readonly string[] | null = null): Account => ({ id, agent: 'claude', instance: null, model: null, secret: null, budget: null, takes });
  const book = (out: string[] = []) => {
    const kept = accountBook({ file: accountsStateFile(home()), now: () => 0 });
    for (const id of out) kept.markOut(id, '1970-01-01T01:00:00.000Z');
    return kept;
  };

  it('is the first in the file\'s order that is ready, allowed by takes and passed its check', () => {
    const accounts = [account('out'), account('narrow', ['plan']), account('broken'), account('good'), account('later')];
    const chosen = chooseAccount({ accounts, book: book(['out']), skill: 'yolo', unusable: (a) => (a.id === 'broken' ? 'not signed in' : null) });
    expect(chosen).toEqual({ account: account('good') });
  });

  it('keeps an account whose takes leaves out the skill, and a repository\'s own skill, away', () => {
    expect(allowsSkill(account('a', ['plan']), 'plan')).toBe(true);
    expect(allowsSkill(account('a', ['plan']), 'yolo')).toBe(false);
    expect(allowsSkill(account('a', ['plan']), null)).toBe(false);
    expect(allowsSkill(account('a'), null)).toBe(true);
  });

  it('says why none can take it, account by account', () => {
    const chosen = chooseAccount({ accounts: [account('out'), account('narrow', ['plan']), account('broken')], book: book(['out']), skill: 'yolo', unusable: () => 'T3 not running' });
    expect(chosen).toEqual({ none: 'no account can take this job: out is out until 1970-01-01T01:00:00.000Z; narrow does not take this skill; broken is unusable: T3 not running' });
  });
});
