import { describe, expect, it } from 'vitest';
import type { SettingsFile } from './omni-settings.contract';
import type { SettingsWorkspace } from './omni-settings.repository';
import { omniSettingsPagesService, playbookPages, type SettingsGithub } from './omni-settings.service';

// The Omni page's view of the settings playbook (PRD 2417, s6), with a fake GitHub behind the real
// service: each page says whether it is the settings repository's own or the kit's first default;
// a workspace with no settings repository lists no page and says why; a settings repository with no
// page lists the kit's first default; a workspace the caller cannot read is null.

const COMMIT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const ACME: SettingsWorkspace = { id: 'w-acme', githubOrg: 'acme', installation: 77, planRepo: 'plan', settingsRepository: null };
const SETTINGS = '.omni-loop/settings';
const NO_SETTINGS = 'This workspace has no settings repository: none is chosen and no plan repository is named.';
const KIT: SettingsFile[] = [
  { form: 'review', text: 'kit review' },
  { form: 'definition-of-done', text: 'kit done' },
];

type World = { workspace?: SettingsWorkspace | null; files?: Record<string, string>; installation?: number | null };

function service({ workspace = ACME, files = {}, installation = 77 }: World = {}) {
  const github: SettingsGithub = {
    installationFor: () => Promise.resolve(installation),
    head: () => Promise.resolve(COMMIT),
    file: (_installation, _repository, _commit, path) => Promise.resolve(files[path] ?? null),
  };
  return omniSettingsPagesService({ workspaceById: () => Promise.resolve(workspace), isOwner: (id) => Promise.resolve(id === 'w-acme') }, github, () => KIT);
}

describe('the playbook pages of a workspace', () => {
  it('marks a page the settings repository holds as its own, and the others as the kit\'s', async () => {
    const view = await service({ files: { [`${SETTINGS}/playbook/review.md`]: 'own review' } }).pages('w-acme');
    expect(view).toEqual({
      repository: 'acme/plan',
      commit: COMMIT,
      reason: null,
      pages: [
        { form: 'review', text: 'own review', source: 'settings' },
        { form: 'definition-of-done', text: 'kit done', source: 'kit' },
      ],
    });
  });

  it('lists the settings repository\'s other pages after the kit\'s', async () => {
    const view = await service({ files: { [`${SETTINGS}/playbook/testing.md`]: 'own testing' } }).pages('w-acme');
    expect(view?.pages.map((page) => [page.form, page.source])).toEqual([['review', 'kit'], ['definition-of-done', 'kit'], ['testing', 'settings']]);
  });

  it('lists the kit\'s first default, every page marked so, for a settings repository with no page', async () => {
    const view = await service().pages('w-acme');
    expect(view?.pages.map((page) => page.source)).toEqual(['kit', 'kit']);
    expect(view?.reason).toBe('acme/plan holds no settings playbook page yet.');
  });

  it('lists no page, and says why, for a workspace naming no plan repository', async () => {
    const view = await service({ workspace: { ...ACME, planRepo: null } }).pages('w-acme');
    expect(view).toEqual({
      repository: null,
      commit: null,
      reason: NO_SETTINGS,
      pages: [],
    });
  });

  it('reads the pages from the chosen settings repository, whatever the plan repository is (PRD 2543)', async () => {
    const read: string[] = [];
    const github: SettingsGithub = {
      installationFor: () => Promise.resolve(77),
      head: (_installation, repository) => { read.push(repository); return Promise.resolve(COMMIT); },
      file: (_installation, repository, _commit, path) => { read.push(repository); return Promise.resolve(path === `${SETTINGS}/playbook/review.md` ? 'chosen review' : null); },
    };
    const chosen = { ...ACME, settingsRepository: 'acme/playbook' };
    const view = await omniSettingsPagesService({ workspaceById: () => Promise.resolve(chosen), isOwner: () => Promise.resolve(true) }, github, () => KIT).pages('w-acme');
    expect(view?.repository).toBe('acme/playbook');
    expect(view?.pages[0]).toEqual({ form: 'review', text: 'chosen review', source: 'settings' });
    expect(new Set(read)).toEqual(new Set(['acme/playbook']));
  });

  it('lists no page when the Omni app is not installed there', async () => {
    const view = await service({ installation: null }).pages('w-acme');
    expect(view?.pages).toEqual([]);
    expect(view?.reason).toBe('The Omni app is not installed where acme/plan lives.');
  });

  it('is null for a workspace the caller does not read', async () => {
    expect(await service({ workspace: null }).pages('w-other')).toBeNull();
  });

  it('says whether the caller owns the workspace, as the database answers (s7)', async () => {
    expect(await service().owner('w-acme')).toBe(true);
    expect(await service().owner('w-other')).toBe(false);
  });
});

describe('playbookPages', () => {
  it('lists nothing without a settings repository, whatever the kit holds', () => {
    expect(playbookPages({ repository: null, commit: null, files: [], reason: 'none' }, KIT)).toEqual([]);
  });
});
