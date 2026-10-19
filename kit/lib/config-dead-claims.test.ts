// PRD 2175, s1: the config keys a dead job's claims are read by — `labels.released`, the label a
// runner swaps in for `labels.inProgress`, and `limits.claimDeadMinutes`, how long a claim on
// `labels.inProgress` stays quiet before the board reads it as stale. Its own file: `config.test.ts`
// proves rules and stays as it is.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CLAIM_DEAD_MINUTES, DEFAULT_RELEASED_LABEL, parseConfig, releasedLabel } from './config.ts';

describe('labels.released (PRD 2175)', () => {
  it('is left out of a config that does not set it, which parses exactly as before: the kit reads omni:released', () => {
    const config = parseConfig('kit: 1\n');
    expect(Object.hasOwn(config.labels, 'released')).toBe(false);
    expect(DEFAULT_RELEASED_LABEL).toBe('omni:released');
    expect(releasedLabel(config.labels)).toBe('omni:released');
  });

  it('is the name the file gives it', () => {
    const labels = parseConfig('kit: 1\nlabels:\n  released: dead-claim\n').labels;
    expect(labels.released).toBe('dead-claim');
    expect(releasedLabel(labels)).toBe('dead-claim');
  });

  it('keeps the other labels as they were when the file renames it', () => {
    const labels = parseConfig('kit: 1\nlabels:\n  released: dead-claim\n').labels;
    expect(labels.inProgress).toBe('omni:in-progress');
    expect(labels.needsFix).toBe('omni:needs-fix');
  });

  it('refuses a name that is not a label name, naming the key', () => {
    expect(() => parseConfig('kit: 1\nlabels:\n  released: ""\n', 'c.yml')).toThrow(/c\.yml.*labels\.released/);
    expect(() => parseConfig('kit: 1\nlabels:\n  released: 3\n', 'c.yml')).toThrow(/labels\.released/);
  });
});

describe('limits.claimDeadMinutes (PRD 2175)', () => {
  it('is left out of a config that does not set it, which parses exactly as before: the board takes 240', () => {
    const config = parseConfig('kit: 1\n');
    expect(Object.hasOwn(config.limits, 'claimDeadMinutes')).toBe(false);
    expect(DEFAULT_CLAIM_DEAD_MINUTES).toBe(240);
  });

  it('takes a positive whole number of minutes', () => {
    expect(parseConfig('kit: 1\nlimits:\n  claimDeadMinutes: 90\n').limits.claimDeadMinutes).toBe(90);
    expect(parseConfig('kit: 1\nlimits:\n  claimDeadMinutes: 1\n').limits.claimDeadMinutes).toBe(1);
  });

  it('keeps the other limits as they were when the file sets it', () => {
    const limits = parseConfig('kit: 1\nlimits:\n  claimDeadMinutes: 90\n').limits;
    expect(limits.claimStaleMinutes).toBe(60);
    expect(limits.attempts).toBe(3);
  });

  it('refuses zero, a negative, a fraction or text, naming the key', () => {
    for (const value of ['0', '-5', '2.5', 'soon']) {
      expect(() => parseConfig(`kit: 1\nlimits:\n  claimDeadMinutes: ${value}\n`, 'c.yml')).toThrow(/c\.yml.*limits\.claimDeadMinutes/);
    }
  });
});
