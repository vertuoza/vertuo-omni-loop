// The Claude plugin update (PRD 347, s4; PRD 2100, s4): `runPluginUpdate` runs the two `claude` calls
// and says what they ended on, `updatePlugin` prints it for a person. `omni update`'s own lines are
// proved in `kit/bin/update.test.ts`; here, the last line a failed or a still-old update leaves.
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import { runPluginUpdate, updatePlugin } from './plugin.ts';

type Call = readonly string[];

/** A fake `claude`: records each call, answers `outputs` by the call's subcommand, throws `failures`. */
function fakeClaude({ outputs = {}, failures = {} }: { outputs?: Record<string, string>; failures?: Record<string, object> } = {}) {
  const calls: Call[] = [];
  const exec: ExecText = (file, args) => {
    expect(file).toBe('claude');
    calls.push(args);
    const key = args.slice(0, 2).join(' ') === 'plugin marketplace' ? 'marketplace' : 'update';
    const failure = failures[key];
    if (failure) throw Object.assign(new Error('Command failed: claude'), failure);
    return outputs[key] ?? '';
  };
  return { exec, calls };
}

describe('runPluginUpdate', () => {
  it('runs the marketplace update, then the plugin update, and says the last line the plugin update printed', () => {
    const claude = fakeClaude({ outputs: { update: 'Updating omni...\n\nomni is at the latest version (0.0.431)\n\n' } });
    expect(runPluginUpdate(claude.exec)).toEqual({ updated: true, said: 'omni is at the latest version (0.0.431)' });
    expect(claude.calls).toEqual([
      ['plugin', 'marketplace', 'update', 'omni-loop'],
      ['plugin', 'update', 'omni@omni-loop'],
    ]);
  });

  it('an update that printed nothing says so', () => {
    expect(runPluginUpdate(fakeClaude().exec)).toEqual({ updated: true, said: 'no output' });
  });

  it('a marketplace update that fails stops there: its last stderr line', () => {
    const claude = fakeClaude({ failures: { marketplace: { stderr: 'fetching...\nfatal: could not read from remote\n' } } });
    expect(runPluginUpdate(claude.exec)).toEqual({ updated: false, said: 'fatal: could not read from remote' });
    expect(claude.calls).toHaveLength(1);
  });

  it('a plugin update that fails: its last stderr line, else its last stdout line, else its message', () => {
    const stderr = fakeClaude({ failures: { update: { stderr: 'plugin not found\n', stdout: 'out' } } });
    expect(runPluginUpdate(stderr.exec).said).toBe('plugin not found');
    const stdout = fakeClaude({ failures: { update: { stderr: '  \n', stdout: 'first\nsecond\n' } } });
    expect(runPluginUpdate(stdout.exec).said).toBe('second');
    const message = fakeClaude({ failures: { update: {} } });
    expect(runPluginUpdate(message.exec)).toEqual({ updated: false, said: 'Command failed: claude' });
  });

  it('cuts a very long line to 200 characters', () => {
    const claude = fakeClaude({ failures: { update: { stderr: `${'x'.repeat(500)}\n` } } });
    expect(runPluginUpdate(claude.exec).said).toBe('x'.repeat(200));
  });

});

describe('updatePlugin, as omni update prints it', () => {
  it('prints the version it updated to, or the two lines to type', () => {
    const lines: string[] = [];
    expect(updatePlugin({ version: '0.0.15', exec: fakeClaude().exec, println: (line) => lines.push(line) })).toBe(true);
    expect(lines).toEqual(['  plugin   updated to v0.0.15, run /reload-plugins']);
    const failed: string[] = [];
    expect(updatePlugin({ exec: fakeClaude({ failures: { update: { stderr: 'no' } } }).exec, println: (line) => failed.push(line) })).toBe(false);
    expect(failed).toEqual([
      '  plugin   not updated from here; in Claude Code, type:',
      '     /plugin marketplace update omni-loop',
      '     /plugin update omni@omni-loop',
    ]);
  });
});
