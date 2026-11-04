// PRD 2648, s1: `omni ref <issue> --title <t>`, through `main()` with a fake `gh`. No test calls GitHub.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const FORMAT = 'pr:\n  ref:\n    title: "[{ref}]-{title}"\n    none: "[NoRef]-{title}"\n    link: "https://tracker.example/{ref}"\n';
const TITLE = 'fix(planning): keep the day';

async function omni(argv: readonly string[], { config = `kit: 1\nrepo:\n  slug: acme/widgets\n${FORMAT}`, body = '' }: { config?: string; body?: string | Error } = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const out: string[] = [];
  const err: string[] = [];
  const calls: string[][] = [];
  const exec = ((file: string, args: readonly string[], options?: unknown) => {
    if (file !== 'gh') return execFileSync(file, args, options as never);
    calls.push([...args]);
    if (body instanceof Error) throw body;
    return JSON.stringify({ body });
  }) as never;
  const code = await main(argv, { cwd: root, exec, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), calls };
}

describe('omni ref', () => {
  it('prints the title unchanged and link none with pr.ref null', async () => {
    const result = await omni(['ref', '12', '--title', 'fix: x'], { config: 'kit: 1\nrepo:\n  slug: acme/widgets\n', body: '<!-- omni-ref: ABC-123 -->' });
    expect(result).toMatchObject({ code: 0, out: 'title: fix: x\nlink: none\n', err: '' });
  });

  it('formats the title and the link from the issue marker, reading the issue through gh', async () => {
    const result = await omni(['ref', '12', '--title', TITLE], { body: 'Bug.\n<!-- omni-ref: ABC-123 -->' });
    expect(result).toMatchObject({ code: 0, out: `title: [ABC-123]-${TITLE}\nlink: https://tracker.example/ABC-123\n` });
    expect(result.calls).toEqual([['issue', 'view', '12', '--repo', 'acme/widgets', '--json', 'body']]);
  });

  it('prints an already formatted title unchanged', async () => {
    const result = await omni(['ref', '12', '--title', `[ABC-123]-${TITLE}`], { body: '<!-- omni-ref: ABC-123 -->' });
    expect(result.out).toBe(`title: [ABC-123]-${TITLE}\nlink: https://tracker.example/ABC-123\n`);
  });

  it('uses none with no marker, and leaves the title when none is null', async () => {
    expect((await omni(['ref', '12', '--title', TITLE], { body: 'no marker' })).out).toBe(`title: [NoRef]-${TITLE}\nlink: none\n`);
    const config = 'kit: 1\nrepo:\n  slug: acme/widgets\npr:\n  ref:\n    title: "[{ref}]-{title}"\n';
    expect((await omni(['ref', '12', '--title', TITLE], { config, body: 'no marker' })).out).toBe(`title: ${TITLE}\nlink: none\n`);
  });

  it('skips a malformed first marker for a later valid one', async () => {
    const result = await omni(['ref', '12', '--title', 'x'], { body: '<!-- omni-ref: ABC 123 -->\n<!-- omni-ref: DEF-4 -->' });
    expect(result.out).toMatch(/^title: \[DEF-4\]-x\n/);
  });

  it('prints { ref, title, link } with --json, ref null with no marker', async () => {
    const found = await omni(['ref', '12', '--title', 'x', '--json'], { body: '<!-- omni-ref: ABC-1 -->' });
    expect(JSON.parse(found.out)).toEqual({ ref: 'ABC-1', title: '[ABC-1]-x', link: 'https://tracker.example/ABC-1' });
    const none = await omni(['ref', '12', '--title', 'x', '--json'], { body: '' });
    expect(JSON.parse(none.out)).toEqual({ ref: null, title: '[NoRef]-x', link: null });
  });

  it('exits 1 with one line naming the issue when gh cannot read it', async () => {
    const result = await omni(['ref', '12', '--title', 'x'], { body: new Error('not found') });
    expect(result.code).toBe(1);
    expect(result.out).toBe('');
    expect(result.err).toBe('omni ref: issue #12 cannot be read through gh.\n');
  });

  it('is a usage error without an issue or a title', async () => {
    expect((await omni(['ref', '--title', 'x'])).code).toBe(2);
    expect((await omni(['ref', '12'])).code).toBe(2);
  });

  it('is described by omni help ref', async () => {
    const result = await omni(['help', 'ref']);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/omni ref <issue> --title/);
  });
});
