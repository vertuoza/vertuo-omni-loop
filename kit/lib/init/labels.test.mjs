import { describe, expect, it } from 'vitest';
import { ConfigSchema, CONFIG_VERSION } from '../config.mjs';
import { LABEL_STYLES, loopLabels } from './labels.mjs';

const defaults = ConfigSchema.parse({ kit: CONFIG_VERSION }).labels;

describe('loop labels', () => {
  it('styles every label name the schema defines, and nothing else', () => {
    const named = Object.keys(defaults).filter((key) => typeof defaults[key] === 'string');
    expect(Object.keys(LABEL_STYLES).sort()).toEqual(named.sort());
  });

  it('asks for a label two keys share only once', () => {
    const names = loopLabels({ ...defaults, needsFix: 'OMNI:SUB' }).map((label) => label.name);
    expect(names).toEqual(['omni:prd', 'omni:phase-0', 'omni:feature', 'omni:sub', 'omni:in-progress', 'omni:outbox-go', 'omni:retro', 'omni:knowledge', 'omni:visual']);
  });

  it('asks for the knowledge label with its own colour and a description', () => {
    const knowledge = loopLabels(defaults).find((label) => label.name === 'omni:knowledge');
    expect(knowledge).toEqual({ name: 'omni:knowledge', ...LABEL_STYLES.knowledge });
    expect(knowledge.color).toMatch(/^[0-9a-f]{6}$/);
    const others = Object.entries(LABEL_STYLES).filter(([key]) => key !== 'knowledge');
    expect(others.map(([, style]) => style.color)).not.toContain(knowledge.color);
    expect(knowledge.description).toMatch(/^Omni Loop: \S/);
    expect(knowledge.description.length).toBeLessThanOrEqual(100);
  });

  it('asks for the retro label with its own colour and a description', () => {
    const retro = loopLabels(defaults).find((label) => label.name === 'omni:retro');
    expect(retro).toEqual({ name: 'omni:retro', ...LABEL_STYLES.retro });
    expect(retro.color).toMatch(/^[0-9a-f]{6}$/);
    const others = Object.entries(LABEL_STYLES).filter(([key]) => key !== 'retro');
    expect(others.map(([, style]) => style.color)).not.toContain(retro.color);
    expect(retro.description).toMatch(/^Omni Loop: \S/);
    expect(retro.description.length).toBeLessThanOrEqual(100);
  });

  it('asks for the visual label with its own colour and a description', () => {
    const visual = loopLabels(defaults).find((label) => label.name === 'omni:visual');
    expect(visual).toEqual({ name: 'omni:visual', ...LABEL_STYLES.visual });
    expect(visual.color).toMatch(/^[0-9a-f]{6}$/);
    const others = Object.entries(LABEL_STYLES).filter(([key]) => key !== 'visual');
    expect(others.map(([, style]) => style.color)).not.toContain(visual.color);
    expect(visual.description).toMatch(/^Omni Loop: \S/);
    expect(visual.description.length).toBeLessThanOrEqual(100);
  });
});
