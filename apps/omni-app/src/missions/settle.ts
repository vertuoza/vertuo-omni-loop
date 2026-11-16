// The App settles a high item the fleet's committee answered (PRD 2896 s10, spec "6. The committee, at `alone`"): one commit on
// the PRD's feature branch, through GitHub's REST API only, as the App's installation:
//
//   read     the feature pull request (its base, its head branch and sha), then the head's `.omni-loop/config.yml` and that PRD's
//            outbox folder only, through ../snapshot/snapshot.ts, parsed by the kit's own outbox reader, never by running
//            anything it fetched
//   settle   the kit's `settleByFleet` (kit/lib/outbox/fleet.ts): `settled.md` appended with the item as raised and the answer as
//            `answered by fleet <key>`, option A and each verdict, and the item file deleted, in one commit on the feature branch,
//            moved without force (../git-write/git-write.ts): a push since the read makes GitHub refuse it, and the next run reads
//            again
//   refuses  a pull request into the default branch, before any write: a person answers its items (BR-PRODUCT-5), and the App
//            never writes to the default branch; a closed one; an item the kit refuses to settle. Each is an answer, never a throw.
//            An item no longer open was settled already: nothing is written
//
// Throws when GitHub answers out of shape or fails otherwise: the run fails, and the worker retries it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { settleByFleet, type FleetAnswer } from 'omni-loop/kit/lib/outbox/fleet.ts';
import { addCommit } from '../git-write/git-write.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import { prdOutboxAt } from './join.ts';

/** Where the item is: the installation, the repository (`owner/name`), the PRD, its feature pull request and the item's id. */
export type ItemAt = { installation: number; repo: string; prd: PrdNumber; pr: PrNumber; item: string };

/** What the fleet answered, but where: the pull request's number and link are read here. */
export type Answered = Omit<FleetAnswer, 'pr' | 'url'>;

/** What a settlement did: written (`settled`), found settled already, or why it was not written. */
export type Settled = { ok: true; settled: boolean } | { ok: false; why: string };

/** What the supervisor asks of GitHub to settle an item the fleet answered. */
export type MissionAnswers = { settle: (at: ItemAt & { answer: Answered }) => Promise<Settled> };

/** `GET /repos/{owner}/{repo}/pulls/{pull_number}`: the fields a settlement reads. */
const PullSchema = z.looseObject({
  html_url: z.string(),
  state: z.string(),
  base: z.looseObject({ ref: z.string(), repo: z.looseObject({ default_branch: z.string() }) }),
  head: z.looseObject({ ref: z.string(), sha: z.string() }),
});

/** The commit's message: what was settled, and in whose name. */
const messageOf = (item: string, prd: PrdNumber, fleet: string): string => `docs(outbox): ${item} answered by fleet ${fleet}\n\nPart of #${String(prd)}`;

/** Settles items the fleet answered, through `octokitFor(installation)`. */
export function missionAnswers({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionAnswers {
  return {
    async settle({ installation, repo: slug, prd, pr, item, answer }) {
      const [owner = '', repo = ''] = slug.split('/');
      const octokit = await octokitFor(installation);
      const pull = PullSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: pr })).data);
      const defaultBranch = pull.base.repo.default_branch;
      if (pull.base.ref === defaultBranch) return { ok: false, why: `#${String(pr)} targets ${defaultBranch}, the default branch: a person answers its items` };
      if (pull.state !== 'open') return { ok: false, why: `#${String(pr)} is closed` };
      const folder = mkdtempSync(join(tmpdir(), 'omni-settle-'));
      try {
        const ref = pull.head.sha;
        const read = await prdOutboxAt(octokit, { owner, repo, ref, prd, folder });
        if ('notRead' in read) return { ok: false, why: `the head of #${String(pr)}: ${read.notRead}` };
        const settled = settleByFleet({ ctx: read.ctx, prd, item, answer: { ...answer, pr, url: pull.html_url } });
        if (!settled.ok) return settled.gone === true ? { ok: true, settled: false } : { ok: false, why: settled.errors.join('; ') };
        await addCommit(octokit, {
          owner,
          repo,
          branch: pull.head.ref,
          parent: ref,
          message: messageOf(item, prd, answer.fleet),
          defaultBranch,
          files: [{ path: settled.settledFile, content: settled.text }],
          deletes: settled.deletes,
        });
        return { ok: true, settled: true };
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    },
  };
}
