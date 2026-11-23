// PRD omni-loop-21, slice s14 (AC-9): when `/omni:drive --roadmap <key>-R<n>` parks or `/omni:ultra-yolo <key>-<n>`
// stops on a person, its line ends with the one command that hands the work to a fleet, `/omni:mission --roadmap
// <key>-R<n> --level alone` or `/omni:mission --prd <key>-<n> --level alone`. Both skills keep parking and stopping as
// before: they never start the mission, which stays the Start button on its page. Read here against the SKILL.md text,
// and against the mission skill's own inputs, so the offered line cannot name a flag `/omni:mission` does not take.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text: string, start: string) {
  const lines = text.split('\n');
  let fenced = false;
  let from = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      if (from >= 0) return lines.slice(from, index).join('\n');
      if (line.startsWith(`## ${start}`)) from = index;
    }
  }
  return from < 0 ? '' : lines.slice(from).join('\n');
}

const ROADMAP_LINE = '/omni:mission --roadmap <key>-R<n> --level alone';
const PRD_LINE = '/omni:mission --prd <key>-<n> --level alone';

const DRIVE = read('drive');
const DRIVE_PRODUCT = flat(section(DRIVE, 'From a product roadmap'));
const YOLO_PRODUCT = flat(section(read('ultra-yolo'), 'From a product'));
const MISSION_INPUT = flat(section(read('mission'), 'Input'));

describe('/omni:drive --roadmap <key>-R<n> offers the mission (PRD omni-loop-21, AC-9)', () => {
  it('ends every park line of the roadmap or a row with the mission line for the roadmap', () => {
    expect(DRIVE_PRODUCT).toContain(`<why> · <link> · or hand it to a fleet: ${ROADMAP_LINE}`);
    expect(DRIVE_PRODUCT).toContain('ends with the one command that hands the roadmap to a fleet');
  });

  it('names the parks it ends: no plan on the page, approval, drift, answers, the roadmap itself', () => {
    expect(DRIVE_PRODUCT).toContain('a row whose PRD has no plan on its page');
    expect(DRIVE_PRODUCT).toContain('waits for approval, is drifted or refused');
    expect(DRIVE_PRODUCT).toContain('waits on answers on `<product> › Questions`');
    expect(DRIVE_PRODUCT).toContain('the roadmap itself waiting for approval');
  });

  it('ends the stop list the same way, and offers nothing on a wait or a hold', () => {
    expect(DRIVE_PRODUCT).toContain("Step 5's stop list ends each parked row's line the same way");
    expect(DRIVE_PRODUCT).toContain('A `wait` (the server unreachable) and a `hold` (a blocker not merged yet) offer nothing');
  });

  it('keeps parking as before and never starts the mission', () => {
    expect(DRIVE_PRODUCT).toContain('Drive still parks as before and never runs `/omni:mission`');
    expect(DRIVE_PRODUCT).toContain('starting the mission stays the Start button on its page, pressed by a person');
  });
});

describe('/omni:ultra-yolo <key>-<n> offers the mission (PRD omni-loop-21, AC-9)', () => {
  it('ends its stop line on a person with the mission line for the PRD', () => {
    expect(YOLO_PRODUCT).toContain(`<stop line> · or hand it to a fleet: ${PRD_LINE}`);
  });

  it('names the stops it ends: no plan, approval, drift, refusal, a red gate', () => {
    expect(YOLO_PRODUCT).toContain(
      'no plan on its page, still waiting for approval (`held: PRD <key>-<n> still waits for approval …`), drifted, refused, or its gate ended red',
    );
  });

  it('keeps the ending\'s last line, offers nothing on a stop no person resolves, and never starts the mission', () => {
    expect(YOLO_PRODUCT).toContain('The reply\'s last line stays the ending\'s own');
    expect(YOLO_PRODUCT).toContain('A stop no person resolves (`server unreachable · held, not failed`, a target\'s CI not green) offers nothing');
    expect(YOLO_PRODUCT).toContain('never runs `/omni:mission`: starting the mission stays the Start button on its page, pressed by a person');
  });
});

describe('the offered line is one /omni:mission takes', () => {
  it('takes a product roadmap, a product PRD and the level alone', () => {
    expect(MISSION_INPUT).toContain('`--roadmap <n>` or `--roadmap <key>-R<n>`');
    expect(MISSION_INPUT).toContain('`--prd <n>` or `--prd <key>-<n>`');
    expect(MISSION_INPUT).toContain('`with-you`, `own-branch` or `alone`');
  });
});
