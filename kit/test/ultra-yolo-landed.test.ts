// Bug #3371: /omni:ultra-yolo checks each PRD its spec says it is blocked by against the base it builds on through
// `omni prd <key>-<m> --landed-in`, its merged work, never its page state alone nor a path the plan guessed (omni-loop-29's build
// on mission #3319 held on omni-loop-27, already on its branch, reading `state: inbox` and a folder it invented).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const flat = (text: string) => text.replace(/\s+/g, ' ');
const YOLO = flat(readFileSync(new URL('../plugin/skills/ultra-yolo/SKILL.md', import.meta.url), 'utf8'));

describe('/omni:ultra-yolo, whether a blocker landed (bug #3371)', () => {
  it('asks the kit whether the blocker landed in the target base, after fetching it', () => {
    expect(YOLO).toContain('node .omni-loop/bin/omni.mjs prd <key>-<m> --landed-in <remote>/<target base> --repo <slug> [--clone <clone>]');
    expect(YOLO).toContain('fetch `<target base>` first');
  });

  it('counts a blocker merged through an earlier mission pull request, or shipped, as landed', () => {
    expect(YOLO).toContain('Exit 0 (`landed: yes · …`) is landed; so is the blocker\'s own page state reading `state: shipped`.');
    expect(YOLO).toContain('that mission\'s pull request then merged into the default branch the base was cut from, is landed');
  });

  it('never reads inbox as not landed and never guesses a path', () => {
    expect(YOLO).toContain('Its page state reading `inbox` never makes it not landed, and never guess a folder, a file or a path the blocker would add');
  });

  it('holds only on what is not landed', () => {
    expect(YOLO).toContain('plan waits on PRDs not yet in the base it builds on (**Whether a blocker landed**) ends held');
  });
});
