import type { WorkspaceGithub } from '../data/workspace';
import type { InstalledRepo } from './access';
import type { KnowledgeReader } from './github';

// The repositories the knowledge map's menu offers a member of the crew, besides the checkout the app
// is deployed from: for each of their workspaces, the repositories its App installation reaches that
// carry the loop's config, each once whatever its case, by name. A workspace whose installation cannot
// be read leaves the others offered; without the App's credentials, or when the workspaces cannot be
// read, none is, and the menu is not drawn. Each failure is one line in the log.

const why = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));

export async function installedRepos(
  reader: KnowledgeReader | null,
  workspaces: () => Promise<WorkspaceGithub[]>,
  log: (line: string) => void = console.error,
): Promise<InstalledRepo[]> {
  if (!reader) return [];
  let places: WorkspaceGithub[];
  try {
    places = await workspaces();
  } catch (error) {
    log(`knowledge map: no other repository is offered, the workspaces cannot be read — ${why(error)}`);
    return [];
  }
  const found = await Promise.all(places.map(async (place): Promise<InstalledRepo[]> => {
    try {
      const installation = await reader.installationFor(place);
      if (installation === null) return [];
      return (await reader.repos(installation)).map((repo) => ({ repo, installation }));
    } catch (error) {
      log(`knowledge map: the repositories of ${place.slug} could not be read from GitHub — ${why(error)}`);
      return [];
    }
  }));
  const seen = new Set<string>();
  const once = found.flat().filter(({ repo }) => {
    const key = repo.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return once.sort((a, b) => a.repo.localeCompare(b.repo, 'en', { sensitivity: 'base' }));
}
