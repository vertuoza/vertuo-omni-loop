// Which files of the head's delivery folder the outbox check fetches (issue 1968). The gate finds a
// feature PR's PRD among the folder names under the delivery folder, then reads the contents of that
// PRD's folders alone; a fix PR's, its fix folder's alone. So every other folder is listed, never
// fetched: on a repository with a long shipped history, fetching them all cost a GitHub call per
// file and drained the installation's budget. A knowledge PR's or an enforce PR's check reads the
// knowledge alone, so it fetches no folder (issue 2210: past the snapshot's bound, every such check
// failed). A pull request the check does not gate fetches everything, as before.
import { issuePrefix } from 'vertuo-omni-plan/kit/lib/fix-verdict.ts';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { pullKind, type PrFacts, type PullKind } from '../evaluate/evaluate.ts';

/**
 * Whether the file at a repository `path` is fetched: a file outside the delivery folder, or not in
 * a folder of one of its areas (`<delivery>/<area>/<folder>/…`), always is; one inside such a folder
 * only when that folder is the pull request's own.
 */
export function deliveryFetched(config: Config, pr: Pick<PrFacts, 'baseRef' | 'headRef'>): (path: string) => boolean {
  const kind = pullKind(pr, config);
  if ('skip' in kind) return () => true;
  const own = ownFolder(kind);
  const delivery = `${config.paths.delivery.replace(/\/+$/, '')}/`;
  return (path) => {
    if (!path.startsWith(delivery)) return true;
    const [, folder, ...rest] = path.slice(delivery.length).split('/');
    return folder === undefined || rest.length === 0 || own(folder);
  };
}

/** The folders of the delivery folder the pull request's check reads: none for a knowledge or an enforce PR. */
function ownFolder(kind: PullKind): (folder: string) => boolean {
  if (kind.kind === 'feature') return featureFolder(kind.topic);
  if (kind.kind === 'fix') return fixFolder(kind.topic);
  return () => false;
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
