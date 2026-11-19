// The kit a mission's repository pins (PRD 3088 s5), read from a fake GitHub: never the real one.
import { describe, expect, it } from 'vitest';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import { bundleVersion } from 'omni-loop/kit/lib/update/installed.ts';
import { BIN, isShim, missionKits, packageVersion, stampOf } from './repair.github.ts';

const STAMPED = '#!/usr/bin/env node\nvar define_OMNI_BUNDLE_default = { home: "vertuoza/vertuo-omni-loop", version: "0.0.690" };\n';
const SHIM = "#!/usr/bin/env node\n// a shim onto the live kit source\nimport('../../kit/bin/omni.ts').then(({ main }) => main(process.argv.slice(2)));\n";

/** A GitHub answering each path from `files` (a missing one 404s), recording what was asked. */
function github(files: Record<string, string>, fail: Error | null = null) {
  const asked: Record<string, unknown>[] = [];
  const client: GitHubClient = {
    request: (_route, params = {}) => {
      asked.push(params);
      if (fail !== null) return Promise.reject(fail);
      const text = files[String(params.path)];
      return text === undefined ? Promise.reject(Object.assign(new Error('Not Found'), { status: 404 })) : Promise.resolve({ data: text });
    },
  };
  return { asked, kits: missionKits({ octokitFor: () => client }) };
}

const at = { installation: 1, repo: 'acme/widgets', ref: 'mission/12-faster-quotes' };

describe('the kit a mission\'s repository pins', () => {
  it('reads the version its bin\'s build stamped, on the mission branch, asking for its first bytes only', async () => {
    const { asked, kits } = github({ [BIN]: STAMPED });
    expect(await kits.pinned(at)).toBe('0.0.690');
    expect(asked).toEqual([{ owner: 'acme', repo: 'widgets', path: BIN, ref: 'mission/12-faster-quotes', mediaType: { format: 'raw' }, headers: { range: 'bytes=0-65535' } }]);
  });

  it('reads the default branch when the mission has no branch of its own', async () => {
    const { asked, kits } = github({ [BIN]: STAMPED });
    expect(await kits.pinned({ ...at, ref: null })).toBe('0.0.690');
    expect(asked[0]).not.toHaveProperty('ref');
  });

  it('reads a shim onto the kit\'s source by its package.json, and no other bin\'s', async () => {
    expect(await github({ [BIN]: SHIM, 'package.json': '{"name":"omni-loop","version":"0.0.701"}' }).kits.pinned(at)).toBe('0.0.701');
    expect(await github({ [BIN]: '#!/usr/bin/env node\nconsole.log("old");\n', 'package.json': '{"version":"3.1.0"}' }).kits.pinned(at)).toBeNull();
    expect(isShim(SHIM)).toBe(true);
    expect(packageVersion('{"version":"v0.0.7"}')).toBe('0.0.7');
    expect(packageVersion('not json')).toBeNull();
    expect(packageVersion(null)).toBeNull();
  });

  it('reads the stamp as the kit itself reads it', () => {
    for (const text of [STAMPED, SHIM, 'define_OMNI_BUNDLE_default = { version: "v1.2.3", home: null }', '']) expect(stampOf(text)).toBe(bundleVersion(text));
  });

  it('reads null with no bin, or when GitHub refuses: that reads older than any fix', async () => {
    expect(await github({}).kits.pinned(at)).toBeNull();
    expect(await github({}, new Error('Bad credentials')).kits.pinned(at)).toBeNull();
  });
});
