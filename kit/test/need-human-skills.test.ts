// PRD 2255, slice s2: `/omni:bug-fix` and `/omni:mega-bug-fix`, run on a runner (`OMNI_UNATTENDED` set), ask the
// person on their job at the stop for a decision, with `omni runner ask`, and a run with `--answers <job>`
// reads what was answered with `omni runner answers`. Each point of the slice's "done when" is read here
// against both SKILL.md files: the markers, the two commands, the fallback and the `--answers` flag.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ASK = 'node .omni-loop/bin/omni.mjs runner ask --file <questions file> --issue <n> --lead <lead file>';
const ANSWERS = 'node .omni-loop/bin/omni.mjs runner answers <job>';

/** The two skills, with the brainstorm line each hands over and the heading of the step that stops on it. */
const SKILLS = [
  { name: 'bug-fix', brainstorm: '/omni:brainstorm', stop: '4. The boundary' },
  { name: 'mega-bug-fix', brainstorm: '/omni:mega-brainstorm', stop: '6. The boundary' },
] as const;

const read = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');

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

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The last non-blank line of a section's last fenced block, or null when it has none. */
function lastFencedLine(text: string) {
  let open = false;
  let block: string[] = [];
  let last: string | null = null;
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) {
      if (open) last = block.filter((row) => row.trim() !== '').at(-1)?.trim() ?? null;
      open = !open;
      block = [];
    } else if (open) block.push(line);
  }
  return last;
}

/** The first of `needles` that `text` lacks, or holds before the one ahead of it; `null` when all are there in order. */
function firstGap(text: string, needles: readonly string[]) {
  let at = 0;
  for (const needle of needles) {
    const found = text.indexOf(needle, at);
    if (found < 0) return needle;
    at = found + needle.length;
  }
  return null;
}

describe.each(SKILLS)('/omni:$name asks on a runner, and resumes with the answers (PRD 2255)', ({ name, brainstorm, stop }) => {
  const text = read(name);
  const asking = flat(section(text, 'Asking on a runner'));
  const resuming = flat(section(text, 'Resuming with answers'));

  it('takes --answers <job>, in its description and its input table, and tells where to read the resume', () => {
    const description = /^description: (.*)$/m.exec(text)?.[1] ?? '';
    expect(description).toContain('--answers <job>');
    expect(description).toContain('omni runner ask');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:/);
    const input = flat(section(text, 'Input'));
    expect(input).toContain('`--answers <job>`');
    expect(input).toContain('**Resuming with answers**');
  });

  it('asks only on a runner, with an issue: OMNI_UNATTENDED set, and at the stop for a decision', () => {
    expect(asking).not.toBe('');
    expect(firstGap(asking, ['`OMNI_UNATTENDED`', 'issue', 'a person in a terminal'])).toBeNull();
    expect(flat(section(text, stop))).toContain('**Asking on a runner**');
  });

  it('writes 1 to 4 questions of 2 to 4 options, the last Design it first, then runs omni runner ask', () => {
    expect(firstGap(asking, [
      '1 to 4 questions', '2 to 4 options', '`Design it first`', '`Stop here and brainstorm the behaviour`', `\`${ASK}\``,
    ])).toBeNull();
  });

  it('posts the stop comment under its marker, ending on the waiting line omni runner ask printed', () => {
    expect(firstGap(asking, [`\`${ASK}\``, '<!-- omni-bug:need-human -->', 'Waiting for an answer on Omni:'])).toBeNull();
    expect(asking).toContain('`--issue <n>`');
  });

  it('falls back to its stop as it was, with the brainstorm line, on any other exit', () => {
    expect(firstGap(asking, ['any other exit', 'stop comment', `\`${brainstorm}\``])).toBeNull();
    // A person in a terminal reads the stop as before: its last fenced line is still the brainstorm line.
    expect(lastFencedLine(section(text, stop))?.replaceAll('`', '')).toBe(`${brainstorm} <the issue's line>`);
  });

  it('resumes with --answers <job>: reads them with omni runner answers, and stops with its line when it cannot', () => {
    expect(resuming).not.toBe('');
    expect(firstGap(resuming, ['`--answers <job>`', `\`${ANSWERS}\``, 'stop with the line it printed', 'touch nothing'])).toBeNull();
  });

  it('posts what was decided under its marker, by @<login>, then carries on with the answers as the behaviour wanted', () => {
    expect(firstGap(resuming, [
      `\`${ANSWERS}\``, '<!-- omni-bug:decision -->', 'Decided in Omni by @<login>', 'the behaviour wanted',
    ])).toBeNull();
  });

  it('stops with the brainstorm line on Design it first, asks again on another decision, and never merges', () => {
    expect(firstGap(resuming, ['`Design it first`', `\`${brainstorm}\``, 'another decision', 'asks again'])).toBeNull();
    expect(resuming).toContain('a person merges');
    expect(flat(section(text, 'Never'))).toContain('**Never merge');
  });

  it('keeps both new sections after the last step and before the rules', () => {
    const order = ['\n## Asking on a runner', '\n## Resuming with answers', '\n## Never'];
    const positions = order.map((heading) => text.indexOf(heading));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('/omni:mega-bug-fix keeps product runs and targets out of the questions', () => {
  const text = read('mega-bug-fix');

  it('asks in a plan repository only, and pushes nothing to a target whatever the answer', () => {
    const asking = flat(section(text, 'Asking on a runner'));
    const resuming = flat(section(text, 'Resuming with answers'));
    expect(firstGap(asking, ['plan repository', '`--product <key>`', 'no issue'])).toBeNull();
    expect(asking).toContain('pushing nothing to any target');
    expect(resuming).toContain('pushing nothing to any target');
    expect(resuming).toContain('across the targets');
  });
});

describe('/omni:bug-fix shows the comments it posts, and lists the stop for an unreadable resume', () => {
  const text = read('bug-fix');

  it('shows the stop comment, ending on the waiting line, and the decision comment under its marker', () => {
    const asking = section(text, 'Asking on a runner');
    expect(asking).toContain('```markdown\n<!-- omni-bug:need-human -->\n');
    expect(lastFencedLine(asking)).toMatch(/^Waiting for an answer on Omni: /);
    const resuming = section(text, 'Resuming with answers');
    expect(resuming).toContain('```markdown\n<!-- omni-bug:decision -->\n\nDecided in Omni by @<login>\n');
  });

  it('stops with the line omni runner answers printed, and touches nothing', () => {
    const rules = flat(section(text, 'Stop rules'));
    expect(firstGap(rules, ['`--answers <job>`', '`omni runner answers`', 'touch nothing'])).toBeNull();
  });
});
