// The mission pull request (PRD 2896 s6, spec "4. Keeping up, landing, dropping", criterion 9): one pull request from the mission
// branch into the default branch, which a person merges with Rebase and merge, so the default branch gets one commit per PRD.
// Through GitHub's REST API only, as the App's installation; the App opens it and rewrites its body, and never merges it
// (N-PRODUCT-15):
//
//   landings  the pull requests from the mission branch into the default branch, newest first, each with the feature pull
//             requests it carried when it was merged: its commits, each a PRD's squash titled `<title> (#<n>)` (./join.ts).
//             A PRD whose feature pull request a merged one carried is on the default branch: it landed
//   branch    the mission branch's own commits since the default branch, in order, each with the feature pull request its
//             title names, and the default branch's `prLinks.feature` (the line that closes a PRD's issue on a merge into it)
//   write     the open one's title and body rewritten, or a new one opened, never a draft: its base is the default branch,
//             its head the mission branch. A head that is the default branch is refused before any request
//
// The pure half renders what the body says: each PRD on the branch in the order it joined, with its commit, the Reviewer's
// verdict it joined on and its page. Throws when GitHub answers out of shape or fails otherwise: the run fails, and the worker
// retries it. A pull request GitHub refuses to open (422: nothing to merge yet) is an answer, never a throw.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { PrNumberSchema, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { refuseDefault } from '../git-write/git-write.ts';
import { messageOf, PullWrittenSchema, RefSchema, statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';
import { readBaseConfig } from '../outbox-check/github.ts';
import { paginate, PER_PAGE } from '../retro/github.ts';
import { missionRepo } from './branch.ts';
import type { Landed } from './supervisor.ts';

/** Where a mission branch is: the installation, the repository (`owner/name`) and the branch. */
export type LandingAt = { installation: number; repo: string; branch: string };

/** A pull request from the mission branch into the default branch: open, or merged with the feature pull requests it carried. */
export type MissionPull = { number: PrNumber; url: string; open: boolean; merged: boolean; title: string; body: string; carried: PrNumber[] };

/** The mission pull requests, newest first, and the default branch they go into. */
export type Landings = { defaultBranch: string; pulls: MissionPull[] };

/** One commit of the mission branch, and the feature pull request its title names (null when it names none). */
export type BranchCommit = { sha: string; pr: PrNumber | null };

/** The mission branch's own commits, in order, and the line that closes a PRD's issue (`prLinks.feature`, null when none is read). */
export type BranchRead = { commits: BranchCommit[]; link: string | null };

/** What a write did: the pull request opened or rewritten, or why GitHub refused to open it. */
export type Written = { ok: true; number: PrNumber; url: string; created: boolean } | { ok: false; why: string };

/** What the supervisor asks of GitHub for the mission pull request. */
export type MissionLandings = {
  landings: (at: LandingAt) => Promise<Landings>;
  branch: (at: LandingAt & { defaultBranch: string }) => Promise<BranchRead>;
  write: (at: LandingAt & { defaultBranch: string; pull: PrNumber | null; title: string; body: string }) => Promise<Written>;
};

const PullsSchema = z.array(
  z.looseObject({
    number: PrNumberSchema,
    html_url: z.string(),
    state: z.string(),
    title: z.string(),
    body: z.string().nullish(),
    merged_at: z.string().nullish(),
  }),
);
const CommitsSchema = z.array(z.looseObject({ sha: z.string(), commit: z.looseObject({ message: z.string() }) }));
const CompareSchema = z.looseObject({ commits: z.array(z.looseObject({ sha: z.string(), commit: z.looseObject({ message: z.string() }) })) });

/** The most mission pull requests read: newest first, far more than the landings of one mission. */
const PULLS_READ = 30;

/** The feature pull request a squash commit's title names, `<title> (#<n>)`; null when it names none. */
export function prOfTitle(message: string): PrNumber | null {
  const number = /\(#(\d+)\)\s*$/.exec(message.split('\n')[0] ?? '')?.[1];
  const pr = PrNumberSchema.safeParse(Number(number));
  return number !== undefined && pr.success ? pr.data : null;
}

/** The mission pull requests, through `octokitFor(installation)`. */
export function missionLandings({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionLandings {
  const where = (slug: string): { owner: string; repo: string } => {
    const [owner = '', repo = ''] = slug.split('/');
    return { owner, repo };
  };
  return {
    async landings(at) {
      const { octokit, owner, repo, defaultBranch } = await missionRepo(octokitFor, at);
      const { branch } = at;
      const listed = PullsSchema.parse(
        (await octokit.request('GET /repos/{owner}/{repo}/pulls', { owner, repo, head: `${owner}:${branch}`, base: defaultBranch, state: 'all', per_page: PULLS_READ, page: 1 })).data,
      ).sort((a, b) => b.number - a.number);
      const pulls: MissionPull[] = [];
      for (const one of listed) {
        const merged = (one.merged_at ?? null) !== null;
        const commits = merged
          ? await paginate(async (page) => CommitsSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', { owner, repo, pull_number: one.number, per_page: PER_PAGE, page })).data))
          : [];
        const carried = commits.flatMap(({ commit }) => {
          const pr = prOfTitle(commit.message);
          return pr === null ? [] : [pr];
        });
        pulls.push({ number: one.number, url: one.html_url, open: one.state === 'open', merged, title: one.title, body: one.body ?? '', carried });
      }
      return { defaultBranch, pulls };
    },

    async branch({ installation, repo: slug, branch, defaultBranch }) {
      const { owner, repo } = where(slug);
      const octokit = await octokitFor(installation);
      const compared = CompareSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', { owner, repo, basehead: `${defaultBranch}...${branch}` })).data);
      const tip = RefSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${defaultBranch}` })).data).object.sha;
      const folder = mkdtempSync(join(tmpdir(), 'omni-landing-'));
      try {
        const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: tip, dest: folder, ignoreUnknownKeys: true });
        return { commits: compared.commits.map(({ sha, commit }) => ({ sha, pr: prOfTitle(commit.message) })), link: config?.prLinks.feature ?? null };
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    },

    async write({ installation, repo: slug, branch, defaultBranch, pull, title, body }) {
      refuseDefault(branch, defaultBranch);
      const { owner, repo } = where(slug);
      const octokit = await octokitFor(installation);
      if (pull !== null) {
        const written = PullWrittenSchema.parse((await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: pull, title, body })).data);
        return { ok: true, number: written.number, url: written.html_url, created: false };
      }
      try {
        const opened = PullWrittenSchema.parse((await octokit.request('POST /repos/{owner}/{repo}/pulls', { owner, repo, head: branch, base: defaultBranch, title, body, draft: false })).data);
        return { ok: true, number: opened.number, url: opened.html_url, created: true };
      } catch (error) {
        if (statusOf(error) !== 422) throw error;
        return { ok: false, why: `GitHub refused to open the mission pull request: ${String(messageOf(error)).split('\n')[0] ?? ''}` };
      }
    },
  };
}

// ── What it says ─────────────────────────────────────────────────────────────────

/** The PRDs on the branch that a merged mission pull request carried to the default branch, in the order they joined. */
export function landedBy(pulls: readonly MissionPull[], features: ReadonlyMap<PrdNumber, PrNumber>): Landed[] {
  return [...features].flatMap(([prd, feature]) => {
    const pull = pulls.find((one) => one.merged && one.carried.includes(feature));
    return pull === undefined ? [] : [{ prd, pr: pull.number, url: pull.url }];
  });
}

/** One PRD on the branch, as the body lists it: its feature pull request, its commit, the Reviewer's pass and its page. */
export type LandingRow = { prd: PrdNumber; pr: PrNumber | null; commit: string | null; pass: { round: number; url: string | null } | null; page: string | null };

/** The mission pull request's title. */
export const missionPullTitle = (mission: { number: number; title: string }): string => `Mission #${String(mission.number)}: ${mission.title}`;

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** What the Reviewer said of the PRD's head when it joined: the gate let it join on a pass only (./gate.ts). */
function passWords(pass: LandingRow['pass']): string {
  if (pass === null) return 'pass';
  const words = `pass, round ${String(pass.round)} of 2`;
  return pass.url === null ? words : `[${words}](${pass.url})`;
}

/** One row of the body's table. */
const rowLine = (row: LandingRow, n: number): string =>
  [
    String(n),
    `PRD ${String(row.prd)}`,
    row.pr === null ? '—' : `#${String(row.pr)}`,
    row.commit === null ? 'not on the branch yet' : `\`${row.commit.slice(0, 7)}\``,
    passWords(row.pass),
    row.page === null ? 'no page yet' : `[its page](${row.page})`,
  ]
    .map(cell)
    .reduce((line, part) => `${line} ${part} |`, '|');

/**
 * The mission pull request's body: the PRDs on the branch, in the order they joined, one commit each, how to merge it, and the
 * line that closes each PRD's issue on the default branch (`link`, `{prd}` filled; none when it was not read).
 */
export function missionPullBody({
  mission,
  branch,
  defaultBranch,
  rows,
  link,
}: {
  mission: { number: number; title: string };
  branch: string;
  defaultBranch: string;
  rows: readonly LandingRow[];
  link: string | null;
}): string {
  const lines = [
    `Lands mission #${String(mission.number)}, ${cell(mission.title)}, on \`${defaultBranch}\`: each PRD below joined \`${branch}\` as one commit, in this order.`,
    '',
    '| # | PRD | Its pull request | Commit | Reviewer | Page |',
    '|---|---|---|---|---|---|',
    ...rows.map((row, n) => rowLine(row, n + 1)),
    '',
    `**Merge it with Rebase and merge**: \`${defaultBranch}\` then gets one commit per PRD, each revertible alone, and each PRD is shipped from that moment. A squash or a merge commit would land them as one.`,
    '',
    'Merge it at any time: it carries what has joined so far, and one knowledge pull request then covers every PRD it landed. The Omni app rewrites this list on every join and never merges it: a person does.',
  ];
  const closes = link === null ? [] : rows.map((row) => link.replaceAll('{prd}', String(row.prd)));
  return `${[...lines, ...(closes.length > 0 ? ['', ...closes] : [])].join('\n')}\n`;
}
