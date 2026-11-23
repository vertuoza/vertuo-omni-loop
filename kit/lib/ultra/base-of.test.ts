// PRD omni-loop-21, slice s4: `/omni:ultra-yolo --base-of <owner/repo>=<branch>,…` names, per target repository, the
// branch its target feature PR opens into (a mission's branch) in place of the target's default branch.
import { describe, expect, it } from 'vitest';
import { BASE_OF_FLAG, baseOfFlag, baseOfTarget, parseBaseOf, refusalLine, strayRepos } from './base-of.ts';

describe('parseBaseOf', () => {
  it('AC-2: reads one branch per repository, in the order given', () => {
    expect(parseBaseOf('acme/web=mission/7-x,acme/api=mission/7-x')).toEqual({
      ok: true,
      bases: [
        { repo: 'acme/web', branch: 'mission/7-x' },
        { repo: 'acme/api', branch: 'mission/7-x' },
      ],
    });
  });

  it('takes one repository alone, and a space after a comma', () => {
    expect(parseBaseOf('acme/web=mission/7-x')).toEqual({ ok: true, bases: [{ repo: 'acme/web', branch: 'mission/7-x' }] });
    expect(parseBaseOf('acme/web=mission/7-x, acme/api=release/2')).toEqual({
      ok: true,
      bases: [
        { repo: 'acme/web', branch: 'mission/7-x' },
        { repo: 'acme/api', branch: 'release/2' },
      ],
    });
  });

  it('refuses a value that names no repository', () => {
    expect(parseBaseOf('')).toEqual({ ok: false, error: 'names no repository' });
    expect(parseBaseOf(' , ')).toEqual({ ok: false, error: 'names no repository' });
  });

  it('refuses an entry that is not <owner/repo>=<branch>, naming it', () => {
    expect(parseBaseOf('acme/web')).toEqual({ ok: false, error: 'acme/web is not <owner/repo>=<branch>' });
    expect(parseBaseOf('acme/web=')).toEqual({ ok: false, error: 'acme/web= is not <owner/repo>=<branch>' });
    expect(parseBaseOf('=mission/7-x')).toEqual({ ok: false, error: '=mission/7-x is not <owner/repo>=<branch>' });
    expect(parseBaseOf('acme/web=mission/7-x,,acme/api=b')).toEqual({ ok: false, error: 'an empty entry is not <owner/repo>=<branch>' });
  });

  it('refuses a repository that is not an owner/name, naming it', () => {
    expect(parseBaseOf('web=mission/7-x')).toEqual({ ok: false, error: 'web is not an owner/name' });
    expect(parseBaseOf('acme/web/x=mission/7-x')).toEqual({ ok: false, error: 'acme/web/x is not an owner/name' });
    expect(parseBaseOf('acme /web=mission/7-x')).toEqual({ ok: false, error: 'acme /web is not an owner/name' });
  });

  it.each([
    'mission 7',
    '-mission',
    '/mission',
    'mission/',
    'mission.',
    'mission.lock',
    'mission..7',
    'mission//7',
    'mission/.7',
    '.mission',
    'mission@{1}',
    '@',
    'mission~1',
    'mission^',
    'mission:7',
    'mission?',
    'mission*',
    'mission[7]',
    'mission\\7',
    'mission=7',
    'mission\u00017',
    'mission\u007f',
  ])('refuses %j, which is no branch name', (branch) => {
    expect(parseBaseOf(`acme/web=${branch}`)).toEqual({ ok: false, error: `${branch} is not a branch name` });
  });

  it('takes the branch names a mission and a release give', () => {
    for (const branch of ['main', 'mission/12-a-roadmap', 'feat/omni-loop-21', 'release/1.2', 'a.b_c-d', 'x@y']) {
      expect(parseBaseOf(`acme/web=${branch}`)).toEqual({ ok: true, bases: [{ repo: 'acme/web', branch }] });
    }
  });

  it('refuses a repository named twice, whatever its case', () => {
    expect(parseBaseOf('acme/web=a,Acme/Web=b')).toEqual({ ok: false, error: 'Acme/Web is named twice' });
  });
});

describe('baseOfTarget', () => {
  const bases = [
    { repo: 'acme/web', branch: 'mission/7-x' },
    { repo: 'acme/api', branch: 'mission/7-y' },
  ];

  it('AC-2: a named repository opens into its branch', () => {
    expect(baseOfTarget(bases, 'acme/web', 'main')).toEqual({ base: 'mission/7-x', named: true });
    expect(baseOfTarget(bases, 'acme/api', 'trunk')).toEqual({ base: 'mission/7-y', named: true });
  });

  it('AC-2: a repository the line does not name keeps its default branch', () => {
    expect(baseOfTarget(bases, 'acme/docs', 'main')).toEqual({ base: 'main', named: false });
    expect(baseOfTarget([], 'acme/web', 'main')).toEqual({ base: 'main', named: false });
  });

  it('matches a repository whatever its case, as GitHub does', () => {
    expect(baseOfTarget(bases, 'ACME/Web', 'main')).toEqual({ base: 'mission/7-x', named: true });
  });
});

describe('strayRepos', () => {
  it('names each repository the flag names that is no target, in the order given', () => {
    const bases = [
      { repo: 'acme/web', branch: 'm' },
      { repo: 'acme/other', branch: 'm' },
      { repo: 'acme/api', branch: 'm' },
      { repo: 'acme/more', branch: 'm' },
    ];
    expect(strayRepos(bases, ['acme/API', 'acme/web'])).toEqual(['acme/other', 'acme/more']);
    expect(strayRepos(bases, [])).toEqual(['acme/web', 'acme/other', 'acme/api', 'acme/more']);
    expect(strayRepos([], ['acme/web'])).toEqual([]);
  });
});

describe('baseOfFlag', () => {
  it('writes the flag a mission sends, which parseBaseOf reads back', () => {
    const bases = [
      { repo: 'acme/web', branch: 'mission/7-x' },
      { repo: 'acme/api', branch: 'mission/7-x' },
    ];
    const flag = baseOfFlag(bases);
    expect(flag).toBe(`${BASE_OF_FLAG} acme/web=mission/7-x,acme/api=mission/7-x`);
    expect(parseBaseOf(flag.slice(BASE_OF_FLAG.length + 1))).toEqual({ ok: true, bases });
  });

  it('writes nothing for no repository, so a line without it keeps every base', () => {
    expect(baseOfFlag([])).toBe('');
  });
});

describe('refusalLine', () => {
  it('names the flag, the value and why, on one line', () => {
    expect(refusalLine('acme/web', 'acme/web is not <owner/repo>=<branch>')).toBe(
      '--base-of acme/web: acme/web is not <owner/repo>=<branch>',
    );
  });
});
