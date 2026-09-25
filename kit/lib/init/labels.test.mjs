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
    expect(names).toEqual(['omni:prd', 'omni:phase-0', 'omni:feature', 'omni:sub', 'omni:in-progress', 'omni:outbox-go']);
  });
});
