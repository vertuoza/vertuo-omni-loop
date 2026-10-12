// PRD 1679, s2: the budget's red, written for a junior — its five parts for each kind of red, with and
// without a PRD — and the green table and the neutral lines.
import { describe, expect, it } from 'vitest';
import { budgetTable, kb, neutralLines, redMessage, targetLabel } from './message.ts';
import type { MessageContext } from './message.ts';
import type { TargetVerdict } from './ratchet.ts';

const verdict = (over: Partial<TargetVerdict>): TargetVerdict => ({
  target: 'form:design', verdict: 'over-budget', bytes: 10035, ceiling: 8192, baseCeiling: 8192, raised: false, raise: null, error: null, ...over,
});

const growth = { 'form:design': { files: [{ path: '.omni-loop/knowledge/playbook/design.md', bytesAdded: 1843 }], commits: [{ sha: 'abc1234', subject: 'docs: more design' }] } };
const onPrd: MessageContext = { prd: 7, ceilingsFile: '.omni-loop/budgets/context.json', growth };
const noPrd: MessageContext = { ...onPrd, prd: null };

describe('kb and targetLabel', () => {
  it('prints KB with one decimal, whole numbers bare, bytes under 1 KB', () => {
    expect(kb(10035)).toBe('9.8 KB');
    expect(kb(8192)).toBe('8 KB');
    expect(kb(1024)).toBe('1 KB');
    expect(kb(1023)).toBe('1023 bytes');
  });

  it('names each kind of target in plain words', () => {
    expect(targetLabel('briefing')).toBe('the briefing every session reads first');
    expect(targetLabel('session')).toContain('`session`');
    expect(targetLabel('form:design')).toBe('the `design` playbook form');
    expect(targetLabel('context:AGENTS.md')).toBe('the context file `AGENTS.md`');
    expect(targetLabel('other')).toBe('`other`');
  });
});

describe('redMessage', () => {
  it('says what, why, what grew, the fix and the room, in this order, on a PRD', () => {
    const lines = redMessage(verdict({}), onPrd);
    expect(lines).toEqual([
      'Over budget: the `design` playbook form is 9.8 KB, its ceiling is 8 KB.',
      expect.stringMatching(/^Why it matters: every AI agent working here reads this before it starts/),
      'What grew:',
      '  - `.omni-loop/knowledge/playbook/design.md` +1.8 KB since the base',
      '  by the commits:',
      '  - abc1234 docs: more design',
      'Fix it for me: `/omni:pr-care` (or `/omni:yolo-fix 7`) handles it by itself. Or paste this into Claude: "Trim `.omni-loop/knowledge/playbook/design.md` back under 8 KB without losing a rule; move detail into a linked file."',
      'Or it needs the room: raise the ceiling of `form:design` in `.omni-loop/budgets/context.json` in this PR, and file a high outbox item of PRD 7 that says why and carries the line Budget raise: `form:design` to 10240 bytes (the ceiling you set). A person\'s answer turns this check green.',
    ]);
  });

  it('offers the prompt only, and no raise, on a pull request with no PRD', () => {
    const lines = redMessage(verdict({}), noPrd);
    expect(lines.join('\n')).not.toContain('/omni:pr-care');
    expect(lines.at(-2)).toMatch(/^Fix it for me: Paste this into Claude: "Trim /);
    expect(lines.at(-1)).toBe(
      'Or it needs the room: this pull request belongs to no PRD, so its ceiling cannot be raised here. Trim it, or make the change through a PRD or `/omni:bug-fix`, whose outbox carries the raise.',
    );
  });

  it("says a raised ceiling needs a person's yes, and the prompt puts it back", () => {
    const lines = redMessage(verdict({ verdict: 'needs-yes', bytes: 9000, ceiling: 10240, raised: true }), onPrd);
    expect(lines[0]).toBe("Needs a person's yes: this PR raises the ceiling of the `design` playbook form from 8 KB to 10 KB.");
    expect(lines.find((line) => line.startsWith('Fix it for me'))).toContain('"Put the ceiling of `form:design` in `.omni-loop/budgets/context.json` back to 8192, and trim');
    expect(lines.at(-1)).toContain('Budget raise: `form:design` to 10240 bytes');
  });

  it("says a first ceiling and a removed one need a person's yes", () => {
    expect(redMessage(verdict({ verdict: 'needs-yes', bytes: 900, ceiling: 1024, baseCeiling: null, raised: true }), onPrd)[0]).toBe(
      "Needs a person's yes: this PR sets a first ceiling of 1 KB on the `design` playbook form.",
    );
    expect(redMessage(verdict({ verdict: 'needs-yes', bytes: 900, ceiling: null, baseCeiling: 8192, raised: true }), onPrd)[0]).toBe(
      "Needs a person's yes: this PR removes the ceiling of the `design` playbook form (8 KB).",
    );
  });

  it('says when nothing that grew could be read, and names the target to trim', () => {
    const lines = redMessage(verdict({}), { ...noPrd, growth: {} });
    expect(lines[2]).toBe('What grew: nothing this range changed could be read; compare the files behind it with the base.');
    expect(lines.at(-2)).toContain('"Trim `form:design` back under 8 KB');
  });

  it('lists the files with no byte count, and says no commit changed them', () => {
    const lines = redMessage(verdict({}), { ...noPrd, growth: { 'form:design': { files: [{ path: 'a.md', bytesAdded: null }, { path: 'b.md', bytesAdded: -300 }], commits: [] } } });
    expect(lines.slice(2, 6)).toEqual(['What grew:', '  - `a.md`', '  - `b.md` -300 bytes since the base', '  no commit of this range changed them.']);
  });
});

describe('budgetTable and neutralLines', () => {
  it('prints each target with its size, ceiling and the ceiling change', () => {
    expect(
      budgetTable([
        verdict({ verdict: 'green', bytes: 500 }),
        verdict({ target: 'a', verdict: 'green', ceiling: 6144 }),
        verdict({ target: 'b', verdict: 'green', ceiling: 10240 }),
        verdict({ target: 'c', verdict: 'green', ceiling: null, baseCeiling: null }),
        verdict({ target: 'd', verdict: 'green', baseCeiling: null }),
        verdict({ target: 'e', verdict: 'needs-yes', ceiling: null }),
        verdict({ target: 'f', verdict: 'neutral', bytes: null, error: 'gone.md does not exist' }),
      ]),
    ).toEqual([
      '| target | size | ceiling | change |',
      '| --- | --- | --- | --- |',
      '| `form:design` | 500 bytes | 8 KB | — |',
      '| `a` | 9.8 KB | 6 KB | -2 KB |',
      '| `b` | 9.8 KB | 10 KB | +2 KB |',
      '| `c` | 9.8 KB | none | — |',
      '| `d` | 9.8 KB | 8 KB | new |',
      '| `e` | 9.8 KB | none | removed |',
      '| `f` | not measured: gone.md does not exist | 8 KB | — |',
    ]);
  });

  it('says why each neutral target was not measured, and nothing for the others', () => {
    expect(neutralLines([verdict({ verdict: 'green' }), verdict({ target: 'context:X.md', verdict: 'neutral', bytes: null, error: 'X.md does not exist' })])).toEqual([
      'Not measured: the context file `X.md` — X.md does not exist. A measurement that fails never blocks a merge.',
    ]);
  });
});
