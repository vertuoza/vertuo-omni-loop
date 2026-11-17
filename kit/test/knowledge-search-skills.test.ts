// PRD 3007, s4 (AC-10): the seven skills that decide things search the product's knowledge before they
// decide what the spec does not settle, read what they rely on whole, and cite the ids in the outbox
// item. The text is read as the skills are, so a rewording that drops the search, the fallback or the
// citation fails here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

const SEVEN = ['do-work', 'wave', 'yolo', 'bug-fix', 'plan', 'brainstorm', 'pr-care'];

describe('the knowledge search in the deciding skills (PRD 3007, s4)', () => {
  it.each(SEVEN)('/omni:%s names the search, the fallback, the reads and the citation', (name) => {
    const text = flat(skill(name));
    expect(text).toMatch(/search the product's knowledge/i);
    expect(text).toContain('`search_knowledge`');
    expect(text).toContain('`omni-knowledge`');
    expect(text).toContain('node .omni-loop/bin/omni.mjs kb search <query>');
    expect(text).toContain('`get_knowledge`');
    expect(text).toContain('node .omni-loop/bin/omni.mjs kb get <id>');
    expect(text).toMatch(/read each entry it relies on whole/i);
    expect(text).toContain('cite the ids in the outbox item');
  });

  it('/omni:do-work names the search inside its decision step, before the most reversible option', () => {
    const text = flat(skill('do-work'));
    expect(text.indexOf('Search the product')).toBeGreaterThan(text.indexOf('## 3. Record the decision'));
    expect(text.indexOf('Search the product')).toBeLessThan(text.indexOf('Take the most reversible option'));
  });
});
