import { describe, expect, it } from 'vitest';
import { formText } from '../../test/fixture.mjs';
import { DEFAULT_PLAYBOOK, invadedOn, isFilled, playbookOf } from './filled.mjs';

describe('isFilled', () => {
  it('a form whose front matter says state: filled is filled', () => {
    expect(isFilled(formText({ frontMatter: { state: 'filled', invaded: '2026-09-25' } }))).toBe(true);
  });

  it('a blank form is not filled', () => {
    expect(isFilled(formText())).toBe(false);
  });

  it('a pointer form is not filled', () => {
    expect(isFilled(formText({ frontMatter: { state: 'pointer', 'points-to': 'docs/testing.md' } }))).toBe(false);
  });

  it('invalid front matter, none at all, or no text is not filled', () => {
    expect(isFilled('---\nstate: [filled\n---\n# Testing\n')).toBe(false);
    expect(isFilled('# Testing\n\nstate: filled\n')).toBe(false);
    expect(isFilled(null)).toBe(false);
  });
});

describe('invadedOn', () => {
  it('the invaded: date of the front matter, or its old terraformed: spelling', () => {
    expect(invadedOn(formText({ frontMatter: { state: 'filled', invaded: '2026-09-25' } }))).toBe('2026-09-25');
    expect(invadedOn(formText({ frontMatter: { state: 'filled', invaded: undefined, terraformed: '2026-08-01' } }))).toBe('2026-08-01');
  });

  it('null without a date, or with front matter it cannot read', () => {
    expect(invadedOn(formText({ frontMatter: { state: 'filled' } }))).toBeNull();
    expect(invadedOn('---\ninvaded: [\n---\n')).toBeNull();
    expect(invadedOn('# Testing\n')).toBeNull();
  });
});

describe('playbookOf', () => {
  it('the folder paths.playbook names, without a trailing slash', () => {
    expect(playbookOf('kit: 1\npaths:\n  playbook: handbook/playbook/\n')).toBe('handbook/playbook');
  });

  it('the default layout when the config names none, or cannot be read', () => {
    expect(playbookOf('kit: 1\n')).toBe(DEFAULT_PLAYBOOK);
    expect(playbookOf('kit: 1\npaths:\n  playbook: "  "\n')).toBe(DEFAULT_PLAYBOOK);
    expect(playbookOf('kit: [\n')).toBe(DEFAULT_PLAYBOOK);
    expect(DEFAULT_PLAYBOOK).toBe('.omni-loop/knowledge/playbook');
  });
});
