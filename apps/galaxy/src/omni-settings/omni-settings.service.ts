import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { FORM_IDS } from 'omni-loop/kit/lib/playbook/forms.ts';
import { settingsFilePath } from 'omni-loop/kit/lib/omni-settings/layout.ts';
import { readSettingsPage } from 'omni-loop/kit/lib/omni-settings/page.ts';
import type { PlaybookPage, PlaybookPagesView, RepositoryChoice, SettingsFile, SettingsPlaybook } from './omni-settings.contract';
import type { OmniSettingsRepository, SettingsChoice, SettingsWorkspace } from './omni-settings.repository';

// The Omni settings area's rules (PRD 2417, s3): what a repository reads of its workspace's tech
// playbook.
//
// - The repository must be listed by a workspace the caller reads, else it is refused (`unlisted`).
// - The settings repository is the one the workspace's owner chose (`settings_repository`, PRD 2543),
//   else, while none is chosen, the workspace's plan repository (`plan_repo`, a name under its GitHub
//   account). A workspace with neither has no settings repository: the reply is an empty list that
//   says so. Nothing else reads the choice: the game, the dossiers and the points keep `plan_repo`.
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

/** The settings repository of a workspace, as owner/name: the one its owner chose, else its plan
 * repository, else null. */
export function settingsRepositoryOf(workspace: SettingsWorkspace): string | null {
  return chosenRepositoryOf(workspace) ?? planRepositoryOf(workspace);
}

/** The settings repository the workspace's owner chose, or null while none is. */
function chosenRepositoryOf(workspace: SettingsWorkspace): string | null {
  const chosen = workspace.settingsRepository?.trim() ?? '';
  return chosen === '' ? null : chosen;
}

/** The workspace's plan repository as owner/name (a bare name is under its GitHub account), or null. */
function planRepositoryOf(workspace: SettingsWorkspace): string | null {
  const plan = workspace.planRepo?.trim() ?? '';
  if (plan === '') return null;
  if (plan.includes('/')) return plan;
  return workspace.githubOrg ? `${workspace.githubOrg}/${plan}` : null;
}

/** What a workspace's settings repository holds of the tech playbook, read as the Omni app. */
export async function readWorkspacePlaybook(workspace: SettingsWorkspace, github: SettingsGithub): Promise<SettingsPlaybook> {
  const repository = settingsRepositoryOf(workspace);
  if (repository === null) return empty('This workspace has no settings repository: none is chosen and no plan repository is named.');
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
// do, and the view names the repository the workspace names, read or not (issue 2538). A settings
// repository holding no page lists the kit's first default, every page marked so.

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
  store: Pick<OmniSettingsRepository, 'workspaceById' | 'isOwner' | 'listedRepositories'>, github: SettingsGithub, curated: () => readonly SettingsFile[],
) {
  return {
    /** Whether the caller owns the workspace, so the page shows them each page's edit (s7). */
    owner: (workspaceId: string): Promise<boolean> => store.isOwner(workspaceId),

    /** The tech playbook the workspace's page shows, or null when the caller reads no such workspace. */
    async pages(workspaceId: string): Promise<PlaybookPagesView | null> {
      const workspace = await store.workspaceById(workspaceId);
      if (!workspace) return null;
      const playbook = await readWorkspacePlaybook(workspace, github);
      // The repository the workspace names, even when the Omni app could not read it (issue 2538), so
      // the page says it cannot read that one rather than that the workspace names none.
      const choice: RepositoryChoice = {
        chosen: chosenRepositoryOf(workspace),
        plan: planRepositoryOf(workspace),
        listed: await store.listedRepositories(workspace.id),
      };
      return { repository: settingsRepositoryOf(workspace), commit: playbook.commit, reason: playbook.reason, pages: playbookPages(playbook, curated()), choice };
    },
  };
}
export type OmniSettingsPagesService = ReturnType<typeof omniSettingsPagesService>;

// A workspace owner's change to a page (PRD 2417, s7), proposed as a pull request in the settings
// repository, as the Omni app. Nothing is stored on the Omni page (Never 6): the text lives only in the
// pull request until a person merges it, and the next `omni sync` of each repository reads it then.
//
// - Only a workspace owner proposes (`is_owner`); anyone else, and a workspace the caller does not
//   read, is refused (`not-owner`) before anything else is read.
// - The page is a form the kit reads, and its text one the copy's writer keeps (s1's
//   `readSettingsPage`): a text the next sync would skip is refused with its reason (`not-a-page`).
// - The settings repository is the one the page is read from (`settingsRepositoryOf`); none, or the
//   Omni app not installed there or unable to reach it, is said so.
// - A text the settings repository already holds opens nothing (`unchanged`).
// - Each proposal opens its own branch, `omni-settings/<form>-<UTC time>`, off the default branch's
//   head, and one pull request into the default branch naming who proposed it.

/** The change the writer makes: the file, its new text, the branch it goes on and the pull request's words. */
export type PlaybookChange = { path: string; text: string; branch: string; message: string; title: string; body: string };

/** A pull request opened in the settings repository. */
export type ProposedPullRequest = { number: PrNumber; url: string };

/** What the writer did: opened a pull request, found the page already reading so, or could not reach the repository. */
export type ProposeOutcome = { kind: 'opened'; pullRequest: ProposedPullRequest } | { kind: 'unchanged' } | { kind: 'unreachable' };

/** What the edit writes on GitHub, as the Omni app. */
export type SettingsPullRequests = {
  installationFor: SettingsGithub['installationFor'];
  /** Cuts `change.branch` from the default branch, writes the file on it and opens the pull request;
   * opens nothing when the file already reads so. Throws when GitHub refuses a step. */
  propose(installation: number, repository: string, change: PlaybookChange): Promise<ProposeOutcome>;
};

/** A proposal's answer: the pull request opened, or why none was. */
export type Proposal =
  | { ok: true; repository: string; pullRequest: ProposedPullRequest }
  | { ok: false; kind: 'not-owner' | 'no-settings-repository' }
  | { ok: false; kind: 'not-a-page'; reason: string }
  | { ok: false; kind: 'not-installed' | 'unreachable' | 'unchanged'; repository: string };

/** A page's text as committed: line ends as `\n`, one at the end. */
export function committedText(text: string): string {
  return `${text.replace(/\r\n?/g, '\n').replace(/\n*$/, '')}\n`;
}

/** `at` as a branch name's stamp: `20261023-120000`, UTC. */
const stamp = (at: number) => new Date(at).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/** The change `login` proposes to `form`'s page, at `path` of the settings repository. */
export function playbookChange(form: string, path: string, text: string, login: string, at: number): PlaybookChange {
  return {
    path,
    text,
    branch: `omni-settings/${form}-${stamp(at)}`,
    message: `docs(settings): the ${form} page, proposed on the Omni page by @${login}`,
    title: `Playbook: a new ${form} page, from the Omni page`,
    body: [
      `@${login} proposed this change to the \`${form}\` page of the workspace's tech playbook, on the Omni page.`,
      'Nothing is stored on the Omni page: the text lives only in this pull request. Once a person merges it, every repository of the workspace reads the new text on its next `omni sync`.',
    ].join('\n\n'),
  };
}

export function omniSettingsEditService(
  store: Pick<OmniSettingsRepository, 'workspaceById' | 'isOwner'>, github: SettingsPullRequests, clock: () => number = Date.now,
) {
  return {
    /** Proposes `text` as the page `form` of `workspace`'s settings repository, as `login`. */
    async propose(edit: { workspace: string; form: string; text: string }, login: string): Promise<Proposal> {
      const workspace = await store.workspaceById(edit.workspace);
      if (!workspace || !(await store.isOwner(workspace.id))) return { ok: false, kind: 'not-owner' };
      const path = settingsFilePath(edit.form);
      const text = committedText(edit.text);
      const page = readSettingsPage({ form: edit.form, text });
      if (!page.ok) return { ok: false, kind: 'not-a-page', reason: page.reason };
      if (path === null) return { ok: false, kind: 'not-a-page', reason: `${edit.form} is not a form the kit reads` };
      const repository = settingsRepositoryOf(workspace);
      if (repository === null) return { ok: false, kind: 'no-settings-repository' };
      const installation = await github.installationFor({ github_org: workspace.githubOrg, github_installation_id: workspace.installation });
      if (installation === null) return { ok: false, kind: 'not-installed', repository };
      const outcome = await github.propose(installation, repository, playbookChange(edit.form, path, text, login, clock()));
      if (outcome.kind !== 'opened') return { ok: false, kind: outcome.kind, repository };
      return { ok: true, repository, pullRequest: outcome.pullRequest };
    },
  };
}
export type OmniSettingsEditService = ReturnType<typeof omniSettingsEditService>;

// An owner's choice of the settings repository (PRD 2543, s3). The service holds no rule of its own: the
// database's owner-only function decides who may choose and which repository (it must be one the
// workspace lists), on the signed-in person's client, and the service passes its answer through.

export function omniSettingsChoiceService(store: Pick<OmniSettingsRepository, 'chooseSettingsRepository'>) {
  return {
    /** Stores `repository` (owner/name) as `workspace`'s settings repository; null clears the choice. */
    choose: (workspace: string, repository: string | null): Promise<SettingsChoice> => store.chooseSettingsRepository(workspace, repository),
  };
}
export type OmniSettingsChoiceService = ReturnType<typeof omniSettingsChoiceService>;
