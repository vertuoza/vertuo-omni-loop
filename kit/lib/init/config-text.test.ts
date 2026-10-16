// The config `omni init` writes (PRD 1890, s1): the `agents` key it is given, and none when it is not.
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
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

  it('carries the sync block commented, with the defaults the config reads without it (PRD 1990)', () => {
    const { text, config } = renderConfig(values);
    expect(text).not.toMatch(/^sync:/m);
    const block = text.split('\n').filter((line) => /^# {1,}(sync:|order:|levels:|main:|kit:|knowledge:|page:|mainRedAfter:)/.test(line));
    expect(block.map((line) => line.replace(/ +#.*$/, ''))).toEqual([
      '# sync:',
      '#   order: [main, kit, knowledge, page]',
      '#   levels:',
      '#     main: red',
      '#     kit: orange',
      '#     knowledge: orange',
      '#     page: orange',
      '#   mainRedAfter: 24h',
    ]);
    const uncommented = renderConfig(values).text.replace(/^# (sync:|  )/gm, '$1');
    expect(parseConfig(uncommented).sync).toEqual(config.sync);
  });

  it('writes no agents key when given none, so the config reads the default [claude]', () => {
    const { text, config } = renderConfig(values);
    expect(text).not.toMatch(/^agents:/m);
    expect(config.agents).toEqual(['claude']);
  });
});
