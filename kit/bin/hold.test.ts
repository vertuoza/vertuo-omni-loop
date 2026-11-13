// `omni hold <owner/repo>#<n> [--json]` (PRD 2746, s1), through `main()` with a `gh` that answers from a
// table: the test that would have caught a consumer merged before its provider.
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { FakeExec } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: demo-org/web\n' };

type Gh = { consumer: string | Error; providers: Record<string, string | Error>; files?: Record<string, string | Error> };

/** `gh`'s failure on a file a repository does not hold. */
const notFound = () => Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });

/**
 * A `gh pr view <n> --repo <slug> --json <fields>` that answers the consumer's body and each provider's
 * state, and a `gh api … repos/<slug>/contents/<path>` that answers a provider's file from `files`, keyed
 * `<slug>:<path>`, a file it does not hold being GitHub's 404.
 */
function gh({ consumer, providers, files = {} }: Gh): FakeExec {
  return (file, args, options) => {
    if (file !== 'gh') return realExec(file, args, options);
    if (args[0] === 'api') return ghFile(files, args);
    if (args[0] !== 'pr' || args[1] !== 'view') throw new Error(`unexpected gh ${args.join(' ')}`);
    return args[6] === 'body' ? JSON.stringify({ body: answered(consumer) }) : providerState(answered(providers[`${args[4]}#${args[2]}`]));
  };
}

/** The answer given, thrown when it is an error or missing. */
function answered(answer: string | Error | undefined): string {
  if (answer === undefined) throw new Error('no answer');
  if (answer instanceof Error) throw answer;
  return answer;
}

/** A provider's `state,mergedAt,mergeCommit`, a merged one carrying its merge commit. */
function providerState(state: string): string {
  const merged = state === 'MERGED' ? { mergedAt: '2026-11-12T10:00:00Z', mergeCommit: { oid: 'abc123' } } : { mergedAt: null, mergeCommit: null };
  return JSON.stringify({ state, ...merged });
}

/** `gh api … repos/<slug>/contents/<path>`, answered from `files`. */
function ghFile(files: Record<string, string | Error>, args: readonly string[]): string {
  const match = /^repos\/([^/]+\/[^/]+)\/contents\/(.+)$/.exec(args.at(-1) ?? '');
  if (match === null) throw new Error(`unexpected gh ${args.join(' ')}`);
  const answer = files[`${match[1] ?? ''}:${match[2] ?? ''}`];
  if (answer === undefined) throw notFound();
  return answered(answer);
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

  describe('a merged provider whose config declares merge-after.served (s3)', () => {
    const PROBE = { 'demo-org/api:.omni-loop/config.yml': 'kit: 1\nflow:\n  hooks:\n    merge-after.served: { replace: .omni-loop/flow/served.md }\n' };
    const merged = (files: Record<string, string | Error>) => gh({ consumer: 'Merge after demo-org/api#41', providers: { 'demo-org/api#41': 'MERGED' }, files });

    it('names the probe to follow, exit 0, and runs nothing', async () => {
      const ran: string[] = [];
      const exec = merged({ ...PROBE, 'demo-org/api:.omni-loop/flow/served.md': 'Ask /version for {merge-sha}, for {consumer}.\n' });
      const { code, out } = await omni(['demo-org/web#88'], (file, args, options) => {
        if (file === 'gh') ran.push(args.slice(0, 2).join(' '));
        return exec(file, args, options);
      });
      expect(code).toBe(0);
      expect(lines(out)).toEqual([
        'demo-org/api#41 merged · probe demo-org/api:.omni-loop/flow/served.md probe',
        'probe: demo-org/api#41 follow demo-org/api:.omni-loop/flow/served.md',
      ]);
      expect(new Set(ran)).toEqual(new Set(['pr view', 'api -H']));
    });

    it('reads both files from the provider\'s default branch, raw, through gh api', async () => {
      const calls: string[][] = [];
      const exec = merged({ ...PROBE, 'demo-org/api:.omni-loop/flow/served.md': 'Check.' });
      await omni(['demo-org/web#88'], (file, args, options) => {
        if (file === 'gh' && args[0] === 'api') calls.push([...args]);
        return exec(file, args, options);
      });
      expect(calls).toEqual([
        ['api', '-H', 'Accept: application/vnd.github.raw', 'repos/demo-org/api/contents/.omni-loop/config.yml'],
        ['api', '-H', 'Accept: application/vnd.github.raw', 'repos/demo-org/api/contents/.omni-loop/flow/served.md'],
      ]);
    });

    it('hands each probe\'s text, its inputs filled, with --json', async () => {
      const { code, out } = await omni(['demo-org/web#88', '--json'], merged({ ...PROBE, 'demo-org/api:.omni-loop/flow/served.md': 'Ask /version for {merge-sha} of {provider} (PR {pr}), for {consumer}.\n' }));
      expect(code).toBe(0);
      const parsed = JSON.parse(out) as { rows: { probes?: unknown }[]; verdict: { kind: string } };
      expect(parsed.verdict.kind).toBe('probe');
      expect(parsed.rows[0]?.probes).toEqual([
        { hook: 'demo-org/api:.omni-loop/flow/served.md', mode: 'replace', text: 'Ask /version for abc123 of demo-org/api#41 (PR 41), for demo-org/web#88.\n' },
      ]);
    });

    it('never clears a probe file it cannot read', async () => {
      const { code, out } = await omni(['demo-org/web#88'], merged({ ...PROBE, 'demo-org/api:.omni-loop/flow/served.md': Object.assign(new Error('x'), { stderr: 'HTTP 403: Resource not accessible' }) }));
      expect(code).toBe(1);
      expect(lines(out).at(-1)).toBe('not judged: the probe .omni-loop/flow/served.md of demo-org/api cannot be read: HTTP 403: Resource not accessible');
    });

    it('never clears a probe the config names but the provider does not hold', async () => {
      const { code, out } = await omni(['demo-org/web#88'], merged(PROBE));
      expect(code).toBe(1);
      expect(lines(out).at(-1)).toBe('not judged: the probe .omni-loop/flow/served.md of demo-org/api cannot be read: it does not exist');
    });

    it('never clears a provider whose config it cannot read', async () => {
      const { code, out } = await omni(['demo-org/web#88'], merged({ 'demo-org/api:.omni-loop/config.yml': new Error('connect ETIMEDOUT') }));
      expect(code).toBe(1);
      expect(lines(out).at(-1)).toBe('not judged: could not read the config of demo-org/api: connect ETIMEDOUT');
    });

    it('reads no config of a provider that is not merged', async () => {
      const { code, out } = await omni(['demo-org/web#88'], gh({ consumer: 'Merge after demo-org/api#41', providers: { 'demo-org/api#41': 'OPEN' }, files: { 'demo-org/api:.omni-loop/config.yml': new Error('never read') } }));
      expect(code).toBe(1);
      expect(lines(out)).toEqual(['demo-org/api#41 open held', 'held: demo-org/api#41 it is not merged yet']);
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
