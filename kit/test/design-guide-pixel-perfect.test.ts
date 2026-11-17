// PRD 3035, s2: the design guide says the before/after's Pixel perfect tab draws a changed screen
// whether or not design craft is on, and what the best effort is with it off. A text check over
// docs/guide/design.md, in its own file so the skill tests stay as they are.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const GUIDE = new URL('../../docs/guide/design.md', import.meta.url);

/** The `## <heading>` section of the guide whose heading starts with `start`, up to the next one, its whitespace folded. */
function section(start: string) {
  const lines = readFileSync(GUIDE, 'utf8').split('\n');
  const from = lines.findIndex((line) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line, index) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n').replace(/\s+/g, ' ');
}

describe('the design guide, the before/after three tabs (PRD 3035)', () => {
  const tabs = section('The before/after: three tabs');

  it('AC-4: says the Pixel perfect tab draws a changed screen whether or not design craft is on', () => {
    expect(tabs).toContain('whether or not design craft is on');
    expect(tabs).toContain('It draws a changed screen whether or not design craft is on.');
  });

  it('AC-4: says what the best effort is with design craft off', () => {
    expect(tabs).toContain('With it off, nothing is configured, so the page draws a best effort from the app\'s own code');
    expect(tabs).toContain('**today** is the screen as the app shows it now');
    expect(tabs).toContain('**after** is that same screen with only what the approved design changes');
    expect(tabs).toContain('No design form, screen library, word pass or draft screen is used.');
    expect(tabs).toContain('the page says under it, in one line, what was guessed');
  });
});
