// A fix on GitHub (PRD 627, s5): what a visual or bug fix's list row and Timeline read of it, live — its
// issue (who asked and when, its risk label, whether it is a regression), its pull request (the most
// recent open or merged one on a `branches.fix` branch whose topic starts with the issue's number,
// `fix/548-…`), who merged it and when, each approving review, and the first GitHub release published
// after the merge. Each part is read on its own: `UNREAD` when GitHub could not answer it, so the page
// says *unknown* rather than failing. ./reader.ts gives it the repository's token, config and 60-second
// cache; this module only reads through the `get` it is handed.
import { z } from 'zod';
import { UNREAD, type Read } from './summary';

/** A GitHub answer on the repository's route, as JSON; null on 404. Throws on any other failure. */
export type FixGet = (route: string) => Promise<unknown>;

/** The labels the repository's config names: its risk labels, highest first, and its regression label. */
export type FixLabels = { risk: readonly string[]; regression: string };

export type FixIssue = {
  number: number; url: string; state: 'open' | 'closed'; author: string | null; createdAt: string;
  /** The first of the config's risk labels the issue carries; null when none. */
  risk: string | null;
  regression: boolean;
};
export type FixPull = { number: number; url: string; state: 'open' | 'merged'; mergedAt: string | null; mergedBy: string | null };
export type FixApproval = { login: string; at: string };
export type FixRelease = { tag: string; url: string; at: string };

/** What GitHub says of a fix; each part `UNREAD` when that read failed, null when there is none yet. */
export type FixSummary = {
  issue: Read<FixIssue | null>;
  pull: Read<FixPull | null>;
  approvals: Read<FixApproval[]>;
  release: Read<FixRelease | null>;
};

const Issue = z.object({
  number: z.number().int().positive(),
  html_url: z.string().url(),
  state: z.enum(['open', 'closed']),
  created_at: z.string(),
  user: z.object({ login: z.string() }).nullable().optional(),
  labels: z.array(z.union([z.string(), z.object({ name: z.string().optional() })])).optional().default([]),
});
const Pulls = z.array(z.object({
  number: z.number().int().positive(),
  html_url: z.string().url(),
  state: z.enum(['open', 'closed']),
  merged_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
  head: z.object({ ref: z.string() }),
}));
const Merged = z.object({ merged_by: z.object({ login: z.string() }).nullable().optional() });
const Reviews = z.array(z.object({
  state: z.string(),
  user: z.object({ login: z.string() }).nullable().optional(),
  submitted_at: z.string().nullable().optional(),
}));
const Releases = z.array(z.object({
  tag_name: z.string(),
  html_url: z.string().url(),
  draft: z.boolean().optional().default(false),
  published_at: z.string().nullable().optional().default(null),
}));

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A branch of the fix: `branches.fix` with a topic starting `<n>-`. */
export function fixBranch(shape: string, n: number): RegExp {
  const [before, after = ''] = shape.split('{topic}');
  return new RegExp(`^${escape(before)}${n}-[a-z0-9-]+${escape(after)}$`);
}

async function part<T>(what: string, run: () => Promise<T>): Promise<Read<T>> {
  try {
    return await run();
  } catch (error) {
    console.error(`Fix page: ${what} could not be read from GitHub: ${error instanceof Error ? error.message : String(error)}`);
    return UNREAD;
  }
}

/** Fix `n` of the repository `get` reads, its branches shaped as `fixShape`. */
export async function readFix(get: FixGet, n: number, fixShape: string, labels: FixLabels): Promise<FixSummary> {
  const branch = fixBranch(fixShape, n);
  const [issue, found] = await Promise.all([
    part('the issue', async (): Promise<FixIssue | null> => {
      const answer = await get(`/issues/${n}`);
      if (answer === null) return null;
      const read = Issue.parse(answer);
      const names = read.labels.map((l) => (typeof l === 'string' ? l : l.name ?? ''));
      return {
        number: read.number, url: read.html_url, state: read.state, author: read.user?.login ?? null, createdAt: read.created_at,
        risk: labels.risk.find((label) => names.includes(label)) ?? null,
        regression: names.includes(labels.regression),
      };
    }),
    part('the fix PR', async () => {
      const listed = Pulls.parse((await get(`/pulls?${new URLSearchParams({ state: 'all', per_page: '100', sort: 'created', direction: 'desc' })}`)) ?? []);
      // As the PRD page counts a branch's PR: the most recent open or merged one; a closed, unmerged one is absent.
      const [latest] = listed.filter((p) => branch.test(p.head.ref) && (p.state === 'open' || p.merged_at !== null))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.number - a.number);
      return latest ? { number: latest.number, url: latest.html_url, state: latest.state === 'open' ? 'open' as const : 'merged' as const, mergedAt: latest.merged_at } : null;
    }),
  ]);
  if (found === UNREAD) return { issue, pull: UNREAD, approvals: UNREAD, release: UNREAD };
  if (found === null) return { issue, pull: null, approvals: [], release: null };

  const mergedAt = found.state === 'merged' ? found.mergedAt : null;
  const [mergedBy, approvals, release] = await Promise.all([
    part('who merged the fix PR', async () => (mergedAt === null ? null : Merged.parse((await get(`/pulls/${found.number}`)) ?? {}).merged_by?.login ?? null)),
    part('the fix PR\'s reviews', async () => Reviews.parse((await get(`/pulls/${found.number}/reviews?per_page=100`)) ?? [])
      .filter((r) => r.state === 'APPROVED' && r.user && r.submitted_at)
      .map((r): FixApproval => ({ login: r.user!.login, at: r.submitted_at! }))),
    part('the releases', async (): Promise<FixRelease | null> => {
      if (mergedAt === null) return null;
      const after = Releases.parse((await get('/releases?per_page=100')) ?? [])
        .filter((r) => !r.draft && r.published_at !== null && Date.parse(r.published_at) >= Date.parse(mergedAt))
        .sort((a, b) => Date.parse(a.published_at!) - Date.parse(b.published_at!));
      const [first] = after;
      return first ? { tag: first.tag_name, url: first.html_url, at: first.published_at! } : null;
    }),
  ]);
  return {
    issue,
    pull: { number: found.number, url: found.url, state: found.state, mergedAt, mergedBy: mergedBy === UNREAD ? null : mergedBy },
    approvals,
    release,
  };
}
