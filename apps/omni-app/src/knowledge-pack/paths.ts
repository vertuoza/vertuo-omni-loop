// What a knowledge pack holds, and which merges make one (PRD 2011 s11), read from a repository's config
// at the merge commit: pure, no GitHub and no database.
//
//   folders   the knowledge base: `paths.knowledge`, and `paths.adr`, `paths.playbook` and
//             `paths.glossary` when one lies outside it; a folder inside another is read with it
//   files     the flow config: `.omni-loop/config.yml` itself, and every hook file its `flow` names, at
//             the root or in an area, by its repository path. A hook that is a slash command
//             (`{ path: /create-pr, alias: claude }`) names no file, and adds none
//
// A merge makes a pack when one of the files it changed (a rename by its old path too) is under one of
// the folders or is one of the files. Any other merge makes none.
import { CONFIG_FILE } from 'vertuo-omni-plan/kit/lib/config.ts';
import { hooksByMode, type Flow, type FlowHooks } from 'vertuo-omni-plan/kit/lib/flow/schema.ts';

/** The parts of a config a pack is read from. */
export type PackConfig = {
  paths: { knowledge: string; adr?: string | null; playbook?: string | null; glossary?: string | null };
  flow?: Flow | undefined;
};

/** What a pack holds: whole folders, and single files. */
export type PackPaths = { folders: string[]; files: string[] };

/** A file a merge changed: its path, and its old path when it was renamed. */
export type ChangedPath = { path: string; previous?: string | null | undefined };

/**
 * `path` as a repository path (`a/b`), or null when it is none: empty, absolute, climbing out with
 * `..`, or holding a backslash. A `.` segment, a leading `./` and a trailing `/` are dropped.
 */
export function repositoryPath(path: string): string | null {
  if (path.startsWith('/') || path.includes('\\')) return null;
  const segments = path.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0 || segments.includes('..')) return null;
  return segments.join('/');
}

/** Whether `path` is `folder` or lies under it. */
const within = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);

/** The knowledge base's folders, each once, a folder inside another left to it, sorted. */
export function knowledgeFolders(config: PackConfig): string[] {
  const { knowledge, adr, playbook, glossary } = config.paths;
  const named = [knowledge, adr, playbook, glossary]
    .map((path) => (typeof path === 'string' ? repositoryPath(path) : null))
    .filter((path): path is string => path !== null);
  const unique = [...new Set(named)];
  return unique.filter((folder) => !unique.some((other) => other !== folder && within(folder, other))).sort();
}

/** The hook files of one `hooks` section, by repository path. */
function hookFiles(hooks: FlowHooks | undefined): string[] {
  return Object.values(hooks ?? {}).flatMap((value) => {
    const { before, after, replace } = hooksByMode(value);
    return [...before, ...(replace === null ? [] : [replace]), ...after].flatMap((ref) => {
      const path = typeof ref === 'string' ? ref : ref.path;
      if (typeof ref !== 'string' && path.startsWith('/')) return [];
      const file = repositoryPath(path);
      return file === null ? [] : [file];
    });
  });
}

/** The flow config's files: the config itself, then every hook file its flow names, each once, sorted. */
export function flowFiles(config: PackConfig): string[] {
  const { flow } = config;
  const hooks = flow ? [...hookFiles(flow.hooks), ...Object.values(flow.areas ?? {}).flatMap((area) => hookFiles(area.hooks))] : [];
  return [...new Set([CONFIG_FILE, ...hooks])].sort();
}

/** Everything a pack of this repository holds. */
export function packPaths(config: PackConfig): PackPaths {
  const folders = knowledgeFolders(config);
  const files = flowFiles(config).filter((file) => !folders.some((folder) => within(file, folder)));
  return { folders, files };
}

/** Whether a merge that changed `changed` touches what a pack holds, and so makes one. */
export function touchesPack(changed: readonly ChangedPath[], { folders, files }: PackPaths): boolean {
  const held = (path: string) => files.includes(path) || folders.some((folder) => within(path, folder));
  return changed.some(({ path, previous }) => held(path) || (typeof previous === 'string' && held(previous)));
}
