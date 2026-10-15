// Which files of the head's delivery folder the outbox check fetches (issue 1968). The gate finds a
// feature PR's PRD among the folder names under the delivery folder, then reads the contents of that
// PRD's folders alone; a fix PR's, its fix folder's alone. So every other folder is listed, never
// fetched: on a repository with a long shipped history, fetching them all cost a GitHub call per
// file and drained the installation's budget. A pull request of any other kind fetches everything,
// as before.
import { issuePrefix } from 'vertuo-omni-plan/kit/lib/fix-verdict.ts';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { pullKind, type PrFacts } from '../evaluate/evaluate.ts';

/**
 * Whether the file at a repository `path` is fetched: a file outside the delivery folder, or not in
 * a folder of one of its areas (`<delivery>/<area>/<folder>/…`), always is; one inside such a folder
 * only when that folder is the pull request's own.
 */
export function deliveryFetched(config: Config, pr: Pick<PrFacts, 'baseRef' | 'headRef'>): (path: string) => boolean {
  const kind = pullKind(pr, config);
  if ('skip' in kind || (kind.kind !== 'feature' && kind.kind !== 'fix')) return () => true;
  const own = kind.kind === 'feature' ? featureFolder(kind.topic) : fixFolder(kind.topic);
  const delivery = `${config.paths.delivery.replace(/\/+$/, '')}/`;
  return (path) => {
    if (!path.startsWith(delivery)) return true;
    const [, folder, ...rest] = path.slice(delivery.length).split('/');
    return folder === undefined || rest.length === 0 || own(folder);
  };
}

/** A feature PR's folders: those named `<nnnn>-<topic>`, in whichever area they sit. */
function featureFolder(topic: string): (folder: string) => boolean {
  return (folder) => parseFolderName(folder)?.topic === topic;
}

/** A fix PR's folder: the one named after the issue its topic starts with (`<n>-<slug>`). */
function fixFolder(topic: string): (folder: string) => boolean {
  const digits = /^(\d+)-/.exec(topic)?.[1];
  if (digits === undefined || Number(digits) === 0) return () => false;
  const prefix = issuePrefix(parsePrd(digits));
  return (folder) => folder.startsWith(prefix);
}
