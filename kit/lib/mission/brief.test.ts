// The brief's schema (PRD 2842 s2): a mission.md's front matter read into its brief, every fault
// naming its field; and the page rules mission.html keeps.
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARALLEL, parseBrief } from './brief.ts';
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
        mission: 2850, title: 'Every quote can be paid online', fleet: 'night-shift',
        goal: 'Every quote can be paid online, for every customer.',
        measures: [{ sign: 'Quotes paid online', read: 'the payments report, weekly', target: 'three in ten within a month' }],
        scope: { prds: [2803, 2804], roadmaps: [12] },
        mandate: { parallel: 3 },
      },
    });
  });

  it('reads a one-line mission: one PRD, no measure, no roadmap, and the default mandate', () => {
    const lines = ['mission: 2851', 'title: Dark mode for quotes', 'fleet: night-shift', 'goal: Dark mode for quotes on site.', 'scope:', '  prds: [2803]'];
    const parsed = parseBrief(record(lines));
    expect(parsed.ok && parsed.brief).toMatchObject({ measures: [], scope: { prds: [2803], roadmaps: [] }, mandate: { parallel: DEFAULT_PARALLEL } });
    expect(DEFAULT_PARALLEL).toBe(2);
    // A mandate that names nothing keeps the default too.
    const empty = parseBrief(record([...lines, 'mandate: {}']));
    expect(empty.ok && empty.brief.mandate).toEqual({ parallel: 2 });
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
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: [2803, -4]'])))).toEqual(['scope.prds[2]: must be a positive whole number.']);
    expect(errorsOf(record(swap('scope', ['scope:', '  roadmaps: [12, 12]'])))).toEqual(['scope.roadmaps: names a roadmap twice.']);
    expect(errorsOf(record(swap('scope', ['scope:', '  prds: [2803]', '  bugs: [7]'])))).toEqual(['scope: unexpected field bugs.']);
    expect(errorsOf(record(swap('scope', [`scope:`, `  prds: [${Array.from({ length: 51 }, (_, k) => k + 1).join(', ')}]`]))))
      .toEqual(['scope.prds: holds 50 PRDs at most.']);
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
