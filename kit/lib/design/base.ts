// PRD 1369: the base `omni design touched` diffs against when none is given — the branch's own base:
// on a slice branch (`branches.slice`), its feature branch on the remote; on any other branch, the
// remote default branch.
import type { Config } from '../types.ts';

/** What the base reads of the config. */
type BaseConfig = {
  readonly repo: Pick<Config['repo'], 'remote' | 'defaultBranch'>;
  readonly branches: Pick<Config['branches'], 'feature' | 'slice'>;
};

/** The slice template as an anchored pattern whose first group is the topic. */
function slicePattern(template: string): RegExp {
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\{topic\}/, '(.+?)').replace(/\{slice\}/, '[^/]+')}$`);
}

/** `<remote>/<feature branch>` on a slice branch, else `<remote>/<default branch>`; `branch` is null on a detached head. */
export function defaultDesignBase(branch: string | null, { repo, branches }: BaseConfig): string {
  const topic = branch === null ? undefined : slicePattern(branches.slice).exec(branch)?.[1];
  if (topic === undefined) return `${repo.remote}/${repo.defaultBranch}`;
  return `${repo.remote}/${branches.feature.replace(/\{topic\}/g, topic)}`;
}
