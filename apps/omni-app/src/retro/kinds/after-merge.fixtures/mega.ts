// The after-merge kind's fixture for a multi-repository PRD (PRD 1130, slice s3): PRD 7 of the plan
// repository `acme/widgets` (`day-14.ts`) also landed in `acme/backend` and `acme/frontend`; the App
// could not read `acme/mobile` at the merge. On top of the plan repository's own bugs (#40, #41):
//
//   bug #60  labelled `omni:bug`, its body carries `For PRD #7` (`/omni:mega-bug-fix`), opened
//            2026-09-25 (5 days after), closed 2026-09-30. Its fix plan names, in order:
//              acme/backend#12      merged 2026-09-28, rewrites lines 12-13 of `src/store/colour.ts`,
//                                   inside the back-end's churn range 10-20
//              acme/frontend/pull/34 merged 2026-09-29, changes `src/show/colour.tsx` without a patch,
//                                   a file holding the front-end's churn range 1-5
//              acme/mobile#5        a repository GitHub will not let the app read: not read
//   bug #61  labelled `omni:bug`, `For PRD #70`: another PRD, not counted
//
// Each target's GitHub is its own stubbed GitHub; `megaGitHub` routes a request by its repository.
import { httpError, replayGitHub, type Recorded } from '../../../../test/github-replay.ts';
import { FEATURE, FIX_PULLS, ISSUES, OWNER, REPO, RANGES, afterMergeRecording } from './day-14.ts';

export const PLAN = `${OWNER}/${REPO}`;

const FILES = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files';

const issue = (number: number, body: string, createdAt: string, closedAt: string | null) => ({
  number,
  title: 'The colour flickers on the phone and the page',
  body,
  state: closedAt ? 'closed' : 'open',
  html_url: `https://github.com/${PLAN}/issues/${number}`,
  labels: [{ name: 'omni:bug' }],
  created_at: createdAt,
  updated_at: closedAt ?? createdAt,
  closed_at: closedAt,
});

/** The mega bugs the plan repository holds, beside the plan repository's own. */
const MEGA_ISSUES = [
  issue(60, 'The colour flickers.\n\nFor PRD #7\n\nA bug fix across repositories.', '2026-09-25T08:00:00Z', '2026-09-30T08:00:00Z'),
  issue(61, 'Another one.\n\nFor PRD #70\n', '2026-09-26T08:00:00Z', null),
];

/** The fix-plan comment `/omni:mega-bug-fix` keeps on bug #60. */
const FIX_PLAN = [
  '<!-- omni-bug:fix-plan -->',
  '',
  '## Fix plan',
  '',
  '| order | repository | pull request | what changes |',
  '| --- | --- | --- | --- |',
  '| 1 | acme/backend | acme/backend#12 | the colour is stored once |',
  '| 2 | acme/frontend | https://github.com/acme/frontend/pull/34 | the colour is shown once |',
  '| 3 | acme/mobile | acme/mobile#5 | the phone shows it once |',
].join('\n');

const targetPull = (slug: string, number: number, mergedAt: string) => ({
  number,
  title: `fix: the colour flickers (${slug})`,
  body: 'Part of the fix plan.',
  state: 'closed',
  draft: false,
  merged: true,
  html_url: `https://github.com/${slug}/pull/${number}`,
  head: { ref: `fix/60-colour`, sha: `head${number}` },
  base: { ref: 'main', sha: `base${number}` },
  labels: [],
  created_at: '2026-09-26T08:00:00Z',
  updated_at: mergedAt,
  closed_at: mergedAt,
  merged_at: mergedAt,
  merge_commit_sha: `m${number}`,
});

const filesOf = (slug: string, number: number, files: object[]): Recorded => {
  const [owner, repo] = slug.split('/');
  return { route: FILES, params: { owner, repo, pull_number: number, per_page: 100, page: 1 }, data: files };
};

/** Each target's churn ranges, as the merge run's fact sheet holds them. */
const TARGET_RANGES = {
  'acme/backend': [{ path: 'src/store/colour.ts', from: 10, to: 20, commits: ['b1', 'b2', 'b3'], slices: ['s1', 's2'] }],
  'acme/frontend': [{ path: 'src/show/colour.tsx', from: 1, to: 5, commits: ['f1', 'f2', 'f3'], slices: ['s4'] }],
};

/** The targets as the merge run read them (`scope.targets`): two read, one not. */
export const TARGETS = [
  { name: 'backend', repo: 'acme/backend', read: true, installationId: 2, featurePrs: [], pulls: [] },
  { name: 'frontend', repo: 'acme/frontend', read: true, installationId: 3, featurePrs: [], pulls: [] },
  { name: 'mobile', repo: 'acme/mobile', read: false, reason: 'the App is not installed there' },
];

/** The merge run's fact sheet, as far as the day-14 run reads it: the plan repository's churn, and each target's. */
export const AT_MERGE = {
  kinds: { churn: { ranges: RANGES } },
  repositories: [
    { repo: PLAN, name: REPO, plan: true, read: true, featurePrs: [] },
    { repo: 'acme/backend', name: 'backend', plan: false, read: true, featurePrs: [], kinds: { churn: { ranges: TARGET_RANGES['acme/backend'] } } },
    { repo: 'acme/frontend', name: 'frontend', plan: false, read: true, featurePrs: [], kinds: { churn: { ranges: TARGET_RANGES['acme/frontend'] } } },
    { repo: 'acme/mobile', name: 'mobile', plan: false, read: false, reason: 'the App is not installed there', featurePrs: [] },
  ],
};

/** `missing` names the target reads GitHub refuses: `{ 'acme/backend#12': 404, 'acme/backend#12/files': 403 }`. */
export type MegaMissing = Record<string, number>;

/** The plan repository's stubbed GitHub and each target's, one Octokit routing a request by its repository. */
export function megaGitHub({ missing = {}, comments = [FIX_PLAN] }: { missing?: MegaMissing; comments?: string[] } = {}) {
  const plan = replayGitHub({ pulls: [FEATURE, ...FIX_PULLS], recording: afterMergeRecording() });
  plan.state.issues.push(...structuredClone([...ISSUES, ...MEGA_ISSUES]));
  plan.state.comments.push({ id: 900, issue: 60, body: 'Triage: the colour is stored twice.' }, ...comments.map((body, i) => ({ id: 901 + i, issue: 60, body })));
  const backend = replayGitHub({
    pulls: [targetPull('acme/backend', 12, '2026-09-28T08:00:00Z')],
    recording: [
      filesOf('acme/backend', 12, [
        { filename: 'src/store/colour.ts', status: 'modified', additions: 2, deletions: 2, patch: '@@ -12,2 +12,2 @@\n-a\n-b\n+c\n+d' },
      ]),
    ],
  });
  const frontend = replayGitHub({
    pulls: [targetPull('acme/frontend', 34, '2026-09-29T08:00:00Z')],
    recording: [filesOf('acme/frontend', 34, [{ filename: 'src/show/colour.tsx', status: 'modified', additions: 1, deletions: 1 }])],
  });
  const stubs: Record<string, ReturnType<typeof replayGitHub>> = { [PLAN]: plan, 'acme/backend': backend, 'acme/frontend': frontend };
  const octokit = {
    async request(route: string, params: Record<string, unknown> = {}): Promise<{ data: unknown }> {
      const slug = `${String(params.owner)}/${String(params.repo)}`;
      const refused = missing[`${slug}#${String(params.pull_number)}${route === FILES ? '/files' : ''}`];
      if (refused) throw httpError(refused, `refused: ${route} ${slug}`);
      const stub = stubs[slug];
      if (!stub) throw httpError(404, `no repository ${slug}`);
      return stub.octokit.request(route, params);
    },
  };
  return { octokit, plan, backend, frontend };
}
