// The nightly mutation run's alert: one `Mutation: the nightly run is red` issue found by its title,
// opened on a red night and assigned to the laws' owners, a comment each later red night, a comment
// and a close once the floors hold again, and nothing on a green night with none open. Everything
// runs on an injected `gh` runner and reader; nothing here calls GitHub.
import { describe, expect, it } from 'vitest';
import { type Deps, keep, main, type Options, parseArgs, TITLE } from './mutation-alert.ts';

const RUN = 'https://github.com/acme/widgets/actions/runs/1';
const TABLE = '| module | score | floor | verdict |\n|---|---|---|---|\n| ids | 91.37 | 97 | below |\n';

/** A world of open issues and score files, every `gh` call recorded. */
function world(openIssues: { number: number; title: string }[] = [], files: Record<string, string> = { 'score.md': TABLE }) {
  const ghCalls: string[][] = [];
  const deps: Deps = {
    gh: (args) => {
      ghCalls.push(args);
      if (args.includes('--paginate')) return Promise.resolve(openIssues.map((open) => `${String(open.number)}\t${open.title}\n`).join(''));
      return Promise.resolve('');
    },
    read: (file) => files[file] ?? null,
  };
  const writes = () => ghCalls.filter((args) => args.includes('-X'));
  return { deps, writes };
}

const red: Options = { repo: 'acme/widgets', red: true, run: RUN, score: 'score.md', assign: ['owner-a', 'owner-b'] };
const green: Options = { ...red, red: false };

/** The values of `-f <name>=` in one gh call. */
function fields(args: string[], name: string): string[] {
  return args.filter((arg, k) => args[k - 1] === '-f' && arg.startsWith(`${name}=`)).map((arg) => arg.slice(name.length + 1));
}

describe('the arguments', () => {
  it('reads the repository, the state, the run, the score file and each owner to assign', () => {
    expect(parseArgs(['--repo', 'acme/widgets', '--state', 'red', '--run', RUN, '--score', 'score.md', '--assign', 'a', '--assign', 'b'])).toEqual({ ...red, assign: ['a', 'b'] });
    expect(parseArgs(['--repo', 'acme/widgets', '--state', 'green', '--run', RUN])).toEqual({ repo: 'acme/widgets', red: false, run: RUN, score: null, assign: [] });
  });

  it.each([
    [[]],
    [['--state', 'red', '--run', RUN]],
    [['--repo', 'acme', '--state', 'red', '--run', RUN]],
    [['--repo', 'acme/widgets', '--state', 'amber', '--run', RUN]],
    [['--repo', 'acme/widgets', '--state', 'red', '--run', 'http://x']],
    [['--repo', 'acme/widgets', '--state', 'red', '--run', RUN, '--assign']],
    [['--repo', 'acme/widgets', '--state', 'red', '--run', RUN, '--nope', 'x']],
  ])('refuses %j', (argv) => {
    expect(parseArgs(argv)).toBeNull();
  });
});

describe('a red night', () => {
  it('with no issue open, opens one titled exactly, with the run and the table, assigned to every owner', async () => {
    const { deps, writes } = world([{ number: 7, title: `${TITLE} (old)` }]);
    expect(await keep(red, deps)).toBe('red, opened an issue');
    const [open] = writes();
    expect(open).toBeDefined();
    if (!open) return;
    expect(open).toContain('repos/acme/widgets/issues');
    expect(fields(open, 'title')).toEqual([TITLE]);
    expect(fields(open, 'assignees[]')).toEqual(['owner-a', 'owner-b']);
    const [body] = fields(open, 'body');
    expect(body).toContain(RUN);
    expect(body).toContain('| ids | 91.37 | 97 | below |');
    expect(body).toContain('never lower the floor');
    expect(writes()).toHaveLength(1);
  });

  it('with one open, comments once on it, naming the run and the table, and opens none', async () => {
    const { deps, writes } = world([{ number: 41, title: TITLE }]);
    expect(await keep(red, deps)).toBe('red, commented on #41');
    expect(writes()).toHaveLength(1);
    const [comment] = writes();
    expect(comment).toContain('repos/acme/widgets/issues/41/comments');
    expect(fields(comment ?? [], 'body')[0]).toMatch(/^Still red\.\n\nRun: https:\/\/github\.com\/acme\/widgets\/actions\/runs\/1\n\n\| module/);
  });

  it('with no score table, says a shard did not finish', async () => {
    const { deps, writes } = world([], {});
    await keep(red, deps);
    expect(fields(writes()[0] ?? [], 'body')[0]).toContain('a shard did not finish');
  });
});

describe('a green night', () => {
  it('with one open, comments that the floors hold again, then closes it as completed', async () => {
    const { deps, writes } = world([{ number: 41, title: TITLE }]);
    expect(await keep(green, deps)).toBe('green, closed #41');
    const [comment, close] = writes();
    expect(comment).toContain('repos/acme/widgets/issues/41/comments');
    expect(fields(comment ?? [], 'body')[0]).toContain(RUN);
    expect(close).toContain('repos/acme/widgets/issues/41');
    expect(fields(close ?? [], 'state')).toEqual(['closed']);
    expect(fields(close ?? [], 'state_reason')).toEqual(['completed']);
  });

  it('with none open, writes nothing', async () => {
    const { deps, writes } = world();
    expect(await keep(green, deps)).toBe('green');
    expect(writes()).toEqual([]);
  });
});

describe('main', () => {
  it('says what it did and exits 0', async () => {
    const said: string[] = [];
    expect(await main(['--repo', 'acme/widgets', '--state', 'green', '--run', RUN], world().deps, (line) => said.push(line))).toBe(0);
    expect(said).toEqual(['mutation-alert: green']);
  });

  it('exits 1 with its usage on bad arguments, calling gh not at all', async () => {
    const said: string[] = [];
    const { deps, writes } = world();
    expect(await main(['--state', 'red'], deps, (line) => said.push(line))).toBe(1);
    expect(said[0]).toMatch(/^mutation-alert: needs --repo/);
    expect(writes()).toEqual([]);
  });

  it('exits 1 naming the error when gh fails, so the alert is not lost', async () => {
    const said: string[] = [];
    const deps: Deps = { gh: () => Promise.reject(new Error('HTTP 403')), read: () => null };
    expect(await main(['--repo', 'acme/widgets', '--state', 'red', '--run', RUN], deps, (line) => said.push(line))).toBe(1);
    expect(said).toEqual(['mutation-alert: gh failed: HTTP 403']);
  });
});
