// `omni hold <owner/repo>#<n> [--json]` (PRD 2746, s1), through `main()` with a `gh` that answers from a
// table: the test that would have caught a consumer merged before its provider.
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { FakeExec } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: demo-org/web\n' };

type Gh = { consumer: string | Error; providers: Record<string, string | Error> };

/** A `gh pr view <n> --repo <slug> --json <fields>` that answers the consumer's body and each provider's state. */
function gh({ consumer, providers }: Gh): FakeExec {
  return (file, args, options) => {
    if (file !== 'gh') return realExec(file, args, options);
    if (args[0] !== 'pr' || args[1] !== 'view') throw new Error(`unexpected gh ${args.join(' ')}`);
    const answer = args[6] === 'body' ? consumer : providers[`${args[4]}#${args[2]}`];
    if (answer === undefined) throw new Error(`no answer for ${args.join(' ')}`);
    if (answer instanceof Error) throw answer;
    return args[6] === 'body' ? JSON.stringify({ body: answer }) : JSON.stringify({ state: answer, mergedAt: null, mergeCommit: null });
  };
}

async function omni(argv: string[], exec: FakeExec) {
  const { root } = makeRepo({ git: true, files: CONFIG });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['hold', ...argv], { cwd: root, env: {}, exec, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const lines = (text: string) => text.trimEnd().split('\n');

describe('omni hold', () => {
  it('holds a consumer whose provider is still open', async () => {
    const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: 'Needs the field.\n\nMerge after demo-org/api#41\n', providers: { 'demo-org/api#41': 'OPEN' } }));
    expect(code).toBe(1);
    expect(lines(out)).toEqual(['demo-org/api#41 open held', 'held: demo-org/api#41 it is not merged yet']);
  });

  it('clears a merged provider', async () => {
    const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: 'Merge after demo-org/api#41', providers: { 'demo-org/api#41': 'MERGED' } }));
    expect(code).toBe(0);
    expect(lines(out)).toEqual(['demo-org/api#41 merged · no probe clear', 'clear']);
  });

  it('fails a provider closed without merging', async () => {
    const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: 'Merge after demo-org/api#41', providers: { 'demo-org/api#41': 'CLOSED' } }));
    expect(code).toBe(1);
    expect(lines(out)).toEqual(['demo-org/api#41 closed, not merged fail', 'fail: demo-org/api#41 it was closed without merging']);
  });

  it('never counts a provider gh cannot read as clear', async () => {
    const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: 'Merge after demo-org/api#41', providers: { 'demo-org/api#41': new Error('HTTP 403') } }));
    expect(code).toBe(1);
    expect(lines(out).at(-1)).toBe('not judged: could not read demo-org/api#41: HTTP 403');
  });

  it('never counts a consumer gh cannot read as clear', async () => {
    const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: new Error('no sign-in'), providers: {} }));
    expect(code).toBe(1);
    expect(out.trimEnd()).toBe('not judged: could not read demo-org/web#88: no sign-in');
  });

  it('is clear with no Merge after line', async () => {
    const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: 'Just a change.', providers: {} }));
    expect(code).toBe(0);
    expect(out.trimEnd()).toBe('clear · no Merge after line');
  });

  it('gives one row per line in the body order, a line with no repository meaning the consumer\'s own', async () => {
    const providers = { 'demo-org/api#41': 'MERGED', 'demo-org/web#12': 'OPEN', 'demo-org/auth#7': 'MERGED' };
    const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: 'Merge after demo-org/auth#7\nMerge after #12\nMerge after demo-org/api#41', providers }));
    expect(code).toBe(1);
    expect(lines(out)).toEqual([
      'demo-org/auth#7 merged · no probe clear',
      'demo-org/web#12 open held',
      'demo-org/api#41 merged · no probe clear',
      'held: demo-org/web#12 it is not merged yet',
    ]);
  });

  it('prints the rows and the verdict as one object with --json', async () => {
    const { code, out } = await omni(['demo-org/web#88', '--json'], gh({ consumer: 'Merge after demo-org/api#41', providers: { 'demo-org/api#41': 'OPEN' } }));
    expect(code).toBe(1);
    expect(JSON.parse(out)).toEqual({
      consumer: 'demo-org/web#88',
      rows: [{ provider: 'demo-org/api#41', what: 'open', status: 'held', why: 'it is not merged yet' }],
      verdict: { kind: 'held', line: 'held: demo-org/api#41 it is not merged yet' },
    });
  });

  it('is a usage error without a pull request reference', async () => {
    const { code, err } = await omni(['88'], gh({ consumer: '', providers: {} }));
    expect(code).toBe(2);
    expect(err).toContain('usage: omni hold <owner/repo>#<n> [--json]');
  });

  it('has a help entry', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const out: string[] = [];
    const code = await main(['help', 'hold'], { cwd: root, env: {}, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => 0 } });
    expect(code).toBe(0);
    expect(out.join('')).toContain('omni hold <owner/repo>#<n> [--json]');
  });
});
