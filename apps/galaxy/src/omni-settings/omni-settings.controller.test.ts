import { describe, expect, it } from 'vitest';
import { SettingsPlaybookSchema } from './omni-settings.contract';
import { readSettingsPlaybook, type OmniSettingsDeps } from './omni-settings.controller';
import type { SettingsWorkspace } from './omni-settings.repository';
import { omniSettingsService, settingsRepositoryOf, type SettingsGithub } from './omni-settings.service';

// GET /api/omni-settings/playbook (PRD 2417, s3), with a fake database and a fake GitHub behind the
// real service: a signed-out request is refused before any read, a repository outside the caller's
// workspaces is 403, a workspace with no settings repository or no pages is an empty list with its
// reason, and a read is the kit's own shape.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test' };
const COMMIT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const ACME: SettingsWorkspace = { id: 'w-acme', githubOrg: 'acme', installation: 77, planRepo: 'plan', settingsRepository: null };
const SETTINGS = '.omni-loop/settings';
const NO_SETTINGS = 'This workspace has no settings repository: none is chosen and no plan repository is named.';

type World = {
  listings?: Record<string, SettingsWorkspace[]>;
  files?: Record<string, string>;
  installation?: number | null;
  head?: string | null;
  failing?: boolean;
};

function world({ listings = { 'acme/app': [ACME] }, files = {}, installation = 77, head = COMMIT, failing = false }: World = {}, database = true) {
  const reads: string[] = [];
  const logged: string[] = [];
  const store = {
    workspacesListing: (repo: string) => {
      reads.push(`listing ${repo}`);
      return failing ? Promise.reject(new Error('read the workspaces: boom')) : Promise.resolve(listings[repo] ?? []);
    },
  };
  const github: SettingsGithub = {
    installationFor: () => Promise.resolve(installation),
    head: (_installation, repository) => {
      reads.push(`head ${repository}`);
      return Promise.resolve(head);
    },
    file: (_installation, repository, commit, path) => {
      reads.push(`file ${repository}@${commit} ${path}`);
      return Promise.resolve(files[path] ?? null);
    },
  };
  const service = omniSettingsService(store, github);
  const deps: OmniSettingsDeps = {
    connect: database ? () => ({ auth: { getUser: () => Promise.resolve({ data: { user: ADA }, error: null }) }, service }) : null,
    installLink: 'https://github.com/apps/omni',
    log: (line) => { logged.push(line); },
  };
  return { deps, reads, logged };
}

const get = (deps: OmniSettingsDeps, repo = 'acme/app', headers: Record<string, string> = { authorization: 'Bearer t0k' }) =>
  readSettingsPlaybook(new Request(`https://omni.test/api/omni-settings/playbook${repo ? `?repo=${repo}` : ''}`, { headers }), deps);

describe('GET /api/omni-settings/playbook', () => {
  it('reads each playbook page of the settings repository at one commit', async () => {
    const { deps, reads } = world({ files: { [`${SETTINGS}/playbook/review.md`]: '# Review\n', [`${SETTINGS}/adr/README.md`]: '# Decisions\n' } });
    const res = await get(deps);
    expect(res.status).toBe(200);
    const body = SettingsPlaybookSchema.parse(await res.json());
    expect(body).toMatchObject({ repository: 'acme/plan', commit: COMMIT, reason: null });
    expect(body.files).toHaveLength(2);
    expect(body.files).toEqual(expect.arrayContaining([{ form: 'review', text: '# Review\n' }, { form: 'decisions', text: '# Decisions\n' }]));
    expect(reads).toContain(`file acme/plan@${COMMIT} ${SETTINGS}/playbook/review.md`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers an empty list with its reason when the settings repository holds no page', async () => {
    const res = await get(world().deps);
    expect(res.status).toBe(200);
    const body = SettingsPlaybookSchema.parse(await res.json());
    expect(body.files).toEqual([]);
    expect(body).toMatchObject({ repository: 'acme/plan', commit: COMMIT, reason: 'acme/plan holds no settings playbook page yet.' });
  });

  it('answers an empty list when the workspace names no plan repository', async () => {
    const { deps, reads } = world({ listings: { 'acme/app': [{ ...ACME, planRepo: null }] } });
    const res = await get(deps);
    expect(res.status).toBe(200);
    expect(SettingsPlaybookSchema.parse(await res.json())).toEqual({
      repository: null, commit: null, files: [], reason: NO_SETTINGS,
    });
    expect(reads).toEqual(['listing acme/app']);
  });

  it('answers an empty list when the App is not installed or cannot read the repository', async () => {
    const none = SettingsPlaybookSchema.parse(await (await get(world({ installation: null }).deps)).json());
    expect(none).toMatchObject({ repository: null, files: [], reason: 'The Omni app is not installed where acme/plan lives.' });
    const unread = SettingsPlaybookSchema.parse(await (await get(world({ head: null }).deps)).json());
    expect(unread).toMatchObject({ repository: null, files: [], reason: 'The Omni app cannot read acme/plan.' });
  });

  it('refuses a repository outside the caller\'s workspaces with 403', async () => {
    const res = await get(world().deps, 'other/app');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No workspace of yours lists other/app: install the Omni App: https://github.com/apps/omni' });
  });

  it('matches the repository whatever its case', async () => {
    const res = await get(world().deps, 'Acme/App');
    expect(res.status).toBe(200);
  });

  it('refuses a signed-out request before any read', async () => {
    const { deps, reads } = world();
    const res = await get(deps, 'acme/app', {});
    expect(res.status).toBe(401);
    expect(reads).toEqual([]);
  });

  it('refuses a missing or malformed repository with 400', async () => {
    expect((await get(world().deps, '')).status).toBe(400);
    expect((await get(world().deps, 'not-a-repo')).status).toBe(400);
  });

  it('answers 503 with no database, and 500 in plain words when a read fails', async () => {
    expect((await get(world({}, false).deps)).status).toBe(503);
    const { deps, logged } = world({ failing: true });
    const res = await get(deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'The settings playbook could not be read. Try again.' });
    expect(logged).toEqual(['omni settings: read the workspaces: boom']);
  });
});

describe('settingsRepositoryOf', () => {
  it('puts a bare plan repository under the workspace\'s account and keeps a full name', () => {
    expect(settingsRepositoryOf(ACME)).toBe('acme/plan');
    expect(settingsRepositoryOf({ ...ACME, planRepo: 'other/settings' })).toBe('other/settings');
    expect(settingsRepositoryOf({ ...ACME, githubOrg: null })).toBeNull();
    expect(settingsRepositoryOf({ ...ACME, planRepo: '  ' })).toBeNull();
  });

  // PRD 2543: the settings repository the owner chose comes first, then the plan repository, then none.
  it('reads the chosen settings repository before the plan repository', () => {
    expect(settingsRepositoryOf({ ...ACME, settingsRepository: 'acme/playbook' })).toBe('acme/playbook');
    expect(settingsRepositoryOf({ ...ACME, planRepo: 'other/settings', settingsRepository: 'acme/playbook' })).toBe('acme/playbook');
    expect(settingsRepositoryOf({ ...ACME, planRepo: null, githubOrg: null, settingsRepository: 'acme/playbook' })).toBe('acme/playbook');
  });

  it('falls back to the plan repository while none is chosen, then to none', () => {
    expect(settingsRepositoryOf({ ...ACME, settingsRepository: null })).toBe('acme/plan');
    expect(settingsRepositoryOf({ ...ACME, settingsRepository: '  ' })).toBe('acme/plan');
    expect(settingsRepositoryOf({ ...ACME, planRepo: null, settingsRepository: null })).toBeNull();
  });
});

describe('GET /api/omni-settings/playbook, with a chosen settings repository (PRD 2543)', () => {
  it('reads the pages of the chosen repository, whatever the plan repository is', async () => {
    const chosen = { ...ACME, planRepo: 'plan', settingsRepository: 'acme/playbook' };
    const { deps, reads } = world({ listings: { 'acme/app': [chosen] }, files: { [`${SETTINGS}/playbook/review.md`]: '# Review\n' } });
    const body = SettingsPlaybookSchema.parse(await (await get(deps)).json());
    expect(body).toMatchObject({ repository: 'acme/playbook', commit: COMMIT, reason: null, files: [{ form: 'review', text: '# Review\n' }] });
    expect(reads).toContain('head acme/playbook');
    expect(reads.some((read) => read.includes('acme/plan'))).toBe(false);
  });

  it('says the workspace has no settings repository when none is chosen and no plan repository is named', async () => {
    const { deps } = world({ listings: { 'acme/app': [{ ...ACME, planRepo: null, settingsRepository: null }] } });
    expect(SettingsPlaybookSchema.parse(await (await get(deps)).json())).toMatchObject({ repository: null, files: [], reason: NO_SETTINGS });
  });
});
