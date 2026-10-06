// PRD 262, slice s1: `omni check releases`, and `omni check all` running it, through `main()` on a
// fixture repository.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const D = '.omni-loop/delivery';
const SPEC = (prd: number) => `---\nprd: ${prd}\ntitle: A\nblocked-by: none\nspec: file\n---\n\nBody.\n`;
const NOTE = (prd: number, title = 'Jump between work and play in one tap') =>
  `---\nprd: ${prd}\ntitle: ${title}\n---\nOne tap moves you between the reading pages and the game.\n`;

/** Runs `omni <argv>` in `root`: `{ code, out, err }`. */
async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni check releases', () => {
  it('passes a repository with no note', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [`${D}/inbox/0042-a/spec.md`]: SPEC(42) } });
    expect(await omni(root, ['check', 'releases'])).toEqual({ code: 0, out: 'check releases — 0 release note(s), all well-formed.\n', err: '' });
  });

  it('passes good notes in the inbox and in shipped, counting them', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        [`${D}/inbox/0042-a/spec.md`]: SPEC(42),
        [`${D}/inbox/0042-a/release.md`]: NOTE(42),
        [`${D}/shipped/0007-b/spec.md`]: SPEC(7),
        [`${D}/shipped/0007-b/release.md`]: NOTE(7).replace('---\nOne', 'version: 0.0.1\n---\nOne'),
      },
    });
    expect(await omni(root, ['check', 'releases'])).toMatchObject({ code: 0, out: 'check releases — 2 release note(s), all well-formed.\n' });
  });

  it('grades a note not yet committed', async () => {
    const { root, write } = makeRepo({ git: true, files: { ...CONFIG, [`${D}/inbox/0042-a/spec.md`]: SPEC(42) } });
    write(`${D}/inbox/0042-a/release.md`, NOTE(42, 'Shipped in PRD 42'));
    const { code, out } = await omni(root, ['check', 'releases']);
    expect(code).toBe(1);
    expect(out).toBe(
      `check releases — a release note does not hold what it claims:\n  ${D}/inbox/0042-a/release.md: title names a PRD number ("PRD 42")\n`,
    );
  });

  it('fails naming the file and the rule of each broken note (acceptance criterion 8)', async () => {
    const broken = [
      ['0010-a', NOTE(10, 'A'.repeat(61)), 'title is 61 characters — 60 at most'],
      ['0011-b', NOTE(11).replace('One tap', 'See https://example.com and one tap'), 'description holds a URL ("https://")'],
      ['0012-c', NOTE(12).replace('One tap', 'After #12, one tap'), 'description holds a reference ("#12")'],
      ['0013-d', NOTE(13).replace('One tap', 'With `omni`, one tap'), 'description holds a backtick'],
      ['0014-e', NOTE(14).replace('---\nOne', 'version: 0.0.2\n---\nOne'), "version 0.0.2 is not 0.0.1 — only the initial release's notes carry a version"],
      ['0015-f', NOTE(16), "prd 16 is not its folder's number, 15"],
    ];
    for (const [folder, text, rule] of broken) {
      const { root } = makeRepo({ git: true, files: { ...CONFIG, [`${D}/shipped/${folder}/release.md`]: text } });
      const { code, out } = await omni(root, ['check', 'releases']);
      expect(code, folder).toBe(1);
      expect(out, folder).toContain(`  ${D}/shipped/${folder}/release.md: ${rule}\n`);
    }
  });

  it('is run by omni check all, which goes red on a broken note', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [`${D}/inbox/0042-a/spec.md`]: SPEC(42), [`${D}/inbox/0042-a/release.md`]: NOTE(42) } });
    const green = await omni(root, ['check', 'all']);
    expect(green.code).toBe(0);
    expect(green.out).toMatch(/^check releases — 1 release note\(s\), all well-formed\.$/m);

    const { root: red } = makeRepo({ git: true, files: { ...CONFIG, [`${D}/inbox/0042-a/spec.md`]: SPEC(42), [`${D}/inbox/0042-a/release.md`]: NOTE(43) } });
    const refused = await omni(red, ['check', 'all']);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain(`  ${D}/inbox/0042-a/release.md: prd 43 is not its folder's number, 42\n`);
  });

  it('names releases among the guards when the guard is unknown', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, err } = await omni(root, ['check', 'release']);
    expect(code).toBe(2);
    expect(err).toMatch(/usage: omni check \[[^\]]*\breleases\b[^\]]*\]/);
  });
});
