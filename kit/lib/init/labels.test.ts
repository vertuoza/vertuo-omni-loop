import { describe, expect, it } from 'vitest';
import { ConfigSchema, CONFIG_VERSION } from '../config.ts';
import { LABEL_STYLES, loopLabels } from './labels.ts';
import { assertDefined } from '../../test/assert.ts';

const defaults = ConfigSchema.parse({ kit: CONFIG_VERSION }).labels;

describe('loop labels', () => {
  it('styles every label name the schema defines, and nothing else', () => {
    const named = Object.keys(defaults).filter((key) => typeof defaults[key as keyof typeof defaults] === 'string');
    expect(Object.keys(LABEL_STYLES).sort()).toEqual(named.sort());
  });

  it('asks for a label two keys share only once', () => {
    const names = loopLabels({ ...defaults, needsFix: 'OMNI:SUB' }).map((label) => label.name);
    expect(names).toEqual(['omni:prd', 'omni:phase-0', 'omni:feature', 'omni:sub', 'omni:in-progress', 'omni:outbox-go', 'omni:retro', 'omni:knowledge', 'omni:visual', 'omni:bug', 'omni:regression', 'omni:risk-critical', 'omni:risk-high', 'omni:risk-medium', 'omni:risk-low', 'omni:concept', 'omni:approved']);
  });

  it('asks for the knowledge label with its own colour and a description', () => {
    const knowledge = loopLabels(defaults).find((label) => label.name === 'omni:knowledge');
    assertDefined(knowledge, 'knowledge');
    expect(knowledge).toEqual({ name: 'omni:knowledge', ...LABEL_STYLES.knowledge });
    expect(knowledge.color).toMatch(/^[0-9a-f]{6}$/);
    const others = Object.entries(LABEL_STYLES).filter(([key]) => key !== 'knowledge');
    expect(others.map(([, style]) => style.color)).not.toContain(knowledge.color);
    expect(knowledge.description).toMatch(/^Omni Loop: \S/);
    expect(knowledge.description.length).toBeLessThanOrEqual(100);
  });

  it('asks for the retro label with its own colour and a description', () => {
    const retro = loopLabels(defaults).find((label) => label.name === 'omni:retro');
    assertDefined(retro, 'retro');
    expect(retro).toEqual({ name: 'omni:retro', ...LABEL_STYLES.retro });
    expect(retro.color).toMatch(/^[0-9a-f]{6}$/);
    const others = Object.entries(LABEL_STYLES).filter(([key]) => key !== 'retro');
    expect(others.map(([, style]) => style.color)).not.toContain(retro.color);
    expect(retro.description).toMatch(/^Omni Loop: \S/);
    expect(retro.description.length).toBeLessThanOrEqual(100);
  });

  it('asks for the visual label with its own colour and a description', () => {
    const visual = loopLabels(defaults).find((label) => label.name === 'omni:visual');
    assertDefined(visual, 'visual');
    expect(visual).toEqual({ name: 'omni:visual', ...LABEL_STYLES.visual });
    expect(visual.color).toMatch(/^[0-9a-f]{6}$/);
    const others = Object.entries(LABEL_STYLES).filter(([key]) => key !== 'visual');
    expect(others.map(([, style]) => style.color)).not.toContain(visual.color);
    expect(visual.description).toMatch(/^Omni Loop: \S/);
    expect(visual.description.length).toBeLessThanOrEqual(100);
  });

  it.each([
    ['bug', 'omni:bug'],
    ['regression', 'omni:regression'],
    ['riskCritical', 'omni:risk-critical'],
    ['riskHigh', 'omni:risk-high'],
    ['riskMedium', 'omni:risk-medium'],
    ['riskLow', 'omni:risk-low'],
    ['concept', 'omni:concept'],
    ['approved', 'omni:approved'],
  ])('asks for the %s label with its own colour and a description (PRD 556, PRD 686)', (key, name) => {
    const label = loopLabels(defaults).find((l) => l.name === name);
    assertDefined(label, 'label');
    expect(label).toEqual({ name, ...LABEL_STYLES[key as keyof typeof LABEL_STYLES] });
    expect(label.color).toMatch(/^[0-9a-f]{6}$/);
    const others = Object.entries(LABEL_STYLES).filter(([k]) => k !== key);
    expect(others.map(([, style]) => style.color)).not.toContain(label.color);
    expect(label.description).toMatch(/^Omni Loop: \S/);
    expect(label.description.length).toBeLessThanOrEqual(100);
  });
});
