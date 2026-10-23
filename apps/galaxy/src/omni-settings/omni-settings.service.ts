import { FORM_IDS } from 'omni-loop/kit/lib/playbook/forms.ts';
import { settingsFilePath } from 'omni-loop/kit/lib/omni-settings/layout.ts';
import type { PlaybookPage, PlaybookPagesView, SettingsFile, SettingsPlaybook } from './omni-settings.contract';
import type { OmniSettingsRepository, SettingsWorkspace } from './omni-settings.repository';

// The Omni settings area's rules (PRD 2417, s3): what a repository reads of its workspace's tech
// playbook.
//
// - The repository must be listed by a workspace the caller reads, else it is refused (`unlisted`).
// - The settings repository is the workspace's plan repository (`plan_repo`, a name under its GitHub
//   account). A workspace naming none has no settings repository: the reply is an empty list that says
//   so (outbox item: which repository is the settings one when none is named).
// - Each form's file under the settings folder (kit/lib/omni-settings/layout.ts) is read at the commit
//   the repository's default branch is at, as the Omni app. A form with no file is left out; a
//   settings repository with none answers an empty list and says why. A GitHub failure throws.

/** What the service reads on GitHub, as the Omni app. */
export type SettingsGithub = {
  /** The installation a workspace owns, or null when the App is not installed there. */
  installationFor(workspace: { github_org: string | null; github_installation_id: number | null }): Promise<number | null>;
  /** The commit the default branch of `repository` is at, or null when the repository is not there. */
  head(installation: number, repository: string): Promise<string | null>;
  /** The text of `path` at `commit`, or null when it is not there. */
  file(installation: number, repository: string, commit: string, path: string): Promise<string | null>;
};

type SettingsRead = { ok: true; playbook: SettingsPlaybook } | { ok: false; kind: 'unlisted' };

const empty = (reason: string, repository: string | null = null, commit: string | null = null): SettingsPlaybook => ({
  repository,
  commit,
  files: [],
  reason,
});

/** The settings repository a workspace names, as owner/name, or null when it names none. */
export function settingsRepositoryOf(workspace: SettingsWorkspace): string | null {
  const plan = workspace.planRepo?.trim() ?? '';
  if (plan === '') return null;
  if (plan.includes('/')) return plan;
  return workspace.githubOrg ? `${workspace.githubOrg}/${plan}` : null;
}

/** What a workspace's settings repository holds of the tech playbook, read as the Omni app. */
async function readWorkspacePlaybook(workspace: SettingsWorkspace, github: SettingsGithub): Promise<SettingsPlaybook> {
  const repository = settingsRepositoryOf(workspace);
  if (repository === null) return empty('This workspace has no settings repository: no plan repository is named.');
  const installation = await github.installationFor({ github_org: workspace.githubOrg, github_installation_id: workspace.installation });
  if (installation === null) return empty(`The Omni app is not installed where ${repository} lives.`);
  const commit = await github.head(installation, repository);
  if (commit === null) return empty(`The Omni app cannot read ${repository}.`);
  const read = await Promise.all(
    FORM_IDS.map(async (form): Promise<SettingsFile | null> => {
      const path = settingsFilePath(form);
      const text = path === null ? null : await github.file(installation, repository, commit, path);
      return text === null ? null : { form, text };
    }),
  );
  const files = read.filter((file): file is SettingsFile => file !== null);
  if (files.length === 0) return empty(`${repository} holds no settings playbook page yet.`, repository, commit);
  return { repository, commit, files, reason: null };
}

export function omniSettingsService(store: Pick<OmniSettingsRepository, 'workspacesListing'>, github: SettingsGithub) {
  return {
    /** What `repo` (owner/name) reads of its workspace's tech playbook. */
    async playbook(repo: string): Promise<SettingsRead> {
      const [workspace] = await store.workspacesListing(repo.toLowerCase());
      if (!workspace) return { ok: false, kind: 'unlisted' };
      return { ok: true, playbook: await readWorkspacePlaybook(workspace, github) };
    },
  };
}
export type OmniSettingsService = ReturnType<typeof omniSettingsService>;

// The Omni page's view of the same playbook (PRD 2417, s6), page by page. Each page is the settings
// repository's own file when it holds one, else the kit's first default (the curated pages), and says
// which. The pages come in the curated order, then the settings repository's other pages. A workspace
// with no settings repository, or one the Omni app cannot read, lists no page: the reason says what to
// do. A settings repository holding no page lists the kit's first default, every page marked so.

/** The pages of `playbook`, merged with the kit's first default `curated`. */
export function playbookPages(playbook: SettingsPlaybook, curated: readonly SettingsFile[]): PlaybookPage[] {
  if (playbook.repository === null || playbook.commit === null) return [];
  const own = new Map(playbook.files.map((file) => [file.form, file.text]));
  const kit = curated.map((file): PlaybookPage => ({ form: file.form, text: own.get(file.form) ?? file.text, source: own.has(file.form) ? 'settings' : 'kit' }));
  const kept = new Set(curated.map((file) => file.form));
  const others = playbook.files.filter((file) => !kept.has(file.form)).map((file): PlaybookPage => ({ ...file, source: 'settings' }));
  return [...kit, ...others];
}

export function omniSettingsPagesService(
  store: Pick<OmniSettingsRepository, 'workspaceById'>, github: SettingsGithub, curated: () => readonly SettingsFile[],
) {
  return {
    /** The tech playbook the workspace's page shows, or null when the caller reads no such workspace. */
    async pages(workspaceId: string): Promise<PlaybookPagesView | null> {
      const workspace = await store.workspaceById(workspaceId);
      if (!workspace) return null;
      const playbook = await readWorkspacePlaybook(workspace, github);
      return { repository: playbook.repository, commit: playbook.commit, reason: playbook.reason, pages: playbookPages(playbook, curated()) };
    },
  };
}
export type OmniSettingsPagesService = ReturnType<typeof omniSettingsPagesService>;
