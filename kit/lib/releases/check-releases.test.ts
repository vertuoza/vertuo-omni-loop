// @ts-nocheck
// PRD 262, slice s1: the guard `omni check releases` runs — every release note in the inbox and the
// shipped folders, graded, each failure naming the file and the rule.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { findReleaseViolations, releaseNoteFiles, releaseNotePath } from './check-releases.ts';

const D = '.omni-loop/delivery';
const good = (prd, extra = '') => `---\nprd: ${prd}\ntitle: Jump between work and play in one tap\n${extra}---\nOne tap moves you between the reading pages and the game.\n`;

describe('releaseNotePath', () => {
  it('is release.md in the folder it is given', () => {
    expect(releaseNotePath(`${D}/inbox/0042-a`)).toBe(`${D}/inbox/0042-a/release.md`);
  });
});

describe('releaseNoteFiles', () => {
  it('lists the notes of the inbox and shipped folders, with their PRD, and nothing else', () => {
    const { ctx } = makeRepo({
      files: {
        [`${D}/inbox/0042-a/spec.md`]: 'x',
        [`${D}/inbox/0042-a/release.md`]: good(42),
        [`${D}/inbox/0043-b/spec.md`]: 'x',
        [`${D}/shipped/0007-c/release.md`]: good(7),
        [`${D}/outbox/0042-a/release.md`]: 'not a PRD folder of its own',
        [`${D}/shipped/notes/release.md`]: 'not a PRD folder',
        [`${D}/archive/0001-d/release.md`]: 'archived',
      },
    });
    expect(releaseNoteFiles({ ctx })).toEqual([
      { file: `${D}/inbox/0042-a/release.md`, prd: 42 },
      { file: `${D}/shipped/0007-c/release.md`, prd: 7 },
    ]);
  });

  it('is empty when there is no delivery folder', () => {
    expect(releaseNoteFiles({ ctx: makeRepo().ctx })).toEqual([]);
  });
});

describe('findReleaseViolations', () => {
  it('passes a repository with no note', () => {
    const { ctx } = makeRepo({ files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/shipped/0007-c/spec.md`]: 'x' } });
    expect(findReleaseViolations({ ctx })).toEqual([]);
  });

  it('passes a good note in the inbox and a pinned one in shipped', () => {
    const { ctx } = makeRepo({
      files: { [`${D}/inbox/0042-a/release.md`]: good(42), [`${D}/shipped/0007-c/release.md`]: good(7, 'version: 0.0.1\n') },
    });
    expect(findReleaseViolations({ ctx })).toEqual([]);
  });

  it('names the file and the rule of every failure, in both folders', () => {
    const { ctx } = makeRepo({
      files: {
        [`${D}/inbox/0042-a/release.md`]: good(12),
        [`${D}/shipped/0007-c/release.md`]: good(7, 'version: 0.0.2\nstatus: out\n'),
        [`${D}/shipped/0009-d/release.md`]: good(9).replace('One tap', 'See https://example.com — one tap'),
      },
    });
    expect(findReleaseViolations({ ctx })).toEqual([
      `${D}/inbox/0042-a/release.md: prd 12 is not its folder's number, 42`,
      `${D}/shipped/0007-c/release.md: front matter holds status, which a release note never carries — only prd, title and, optionally, version`,
      `${D}/shipped/0009-d/release.md: description holds a URL ("https://")`,
    ]);
  });

  it('follows paths.delivery', () => {
    const { ctx } = makeRepo({ config: { paths: { delivery: 'work' } }, files: { 'work/shipped/0007-c/release.md': good(8) } });
    expect(findReleaseViolations({ ctx })).toEqual(["work/shipped/0007-c/release.md: prd 8 is not its folder's number, 7"]);
  });
});
