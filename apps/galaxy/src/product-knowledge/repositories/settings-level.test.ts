import { describe, expect, it } from 'vitest';
import type { SettingsWorkspace } from '../../omni-settings/omni-settings.repository';
import type { SettingsGithub } from '../../omni-settings/omni-settings.service';
import { repositoriesSection } from './repositories-section';
import { readSettingsLevel } from './settings-level';

// The Omni settings level of the Repositories section (PRD 2419 s2) over a fake GitHub: the settings
// repository's pages mark a page neither the repository nor its plan repository holds as Omni settings,
// its owner the page's `owner:` line else the settings repository's law owners; no settings repository,
// or one the Omni app cannot read, leaves the level empty and never throws.

const COMMIT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const ACME: SettingsWorkspace = { id: 'w-acme', githubOrg: 'acme', installation: 77, planRepo: 'plan', settingsRepository: null };
const form = (id: string, extra = '') =>
  `---\nform: ${id}\nform-version: 1\nstate: filled\n${extra}points-to: null\nevidence: null\ninvaded: null\n---\n\n# ${id} for all\n\n## One\n<!-- slot: one · required -->\nText.\n`;
const FILES: Record<string, string> = {
  '.omni-loop/settings/playbook/ci.md': form('ci'),
  '.omni-loop/settings/playbook/testing.md': form('testing', 'owner: [sol]\n'),
  '.omni-loop/config.yml': 'kit: 1\nlaws:\n  owners: [maya]\n',
};

type World = { workspaces?: SettingsWorkspace[]; files?: Record<string, string>; installation?: number | null; head?: string | null; fails?: boolean };

function read(world: World = {}, anchor: string | null = 'acme/api') {
  const { workspaces = [ACME], files = FILES, installation = 77, head = COMMIT, fails = false } = world;
  const logged: string[] = [];
  const github: SettingsGithub = {
    installationFor: () => (fails ? Promise.reject(new Error('GitHub is down')) : Promise.resolve(installation)),
    head: () => Promise.resolve(head),
    file: (_i, _r, _c, path) => Promise.resolve(files[path] ?? null),
  };
  return readSettingsLevel(anchor, { workspacesListing: () => Promise.resolve(workspaces) }, github, (line) => logged.push(line)).then((level) => ({ level, logged }));
}

describe('the Omni settings level', () => {
  it('is the settings repository with its pages and its law owners', async () => {
    const { level } = await read();
    expect(level?.repository).toBe('acme/plan');
    expect(level?.level.pages.map((p) => [p.form, p.file]).sort()).toEqual([
      ['ci', '.omni-loop/settings/playbook/ci.md'],
      ['testing', '.omni-loop/settings/playbook/testing.md'],
    ]);
    expect(level?.level.lawOwners).toEqual(['maya']);
  });

  it('marks a page nothing nearer holds as Omni settings, owned by its owner line else the settings law owners', async () => {
    const { level } = await read();
    const data = repositoriesSection({
      product: 'p-1', repositories: ['acme/api'], plan: null, settings: level,
      packs: new Map([['acme/api', { sha: 'a'.repeat(40), committedAt: '2026-11-02T09:00:00Z', files: [] }]]),
    });
    const api = data.repositories[0];
    const page = (id: string) => (api?.pack ? api.pages.find((p) => p.form === id) : undefined);
    expect(page('ci')).toMatchObject({ level: 'omni settings', from: 'acme/plan', owners: ['maya'] });
    expect(page('testing')).toMatchObject({ level: 'omni settings', from: 'acme/plan', owners: ['sol'] });
    expect(page('setup')).toMatchObject({ level: 'kit default' });
  });

  it('is the chosen settings repository when the owner chose one, whatever the plan repository is (PRD 2543)', async () => {
    const { level } = await read({ workspaces: [{ ...ACME, settingsRepository: 'acme/playbook' }] });
    expect(level?.repository).toBe('acme/playbook');
  });

  it('is empty, with no error, for a product with no repository to anchor on', async () => {
    expect((await read({}, null)).level).toBeNull();
  });

  it('is empty when no workspace the caller reads lists the repository', async () => {
    expect((await read({ workspaces: [] })).level).toBeNull();
  });

  it('is empty when the workspace names no settings repository', async () => {
    expect((await read({ workspaces: [{ ...ACME, planRepo: null }] })).level).toBeNull();
  });

  it('is empty when the Omni app is not installed or cannot read the repository', async () => {
    expect((await read({ installation: null })).level).toBeNull();
    expect((await read({ head: null })).level).toBeNull();
  });

  it('is empty when the settings repository holds no page', async () => {
    expect((await read({ files: { '.omni-loop/config.yml': FILES['.omni-loop/config.yml'] ?? '' } })).level).toBeNull();
  });

  it('is empty, and logs why, when GitHub fails', async () => {
    const { level, logged } = await read({ fails: true });
    expect(level).toBeNull();
    expect(logged).toEqual(['product knowledge: the settings level could not be read (GitHub is down)']);
  });

  it('reads no law owner when the settings repository has no config', async () => {
    const { level } = await read({ files: { '.omni-loop/settings/playbook/ci.md': form('ci') } });
    expect(level?.level.lawOwners).toEqual([]);
  });
});
