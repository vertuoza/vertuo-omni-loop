// PRD 2746, s3: a merged provider's probe, read from its config and its hook file as `gh` would hand
// them, never run. Fixtures are fictional (`demo-org`).
import { describe, expect, it } from 'vitest';
import { readProbes, type FileRead } from './probe.ts';

const INPUTS = { provider: 'demo-org/api#41', pr: '41', 'merge-sha': 'abc123', consumer: 'demo-org/web#88' };

/** A reader that answers from `files`, a path it does not hold being missing. */
const reader = (files: Record<string, string | { failure: string }>) => (path: string): FileRead => {
  const file = files[path];
  if (file === undefined) return { missing: true };
  return typeof file === 'string' ? { text: file } : file;
};

const config = (hooks: string) => `kit: 1\nflow:\n  hooks:\n${hooks}`;

describe('readProbes', () => {
  it('has no probe when the provider has no config, no flow or no hook at the point', () => {
    expect(readProbes('demo-org/api', INPUTS, reader({}))).toEqual({ probes: [] });
    expect(readProbes('demo-org/api', INPUTS, reader({ '.omni-loop/config.yml': 'kit: 1\n' }))).toEqual({ probes: [] });
    expect(readProbes('demo-org/api', INPUTS, reader({ '.omni-loop/config.yml': config('    do-work.test: a.md\n') }))).toEqual({ probes: [] });
  });

  it('names the replace hook, then each after hook, with the hook text\'s inputs filled and its front matter dropped', () => {
    const files = {
      '.omni-loop/config.yml': config('    merge-after.served: { replace: .omni-loop/flow/served.md, after: [.omni-loop/flow/log.md] }\n    do-work.test: x.md\n'),
      '.omni-loop/flow/served.md': '---\nomni-hook: merge-after.served\n---\nAsk the version endpoint for {merge-sha} ({provider}, for {consumer}, PR {pr}); keep {other}.\n',
      '.omni-loop/flow/log.md': 'Note it.\n',
    };
    expect(readProbes('demo-org/api', INPUTS, reader(files))).toEqual({
      probes: [
        { hook: 'demo-org/api:.omni-loop/flow/served.md', mode: 'replace', text: 'Ask the version endpoint for abc123 (demo-org/api#41, for demo-org/web#88, PR 41); keep {other}.\n' },
        { hook: 'demo-org/api:.omni-loop/flow/log.md', mode: 'after', text: 'Note it.\n' },
      ],
    });
  });

  it('takes a bare path as an after hook', () => {
    const files = { '.omni-loop/config.yml': config('    merge-after.served: served.md\n'), 'served.md': 'Check.' };
    expect(readProbes('demo-org/api', INPUTS, reader(files))).toEqual({ probes: [{ hook: 'demo-org/api:served.md', mode: 'after', text: 'Check.' }] });
  });

  it('never reads the config it could not read as no probe', () => {
    expect(readProbes('demo-org/api', INPUTS, reader({ '.omni-loop/config.yml': { failure: 'HTTP 403' } }))).toEqual({ failure: 'could not read the config of demo-org/api: HTTP 403' });
    expect(readProbes('demo-org/api', INPUTS, reader({ '.omni-loop/config.yml': 'kit: [' }))).toMatchObject({ failure: expect.stringMatching(/^the config of demo-org\/api does not parse: /) as string });
    expect(readProbes('demo-org/api', INPUTS, reader({ '.omni-loop/config.yml': config('    merge-after.served: { replace: 7 }\n') }))).toEqual({ failure: 'the merge-after.served hooks of demo-org/api do not parse' });
  });

  it('says why a probe cannot be read: not there, unreadable, a path that leaves the repository, or a slash command', () => {
    const at = (hook: string, extra: Record<string, string | { failure: string }> = {}) =>
      readProbes('demo-org/api', INPUTS, reader({ '.omni-loop/config.yml': config(`    merge-after.served: ${hook}\n`), ...extra }));
    expect(at('{ replace: served.md }')).toEqual({ failure: 'the probe served.md of demo-org/api cannot be read: it does not exist' });
    expect(at('{ replace: served.md }', { 'served.md': { failure: 'HTTP 500' } })).toEqual({ failure: 'the probe served.md of demo-org/api cannot be read: HTTP 500' });
    expect(at('{ replace: ../served.md }')).toEqual({ failure: 'the probe ../served.md of demo-org/api cannot be read: ../served.md holds .. — name a file of this repository by its path from the root' });
    expect(at('{ replace: { path: /served, alias: claude } }')).toEqual({ failure: 'the probe /served of demo-org/api cannot be read: a slash command runs only in its own repository' });
  });
});
