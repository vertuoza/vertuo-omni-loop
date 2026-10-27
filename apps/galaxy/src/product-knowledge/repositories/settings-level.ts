import { CONFIG_FILE } from 'omni-loop/kit/lib/config.ts';
import { packLevel } from 'omni-loop/kit/lib/knowledge-tree/pages.ts';
import { settingsFilePath } from 'omni-loop/kit/lib/omni-settings/layout.ts';
import type { OmniSettingsRepository } from '../../omni-settings/omni-settings.repository';
import { readWorkspacePlaybook, type SettingsGithub } from '../../omni-settings/omni-settings.service';
import type { SettingsLevel } from './repositories-section';

// The Omni settings level of the Repositories section (PRD 2419 s2): the pages of the workspace's
// settings repository, read as PRD 2417's service reads them (as the Omni app), so a page neither a
// repository nor its plan repository holds reads the settings repository's, marked Omni settings. Its
// owner is the page's `owner:` line, else the settings repository's law owners (its config's
// `laws.owners`, read here).
//
// - The workspace is the one that lists the anchor repository (a repository of the product) and the
//   caller reads; none, or no settings repository, or one the Omni app cannot read or that holds no
//   page, leaves the level empty (`null`), never an error: the pages read the kit default as before.
// - A GitHub failure is logged and leaves the level empty too.

/** The settings repository's level for the workspace that lists `anchor`, or null when there is none to read. */
export async function readSettingsLevel(
  anchor: string | null,
  store: Pick<OmniSettingsRepository, 'workspacesListing'>,
  github: SettingsGithub,
  log: (line: string) => void = console.error,
): Promise<SettingsLevel | null> {
  if (anchor === null) return null;
  try {
    const [workspace] = await store.workspacesListing(anchor.toLowerCase());
    if (!workspace) return null;
    const playbook = await readWorkspacePlaybook(workspace, github);
    const { repository, commit } = playbook;
    if (repository === null || commit === null || playbook.files.length === 0) return null;
    const installation = await github.installationFor({ github_org: workspace.githubOrg, github_installation_id: workspace.installation });
    const config = installation === null ? null : await github.file(installation, repository, commit, CONFIG_FILE);
    const lawOwners = config === null ? [] : packLevel([{ path: CONFIG_FILE, content: config }]).level.lawOwners;
    const pages = playbook.files.flatMap((file) => {
      const path = settingsFilePath(file.form);
      return path === null ? [] : [{ form: file.form, file: path, text: file.text }];
    });
    return { repository, level: { pages, records: [], lawOwners } };
  } catch (error) {
    log(`product knowledge: the settings level could not be read (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}
