import { describe, expect, it } from 'vitest';
import { installPlugin, pluginLines } from './plugin.ts';
import { MARKETPLACE, PLUGIN } from './steps.ts';

const HOME = 'vertuoza/vertuo-omni-loop';
const ID = `${PLUGIN}@${MARKETPLACE}`;

/**
 * `claude` faked. `installed` and `marketplaces` are what `claude plugin list --json` and
 * `claude plugin marketplace list --json` report; `missing` makes every call fail as a missing
 * binary does; `fails` names the one subcommand (`add` or `install`) that fails.
 */
function fakeClaude({ installed = [], marketplaces = [], missing = false, fails = null }: {
  installed?: string[];
  marketplaces?: string[];
  missing?: boolean;
  fails?: 'add' | 'install' | null;
} = {}) {
  const calls: string[] = [];
  const exec = (cmd: string, args: readonly string[]): string => {
    calls.push([cmd, ...args].join(' '));
    if (cmd !== 'claude' || missing) throw new Error('spawn claude ENOENT');
    const key = args.join(' ');
    if (key === 'plugin list --json') return JSON.stringify(installed.map((id) => ({ id })));
    if (key === 'plugin marketplace list --json') return JSON.stringify(marketplaces.map((name) => ({ name })));
    if (fails === 'add' && key.startsWith('plugin marketplace add')) throw new Error('could not clone');
    if (fails === 'install' && key.startsWith('plugin install')) throw new Error('not found');
    return '';
  };
  return { exec, calls };
}

describe('installPlugin', () => {
  it('adds the marketplace from the kit home, then installs the plugin, with the names omni update uses', () => {
    const { exec, calls } = fakeClaude();
    expect(installPlugin({ exec, kitHome: HOME })).toEqual({ outcome: 'installed' });
    expect(calls.filter((call) => !call.endsWith('--json'))).toEqual([
      `claude plugin marketplace add ${HOME}`,
      `claude plugin install ${ID}`,
    ]);
  });

  it('skips the marketplace step when the marketplace is there already', () => {
    const { exec, calls } = fakeClaude({ marketplaces: [MARKETPLACE] });
    expect(installPlugin({ exec, kitHome: HOME }).outcome).toBe('installed');
    expect(calls).not.toContain(`claude plugin marketplace add ${HOME}`);
    expect(calls).toContain(`claude plugin install ${ID}`);
  });

  it('says "already" when the plugin is installed, and installs nothing', () => {
    const { exec, calls } = fakeClaude({ installed: ['other@elsewhere', ID] });
    expect(installPlugin({ exec, kitHome: HOME })).toEqual({ outcome: 'already' });
    expect(calls).toEqual(['claude plugin list --json']);
  });

  it('fails without throwing when claude is missing, or either command fails', () => {
    for (const fake of [fakeClaude({ missing: true }), fakeClaude({ fails: 'add' }), fakeClaude({ fails: 'install' })]) {
      expect(installPlugin({ exec: fake.exec, kitHome: HOME })).toEqual({ outcome: 'failed' });
    }
  });

  it('a list claude cannot give is no reason to skip the install', () => {
    const exec = (_cmd: string, args: readonly string[]): string => {
      if (args.includes('--json')) return 'not json';
      return '';
    };
    expect(installPlugin({ exec, kitHome: HOME }).outcome).toBe('installed');
  });

  it('fails when the kit home is unknown, without calling claude to install', () => {
    const { exec, calls } = fakeClaude();
    expect(installPlugin({ exec, kitHome: null }).outcome).toBe('failed');
    expect(calls.some((call) => call.includes('install '))).toBe(false);
  });
});

describe('pluginLines', () => {
  it('one status line when installed or already there', () => {
    expect(pluginLines({ outcome: 'installed' }, { kitHome: HOME })).toEqual({ status: [`  plugin  installed ${ID}, run /reload-plugins in an open Claude Code`], todo: [] });
    expect(pluginLines({ outcome: 'already' }, { kitHome: HOME })).toEqual({ status: [`  plugin  ${ID} installed already`], todo: [] });
  });

  it('the two /plugin lines to type in Claude Code when it failed', () => {
    expect(pluginLines({ outcome: 'failed' }, { kitHome: HOME })).toEqual({
      status: [`  plugin  could not install ${ID} from here`],
      todo: [`/plugin marketplace add ${HOME}`, `/plugin install ${ID}`],
    });
    expect(pluginLines({ outcome: 'failed' }, { kitHome: null }).todo[0]).toBe('/plugin marketplace add <owner>/<kit repository>');
  });
});
