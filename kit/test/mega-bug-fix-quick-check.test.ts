// `/omni:mega-bug-fix` in a target runs a lint-only red through the target's committed quick check
// (`commands.preflight`, when `commands.preflightFull` is set too) before each full preflight, so a
// lint line never spends one of the `limits.attempts` full runs. A target's fix PR stopped as a draft
// after three full preflights: two of them red on lint alone, the fix itself green in CI.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TEXT = readFileSync(new URL('../plugin/skills/mega-bug-fix/SKILL.md', import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The bold-led paragraph that starts with `lead`, up to the next blank line. */
const paragraph = (lead: string) => {
  const from = TEXT.indexOf(lead);
  return from < 0 ? '' : flat(TEXT.slice(from, TEXT.indexOf('\n\n', from)));
};

/** The `## ` section whose heading starts with `start`, up to the next `## ` heading. */
const section = (start: string) => {
  const from = TEXT.indexOf(`\n## ${start}`);
  const to = TEXT.indexOf('\n## ', from + 1);
  return from < 0 ? '' : flat(TEXT.slice(from, to < 0 ? undefined : to));
};

/** The mentions of `order` missing from `text` or out of order: empty when all appear in turn. */
const gaps = (text: string, order: string[]) => {
  let at = 0;
  return order.filter((mention) => {
    const found = text.indexOf(mention, at);
    if (found < 0) return true;
    at = found + mention.length;
    return false;
  });
};

describe('/omni:mega-bug-fix: the quick check spends no attempt', () => {
  it("names the target's commands.preflight as its quick check, only when preflightFull is set too", () => {
    expect(paragraph("**Code runs only from a target's own config.**")).toContain(
      'when both are set, `commands.preflight` is also its quick check',
    );
    expect(paragraph('**The quick check spends no attempt.**')).toContain(
      'A target that commits both `commands.preflightFull` and `commands.preflight` has a quick check: its `commands.preflight`',
    );
  });

  it('runs it green before each full preflight, the red included, then the full preflight anyway', () => {
    expect(gaps(paragraph('**The quick check spends no attempt.**'), [
      'Before each run of the full preflight in a target, the red\'s and each of the fix\'s',
      'after the setup',
      'at most `limits.attempts` times, then run the full preflight anyway',
      'A red quick check is no attempt at the fix: only a red full preflight is',
      'The red is the full preflight\'s failing line, never the quick check\'s',
    ])).toEqual([]);
  });

  it('step 7 counts red full preflights only', () => {
    expect(section('7. Each target')).toContain('`limits.attempts` counts red full preflights only');
  });

  it('Never counts a red quick check, and keeps the pinned phrase whole', () => {
    const never = section('Never');
    expect(never).toContain('other than its own committed setup, then its own committed preflight (its quick check included)');
    expect(never).toContain('Never count a red quick check as an attempt,** and never take it for the red');
  });
});
