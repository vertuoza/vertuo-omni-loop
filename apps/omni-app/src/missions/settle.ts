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
// PRD omni-loop-21 s12, spec "7. Landing": a person's Agree with a deferred decision, on the mission pull request, settles that item
// as theirs, on the mission branch, where the PRD's squash carried the fleet's entry:
//
//   agree    the mission branch's tip, its `.omni-loop/config.yml` and that PRD's outbox folder only; the kit's `agreeEntry`
//            (kit/lib/mission/overturn.ts): `settled.md` gains the person's entry, `Approved by: <login>`, after the fleet's, in one
//            commit on the mission branch, moved without force. The outbox check into the default branch then no longer holds the
//            item (BR-PRODUCT-145). The default branch is refused before the ledger is read; an item whose latest entry is no
//            fleet's (a person answered it, or the branch holds none) writes nothing
//
// Throws when GitHub answers out of shape or fails otherwise: the run fails, and the worker retries it.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { agreeEntry } from 'omni-loop/kit/lib/mission/overturn.ts';
import { settleByFleet, type FleetAnswer } from 'omni-loop/kit/lib/outbox/fleet.ts';
import { SETTLED_FILE } from 'omni-loop/kit/lib/outbox/outbox.ts';
import { addCommit } from '../git-write/git-write.ts';
import { RefSchema, type GitHubClient } from '../outbox-check/github-schema.ts';
import { missionRepo } from './branch.ts';
import { prdOutboxAt } from './join.ts';

/** Where the item is: the installation, the repository (`owner/name`), the PRD, its feature pull request and the item's id. */
export type ItemAt = { installation: number; repo: string; prd: PrdNumber; pr: PrNumber; item: string };

/** What the fleet answered, but where: the pull request's number and link are read here. */
export type Answered = Omit<FleetAnswer, 'pr' | 'url'>;

/** What a settlement did: written (`settled`), found settled already, or why it was not written. */
export type Settled = { ok: true; settled: boolean } | { ok: false; why: string };

/** Where a person agreed with the fleet: the mission branch, the PRD, the item, their login and when (PRD omni-loop-21 s12). */
export type AgreeAt = { installation: number; repo: string; branch: string; prd: PrdNumber; item: string; login: string; at: string };

/** What the supervisor asks of GitHub to settle an item the fleet answered. */
export type MissionAnswers = { settle: (at: ItemAt & { answer: Answered }) => Promise<Settled> };

/** What the supervisor asks of GitHub to settle an item a person agreed with, at landing (PRD omni-loop-21 s12). */
export type MissionAgrees = { agree: (at: AgreeAt) => Promise<Settled> };

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
export function missionAnswers({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionAnswers & MissionAgrees {
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

    async agree({ installation, repo: slug, branch, prd, item, login, at }) {
      const { octokit, owner, repo, defaultBranch } = await missionRepo(octokitFor, { installation, repo: slug, branch });
      const tip = RefSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` })).data).object.sha;
      const folder = mkdtempSync(join(tmpdir(), 'omni-agree-'));
      try {
        const read = await prdOutboxAt(octokit, { owner, repo, ref: tip, prd, folder });
        if ('notRead' in read) return { ok: false, why: `the tip of ${branch}: ${read.notRead}` };
        const outboxDir = read.ctx.layout.outboxDir(prd);
        const settledFile = outboxDir === null ? null : `${outboxDir}/${SETTLED_FILE}`;
        if (settledFile === null || !existsSync(join(folder, settledFile))) return { ok: true, settled: false };
        const agreed = agreeEntry({ settled: readFileSync(join(folder, settledFile), 'utf8'), markers: read.ctx.markers, item, login, at });
        if (!agreed.ok) return agreed.gone === true ? { ok: true, settled: false } : { ok: false, why: agreed.why };
        await addCommit(octokit, {
          owner,
          repo,
          branch,
          parent: tip,
          message: `docs(outbox): ${item} agreed by ${login}\n\nPart of #${String(prd)}`,
          defaultBranch,
          files: [{ path: settledFile, content: agreed.text }],
        });
        return { ok: true, settled: true };
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    },
  };
}
