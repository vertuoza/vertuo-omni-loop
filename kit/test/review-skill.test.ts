// The contract of `/omni:review` (PRD 2871, s2), read as text, as tech-review-skill.test.ts reads its skill:
// it reads the PRD, the rules and the look-for list before it reviews; reads the whole diff against the
// default branch and the code around it; has a fresh verification pass try to disprove each finding; keeps
// five at most; posts one review through `omni review post`; marks ready only on its own pass, with the PRD
// shipped, the PR a draft and the gate green, through the `yolo.ready` hooks and `gh pr ready`; reads round
// 1's threads in round 2 and raises new findings only on lines changed since; never approves, requests
// changes, merges or writes code; and ends on the hand-off line the runner reads (`kit/lib/runner/log.ts`).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { COMMAND_TABLE } from '../bin/commands/index.ts';
import { parsePrd } from '../lib/ids.ts';
import { runOutcome } from '../lib/runner/log.ts';

const TEXT = readFileSync(fileURLToPath(new URL('../plugin/skills/review/SKILL.md', import.meta.url)), 'utf8');
const FLAT = TEXT.replace(/\s+/g, ' ');

/** Where `needle` first appears in the skill, failing the test when it does not. */
function at(needle: string): number {
  const index = FLAT.indexOf(needle);
  expect(index, needle).toBeGreaterThanOrEqual(0);
  return index;
}

/** The `## <heading>` section whose heading starts with `start`, flattened, up to the next one. */
function section(start: string): string {
  const from = TEXT.indexOf(`\n## ${start}`);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = TEXT.indexOf('\n## ', from + 1);
  return TEXT.slice(from, to < 0 ? undefined : to).replace(/\s+/g, ' ');
}

describe('the review skill', () => {
  it('parses, is named for its folder and says when it runs', () => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(TEXT);
    const data = parseYaml(match?.[1] ?? '') as { name?: unknown; description?: unknown };
    expect(data.name).toBe('review');
    expect(String(data.description)).toMatch(/Triggers on .*\/omni:review/);
  });

  it('reads the spec, the plan, the laws of the changed files, three forms and the look-for list before it reviews', () => {
    const reads = section('2. Read before you review');
    for (const read of ['spec', 'plan', 'kb laws --paths <changed files>', 'kb show testing', 'kb show conventions', 'kb show architecture', 'kb show review', 'review look-for']) {
      expect(reads, read).toContain(read);
    }
    expect(at('## 2. Read before you review')).toBeLessThan(at('## 3. Review the whole change'));
  });

  it('reads the whole diff against the default branch and the code around it, never the diff alone', () => {
    const review = section('3. Review the whole change');
    expect(review).toContain('git diff <remote>/<default branch>...HEAD');
    expect(review).toContain('the code around it');
    expect(review).toContain('never the diff alone');
    expect(review).toContain('a linter enforces');
  });

  it('has a fresh verification pass try to disprove each finding, and keeps only the ones that survive', () => {
    const verify = section('5. Verify, keep five, post');
    expect(verify).toContain('**The verification pass.**');
    expect(verify).toContain('fresh subagent');
    expect(verify).toContain('tries to disprove each one');
    expect(verify).toContain('Only a finding that holds is kept');
  });

  it('keeps five findings at most, the most severe first, and posts through omni review post, never a refused verdict', () => {
    const verify = section('5. Verify, keep five, post');
    expect(verify).toContain('at most five');
    expect(verify).toContain('the most severe first');
    expect(verify).toContain('review post <n> --file <file> --pr <pr> --json');
    expect(verify).toContain('never posted half-formed');
    expect(at('**The verification pass.**')).toBeLessThan(at('review post <n> --file'));
  });

  it('marks ready only on its own pass, with the PRD shipped, the PR a draft and the gate green, through the yolo.ready hooks', () => {
    const ready = section('6. On a pass');
    for (const condition of ['`state: shipped`', '`isDraft`', '`omni status <n>` exits 0']) expect(ready, condition).toContain(condition);
    expect(ready).toContain('omni flow show yolo.ready');
    expect(ready).toContain('omni flow verdict yolo.ready --from <file>');
    expect(ready.indexOf('omni flow show yolo.ready')).toBeLessThan(ready.indexOf('`gh pr ready <pr>`'));
    expect(ready).toContain('changes nothing else');
    expect(TEXT.match(/gh pr ready/g)).toHaveLength(1);
  });

  it('reads round 1\'s threads and replies in round 2, resolves or keeps each with a reason once, and raises new findings only on lines changed since', () => {
    const round = section('4. Round 2');
    expect(round).toContain('care state <n>');
    expect(round).toContain('**resolved**');
    expect(round).toContain('**kept**');
    expect(round).toContain('its reason once');
    expect(round).toContain('only on a line changed since round 1');
    expect(round).toContain('no third argument');
    expect(FLAT).toContain('never sends round 3');
  });

  it('never approves, requests changes or merges, and writes no code', () => {
    expect(FLAT).toContain('`COMMENT` mode');
    expect(FLAT).toContain('never approves or requests changes');
    expect(FLAT).toContain('It never merges');
    expect(FLAT).toContain('It writes no code');
    for (const verb of [/\bgh\s+pr\s+(?:review|merge)\b/, /\bgit\s+(?:commit|push)\b/, /"event":\s*"(?:APPROVE|REQUEST_CHANGES)"/, /--add-label/]) expect(TEXT).not.toMatch(verb);
  });

  it('asks nothing, on a runner or in a terminal', () => {
    expect(FLAT).toContain('It asks nothing');
    expect(FLAT).toContain('OMNI_UNATTENDED');
  });

  it('ends on the hand-off line the runner reads: ready on a pass it marked ready, changes on findings, stopped on a stop line', () => {
    const prd = parsePrd(2871);
    const handOff = section('7. Hand off');
    for (const [line, outcome] of [
      ['/omni:pr-care <n>', 'ready'],
      ['/omni:yolo-fix <n> --for-review', 'changes'],
      ['review: <why>', 'stopped'],
    ] as const) {
      expect(handOff, line).toContain(`\`${line}\``);
      expect(runOutcome(`Done: ok\n${line.replace('<n>', '2871')}\n`, prd, 'review'), line).toBe(outcome);
    }
    expect(handOff).toContain("decide the Reviewer's findings on PR #<pr>");
  });

  it('names only commands the CLI has', () => {
    for (const command of ['config', 'session', 'prd', 'kb', 'review', 'care', 'status', 'flow', 'dossier', 'hold']) expect(COMMAND_TABLE, command).toHaveProperty(command);
  });
});
