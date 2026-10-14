// The config `omni init` writes (PRD 1890, s1): the `agents` key it is given, and none when it is not.
import { describe, expect, it } from 'vitest';
import { renderConfig, type ConfigValues } from './config-text.ts';

const values: ConfigValues = {
  slug: 'acme/widgets',
  defaultBranch: 'main',
  commands: { setup: null, test: null, preflight: null, preflightFull: null },
  lawsSource: 'none',
};

describe('renderConfig', () => {
  it('writes the agents it is given, and the config reads them back', () => {
    const { text, config } = renderConfig({ ...values, agents: ['codex', 'claude'] });
    expect(text).toMatch(/^agents:\n {2}- codex\n {2}- claude$/m);
    expect(config.agents).toEqual(['codex', 'claude']);
  });

  it('writes no agents key when given none, so the config reads the default [claude]', () => {
    const { text, config } = renderConfig(values);
    expect(text).not.toMatch(/^agents:/m);
    expect(config.agents).toEqual(['claude']);
  });
});
