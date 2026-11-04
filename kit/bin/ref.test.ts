// PRD 2648, s1: `omni ref <issue> --title <t>`, through `main()` with a fake `gh`. No test calls GitHub.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const FORMAT = 'pr:\n  ref:\n    title: "[{ref}]-{title}"\n    none: "[NoRef]-{title}"\n    link: "https://tracker.example/{ref}"\n';
const TITLE = 'fix(planning): keep the day';

type Omni = { config?: string; body?: string | Error; target?: string | Error };

async function omni(argv: readonly string[], { config = `kit: 1\nrepo:\n  slug: acme/widgets\n${FORMAT}`, body = '', target = new Error('gh: Not Found (HTTP 404)') }: Omni = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const out: string[] = [];
  const err: string[] = [];
  const calls: string[][] = [];
  const exec = ((file: string, args: readonly string[], options?: unknown) => {
    if (file !== 'gh') return execFileSync(file, args, options as never);
    calls.push([...args]);
    // `gh api …/contents/.omni-loop/config.yml`: the target's committed config, raw.
    if (args[0] === 'api') {
      if (target instanceof Error) throw target;
      return target;
    }
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

  describe('--repo <owner/name>: a pull request opened in another repository (#2658)', () => {
    const TARGET = 'kit: 1\nrepo:\n  slug: acme/api\npr:\n  ref:\n    title: "[{ref}] {title}"\n    none: "[none] {title}"\n    link: "https://tickets.example/{ref}"\n';

    it("reads the marker on this repository's issue and formats with the target's committed pr.ref", async () => {
      const result = await omni(['ref', '12', '--title', TITLE, '--repo', 'acme/api'], { body: '<!-- omni-ref: ABC-123 -->', target: TARGET });
      expect(result).toMatchObject({ code: 0, out: `title: [ABC-123] ${TITLE}\nlink: https://tickets.example/ABC-123\n`, err: '' });
      expect(result.calls).toEqual([
        ['issue', 'view', '12', '--repo', 'acme/widgets', '--json', 'body'],
        ['api', '-H', 'Accept: application/vnd.github.raw', 'repos/acme/api/contents/.omni-loop/config.yml'],
      ]);
    });

    it("uses the target's none with no marker, never this repository's", async () => {
      const result = await omni(['ref', '12', '--title', TITLE, '--repo', 'acme/api'], { body: 'no marker', target: TARGET });
      expect(result.out).toBe(`title: [none] ${TITLE}\nlink: none\n`);
    });

    it('leaves the title unchanged for a target with no committed config, or with pr.ref null', async () => {
      const missing = await omni(['ref', '12', '--title', TITLE, '--repo', 'acme/api'], { body: '<!-- omni-ref: ABC-1 -->' });
      expect(missing).toMatchObject({ code: 0, out: `title: ${TITLE}\nlink: none\n` });
      const off = await omni(['ref', '12', '--title', TITLE, '--repo', 'acme/api'], { body: '<!-- omni-ref: ABC-1 -->', target: 'kit: 1\n' });
      expect(off).toMatchObject({ code: 0, out: `title: ${TITLE}\nlink: none\n` });
    });

    it('reads a target config written for another kit, leaving out the keys this kit does not know', async () => {
      const result = await omni(['ref', '12', '--title', 'x', '--repo', 'acme/api'], { body: '<!-- omni-ref: ABC-1 -->', target: `${TARGET}someFutureKey: true\n` });
      expect(result).toMatchObject({ code: 0, out: 'title: [ABC-1] x\nlink: https://tickets.example/ABC-1\n' });
    });

    it("exits 1 with one line when gh cannot read the target's config, or it does not read", async () => {
      const unreachable = await omni(['ref', '12', '--title', 'x', '--repo', 'acme/api'], { body: '<!-- omni-ref: ABC-1 -->', target: new Error('gh: HTTP 502') });
      expect(unreachable).toMatchObject({ code: 1, out: '', err: "omni ref: acme/api's .omni-loop/config.yml cannot be read through gh.\n" });
      const invalid = await omni(['ref', '12', '--title', 'x', '--repo', 'acme/api'], { body: '<!-- omni-ref: ABC-1 -->', target: 'kit: 1\npr:\n  ref:\n    title: "no placeholders"\n' });
      expect(invalid.code).toBe(1);
      expect(invalid.out).toBe('');
      expect(invalid.err).toMatch(/^omni ref: acme\/api:\.omni-loop\/config\.yml is not a valid Omni Loop config: pr\.ref\.title/);
    });

    it('is a usage error when --repo is not owner/name', async () => {
      const result = await omni(['ref', '12', '--title', 'x', '--repo', 'api']);
      expect(result.code).toBe(2);
      expect(result.err).toContain('--repo must be owner/name');
    });
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
