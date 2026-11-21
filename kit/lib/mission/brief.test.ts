// The brief's schema (PRD 2842 s2): a mission.md's front matter read into its brief, every fault
// naming its field; and the page rules mission.html keeps.
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARALLEL, DEFAULT_RESUMES, OMNI_BUGS_REPOSITORY_REFUSAL, levelRefusal, parseBrief, repositoryRefusal } from './brief.ts';
import { PAGE_MAX_BYTES, pageFaults } from './page.ts';

const FRONT = [
  'mission: 2850',
  'title: Every quote can be paid online',
  'fleet: night-shift',
  'goal: Every quote can be paid online, for every customer.',
  'measures:',
  '  - sign: Quotes paid online',
  '    read: the payments report, weekly',
  '    target: three in ten within a month',
  'scope:',
  '  prds: [2803, 2804]',
  '  roadmaps: [12]',
  'mandate:',
  '  parallel: 3',
];

const record = (lines: readonly string[] = FRONT, body = '\n# Every quote can be paid online\n') => `---\n${lines.join('\n')}\n---\n${body}`;
/** The front matter with `key`'s lines (the line naming it and those indented under it) replaced by `lines`. */
function swap(key: string, lines: readonly string[]): string[] {
  const at = FRONT.findIndex((line) => line.startsWith(`${key}:`));
  let end = at + 1;
  while (end < FRONT.length && FRONT[end]?.startsWith(' ')) end += 1;
  return [...FRONT.slice(0, at), ...lines, ...FRONT.slice(end)];
}
const errorsOf = (text: string): string[] => {
  const parsed = parseBrief(text);
  return parsed.ok ? [] : parsed.errors;
};

describe('a mission.md, read through the brief\'s schema', () => {
  it('reads every field of a full brief', () => {
    expect(parseBrief(record())).toEqual({
      ok: true,
      brief: {
        mission: 2850, kind: 'prds', title: 'Every quote can be paid online', fleet: 'night-shift',
        goal: 'Every quote can be paid online, for every customer.',
        measures: [{ sign: 'Quotes paid online', read: 'the payments report, weekly', target: 'three in ten within a month' }],
        scope: { prds: [2803, 2804], roadmaps: [12] },
        mandate: { parallel: 3, level: 'with-you', hardToRevert: 0.6, ownPrds: 0, resumes: 3 },
      },
    });
  });

  it('reads a one-line mission: one PRD, no measure, no roadmap, and the default mandate', () => {
    const lines = ['mission: 2851', 'title: Dark mode for quotes', 'fleet: night-shift', 'goal: Dark mode for quotes on site.', 'scope:', '  prds: [2803]'];
    const parsed = parseBrief(record(lines));
    expect(parsed.ok && parsed.brief).toMatchObject({ measures: [], scope: { prds: [2803], roadmaps: [] }, mandate: { parallel: DEFAULT_PARALLEL, level: 'with-you', hardToRevert: 0.6, ownPrds: 0 } });
    expect(DEFAULT_PARALLEL).toBe(2);
    // A mandate that names nothing keeps the default too.
    const empty = parseBrief(record([...lines, 'mandate: {}']));
    expect(empty.ok && empty.brief.mandate).toEqual({ parallel: 2, level: 'with-you', hardToRevert: 0.6, ownPrds: 0, resumes: 3 });
  });

  it('reads roadmaps alone as a scope', () => {
    const parsed = parseBrief(record(swap('scope', ['scope:', '  roadmaps: [12, 14]'])));
    expect(parsed.ok && parsed.brief.scope).toEqual({ prds: [], roadmaps: [12, 14] });
  });

  it('refuses a file with no front matter, or front matter that is not YAML key: value lines', () => {
    expect(errorsOf('# A mission\n')).toEqual(['no front matter: a mission.md opens with a "---" fenced header.']);
    expect(errorsOf('---\n- one\n- two\n---\n')).toEqual(['front matter is not YAML key: value lines.']);
    expect(errorsOf('---\nmission: [2850\n---\n')[0]).toMatch(/^front matter is not YAML: /);
  });

  it('names each missing field', () => {
    expect(errorsOf(record(FRONT.filter((line) => !/^(fleet|goal):/.test(line))))).toEqual(['fleet: missing.', 'goal: missing.']);
    expect(errorsOf(record(swap('scope', [])))).toEqual(['scope: missing.']);
  });

  it('refuses a mission number that is not a positive whole number', () => {
    expect(errorsOf(record(swap('mission', ['mission: 0'])))).toEqual(['mission: must be a positive whole number.']);
    expect(errorsOf(record(swap('mission', ['mission: "2850"'])))).toEqual(['mission: must be a positive whole number.']);
  });

  it('refuses an empty or long title and goal, and a fleet that is no fleet key', () => {
    expect(errorsOf(record(swap('title', ['title: "  "'])))).toEqual(['title: is empty.']);
    expect(errorsOf(record(swap('goal', [`goal: ${'g'.repeat(501)}`])))).toEqual(['goal: is over 500 characters.']);
    expect(errorsOf(record(swap('fleet', ['fleet: Night Shift'])))).toEqual(["fleet: is not a fleet's key (lowercase, dashes between words)."]);
  });

  it('refuses a sixth measure, and a measure missing its target or holding another field, naming it from 1', () => {
    const six = Array.from({ length: 6 }, (_, k) => [`  - sign: Sign ${k}`, '    read: weekly', '    target: one'].join('\n'));
    expect(errorsOf(record(swap('measures', ['measures:', ...six])))).toEqual(['measures: holds 5 at most.']);
    expect(errorsOf(record(swap('measures', ['measures:', '  - sign: Paid', '    read: weekly'])))).toEqual(['measures[1].target: missing.']);
    expect(errorsOf(record(swap('measures', ['measures:', '  - sign: Paid', '    read: weekly', '    target: one', '    owner: Ada']))))
      .toEqual(['measures[1]: unexpected field owner.']);
    expect(errorsOf(record(swap('measures', ['measures: three'])))).toEqual(['measures: must be a list.']);
  });

  it('refuses a scope of nothing, a PRD named twice, a number that is none, and an unknown list', () => {
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: []'])))).toEqual(['scope: names no PRD and no roadmap: one at least.']);
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: [2803, 2803]'])))).toEqual(['scope.prds: names a PRD twice.']);
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: [2803, -4]'])))).toEqual(['scope.prds[2]: must be a positive whole number or a product PRD id (omni-loop-15), not -4.']);
    expect(errorsOf(record(swap('scope', ['scope:', '  roadmaps: [12, 12]'])))).toEqual(['scope.roadmaps: names a roadmap twice.']);
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: [2803]', '  bugs: [7]'])))).toEqual(['scope: unexpected field bugs.']);
    expect(errorsOf(record(swap('scope', [`scope:`, `  prds: [${Array.from({ length: 51 }, (_, k) => k + 1).join(', ')}]`]))))
      .toEqual(['scope.prds: holds 50 PRDs at most.']);
  });

  it('reads the level and the two bounds under it, and refuses any other value by name (PRD 2896)', () => {
    const mandate = (...lines: string[]) => record(swap('mandate', ['mandate:', '  parallel: 3', ...lines.map((line) => `  ${line}`)]));
    const read = parseBrief(mandate('level: alone', 'hardToRevert: 0.8', 'ownPrds: 4'));
    expect(read.ok && read.brief.mandate).toEqual({ parallel: 3, level: 'alone', hardToRevert: 0.8, ownPrds: 4, resumes: 3 });
    expect(errorsOf(mandate('level: on-its-own'))).toEqual(['mandate.level: is one of with-you, own-branch, alone.']);
    expect(errorsOf(mandate('hardToRevert: 1.2'))).toEqual(['mandate.hardToRevert: is 0 to 1.']);
    expect(errorsOf(mandate('hardToRevert: -0.1'))).toEqual(['mandate.hardToRevert: is 0 to 1.']);
    expect(errorsOf(mandate('ownPrds: 11'))).toEqual(['mandate.ownPrds: is 0 to 10.']);
    expect(errorsOf(mandate('ownPrds: 2.5'))).toEqual(['mandate.ownPrds: must be a whole number.']);
    expect(errorsOf(mandate('ownPrds: many'))).toEqual(['mandate.ownPrds: must be a number.']);
  });

  it('refuses a mandate outside 1 to 4, or one naming another rule', () => {
    expect(errorsOf(record(swap('mandate', ['mandate:', '  parallel: 5'])))).toEqual(['mandate.parallel: is 1 to 4.']);
    expect(errorsOf(record(swap('mandate', ['mandate:', '  parallel: 0'])))).toEqual(['mandate.parallel: is 1 to 4.']);
    expect(errorsOf(record(swap('mandate', ['mandate:', '  parallel: 1.5'])))).toEqual(['mandate.parallel: must be a whole number.']);
    expect(errorsOf(record(swap('mandate', ['mandate:', '  parallel: 2', '  merge: true'])))).toEqual(['mandate: unexpected field merge.']);
  });

  it('refuses a field the brief does not hold', () => {
    expect(errorsOf(record([...FRONT, 'status: running']))).toEqual(['unexpected field status.']);
  });
});

describe('a mission.html, under the page rules', () => {
  it('keeps them: self-contained, under the cap, a link a person follows allowed', () => {
    expect(pageFaults('m/mission.html', '<!doctype html><title>Paid online</title><a href="https://example.com/pr/1">the PR</a>')).toEqual([]);
  });

  it('names what it loads from the network', () => {
    expect(pageFaults('m/mission.html', '<script src="https://cdn.example.com/x.js"></script>'))
      .toEqual(['m/mission.html: loads from the network: <script src> https://cdn.example.com/x.js; inline it, and keep only links a person follows.']);
  });

  it('names a page over the cap', () => {
    const page = `<p>${'x'.repeat(PAGE_MAX_BYTES)}</p>`;
    expect(pageFaults('m/mission.html', page)).toEqual([`m/mission.html: ${page.length} bytes, over the 512 KiB a page holds.`]);
  });
});

describe('product ids, several repositories and resumes (PRD omni-loop-21 s1)', () => {
  it('AC-1: reads product PRD ids and product roadmap ids beside repository numbers', () => {
    const parsed = parseBrief(record(swap('scope', ['scope:', '  prds: [2896, "omni-loop-15"]', '  roadmaps: ["omni-loop-R3", 12]'])));
    expect(parsed.ok && parsed.brief.scope).toEqual({ prds: [2896, 'omni-loop-15'], roadmaps: ['omni-loop-R3', 12] });
  });

  it('AC-1: refuses a key with no number, naming the value', () => {
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: [2896, "omni-loop"]']))))
      .toEqual(['scope.prds[2]: must be a positive whole number or a product PRD id (omni-loop-15), not "omni-loop".']);
    expect(errorsOf(record(swap('scope', ['scope:', '  roadmaps: ["omni-loop-R"]']))))
      .toEqual(['scope.roadmaps[1]: must be a positive whole number or a product roadmap id (omni-loop-R3), not "omni-loop-R".']);
  });

  it('refuses a product id named twice', () => {
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: ["omni-loop-15", "omni-loop-15"]'])))).toEqual(['scope.prds: names a PRD twice.']);
  });

  it('lists every repository the scope touches, and reads them at own-branch and alone', () => {
    const repositories = ['repositories:', '  - vertuoza/a', '  - vertuoza/b'];
    for (const level of ['own-branch', 'alone']) {
      const parsed = parseBrief(record([...swap('mandate', ['mandate:', `  level: ${level}`]), ...repositories]));
      expect(parsed.ok && parsed.brief).toMatchObject({ repositories: ['vertuoza/a', 'vertuoza/b'], mandate: { level } });
    }
    const none = parseBrief(record());
    expect(none.ok && 'repositories' in none.brief).toBe(false);
  });

  it('refuses a repository that is not owner/name, or named twice', () => {
    expect(errorsOf(record([...FRONT, 'repositories:', '  - vertuo-omni-loop']))).toEqual(['repositories[1]: is not owner/name.']);
    expect(errorsOf(record([...FRONT, 'repositories:', '  - vertuoza/a', '  - vertuoza/a']))).toEqual(['repositories: names a repository twice.']);
  });

  it('reads mandate.resumes from 0 to 10, 3 when not given', () => {
    const mandate = (value: string) => parseBrief(record(swap('mandate', ['mandate:', '  parallel: 3', `  resumes: ${value}`])));
    expect(mandate('0').ok && (mandate('0') as { brief: { mandate: { resumes: number } } }).brief.mandate.resumes).toBe(0);
    expect(DEFAULT_RESUMES).toBe(3);
    expect(errorsOf(record(swap('mandate', ['mandate:', '  resumes: 11'])))).toEqual(['mandate.resumes: is 0 to 10.']);
    expect(errorsOf(record(swap('mandate', ['mandate:', '  resumes: 1.5'])))).toEqual(['mandate.resumes: must be a whole number.']);
  });
});

describe('levelRefusal (PRD 2896 s14)', () => {
  it('refuses own-branch in a plan repository only', () => {
    expect(levelRefusal('own-branch', true)).toBe('a mission branch holds one repository: use with-you or alone');
    expect(levelRefusal('own-branch', false)).toBeNull();
    expect(levelRefusal('alone', true)).toBeNull();
    expect(levelRefusal('with-you', true)).toBeNull();
  });
});

describe('a brief\'s kind (PRD 3088)', () => {
  const BUGS = ['mission: 3100', 'title: The Omni Loop bug team', 'fleet: night-shift', 'goal: Fix the Omni Loop bugs missions report', 'kind: omni-bugs'];

  it('reads prds when the kind is absent', () => {
    const parsed = parseBrief(record());
    expect(parsed.ok && parsed.brief.kind).toBe('prds');
  });

  it('reads an omni-bugs brief with no scope, and with an empty one', () => {
    for (const lines of [BUGS, [...BUGS, 'scope:', '  prds: []']]) {
      const parsed = parseBrief(record(lines));
      expect(parsed.ok && parsed.brief).toMatchObject({ kind: 'omni-bugs', measures: [], scope: { prds: [], roadmaps: [] }, mandate: { parallel: 2, level: 'with-you' } });
    }
  });

  it('still refuses a prds brief with an empty or missing scope, and an unknown kind', () => {
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: []'])))).toEqual(['scope: names no PRD and no roadmap: one at least.']);
    expect(errorsOf(record(swap('scope', [])))).toEqual(['scope: missing.']);
    expect(errorsOf(record([...FRONT, 'kind: prds']))).toEqual([]);
    expect(errorsOf(record([...FRONT, 'kind: bugs']))).toEqual(['kind: is one of prds, omni-bugs.']);
  });

  it('refuses an omni-bugs brief that names a PRD', () => {
    expect(errorsOf(record([...BUGS, 'scope:', '  prds: [2803]']))).toEqual(['scope: is empty for an omni-bugs mission.']);
  });

  it('refuses an omni-bugs brief off the Omni Loop repository, naming why', () => {
    const omni = 'vertuoza/vertuo-omni-loop';
    expect(OMNI_BUGS_REPOSITORY_REFUSAL).toBe('Only the Omni Loop repository runs the Omni Loop bug team');
    expect(repositoryRefusal('omni-bugs', 'acme/shop-app', omni)).toBe(OMNI_BUGS_REPOSITORY_REFUSAL);
    expect(repositoryRefusal('omni-bugs', 'Vertuoza/Vertuo-Omni-Loop', omni)).toBeNull();
    expect(repositoryRefusal('prds', 'acme/shop-app', omni)).toBeNull();
  });
});
