// GitHub as the delivery kind's tests read it (PRD 72, slice s5): PRD 7 of `acme/widgets`
// (`../../../../test/retro-scenario.mjs`), its three slices and one more claim of s3, with what each
// pull request's files, reviews, review threads, comments and label events held. Test support only.
//
//   s1 (#13)  inside its territory, plus the shared registry and its own outbox item; one bot review
//             thread carrying a red circle, resolved before the merge
//   s2 (#14)  labelled needs-fix, then stuck after three attempts; a bot review with a red circle
//   s3 (#15)  the shared registry (declared by s1 and s2), plus two paths outside its territory; a
//             person's red circle, and a person's thread left unresolved at the merge
//   s3 (#16)  a first claim of s3, closed without merging
import { SUB_PULLS } from '../../../../test/retro-scenario.mjs';

export const OWNER = 'acme';
export const REPO = 'widgets';
const url = (path) => `https://github.com/${OWNER}/${REPO}/${path}`;

/** A first claim of s3, closed after a minute without merging: s3 was claimed twice. */
export const RECLAIMED = {
  number: 16,
  title: 'slice feat/widget--s3',
  state: 'closed',
  draft: true,
  merged: false,
  html_url: url('pull/16'),
  head: { ref: 'feat/widget--s3', sha: 'head16' },
  base: { ref: 'feat/widget', sha: 'base16' },
  labels: [{ name: 'omni:sub' }],
  created_at: '2026-09-20T09:44:00Z',
  closed_at: '2026-09-20T09:45:00Z',
  merged_at: null,
  merge_commit_sha: null,
};

export const DELIVERY_PULLS = [...SUB_PULLS, RECLAIMED];

const file = (filename, extra = {}) => ({ filename, status: 'modified', additions: 1, deletions: 0, changes: 1, ...extra });

export const FILES = {
  13: [
    file('src/store/colour.mjs', { status: 'added' }),
    file('src/registry.mjs'),
    file('.omni-loop/delivery/outbox/0007-widget/s1-01-colour-format.md', { status: 'added' }),
  ],
  14: [file('src/read/colour.mjs', { status: 'added' }), file('src/registry.mjs'), file('.omni-loop/delivery/outbox/0007-widget/accounts/s2.md', { status: 'added' })],
  15: [file('src/show/colour.mjs', { status: 'added' }), file('src/registry.mjs'), file('src/store/colour.mjs'), file('README.md')],
};

const user = (login, type = 'User') => ({ login, type });

export const REVIEWS = {
  12: [{ id: 1201, user: user('ada'), state: 'APPROVED', body: 'Looks right.', html_url: url('pull/12#pullrequestreview-1201'), submitted_at: '2026-09-20T11:55:00Z' }],
  13: [],
  14: [
    {
      id: 1401,
      user: user('claude[bot]', 'Bot'),
      state: 'COMMENTED',
      body: '🔴 **Bug:** the cache is never cleared, so a colour read once is read forever.',
      html_url: url('pull/14#pullrequestreview-1401'),
      submitted_at: '2026-09-20T09:55:00Z',
    },
  ],
  15: [{ id: 1501, user: user('grace'), state: 'COMMENTED', body: '🔴 I would rename this.', html_url: url('pull/15#pullrequestreview-1501'), submitted_at: '2026-09-20T11:00:00Z' }],
};

const thread = ({ resolved, path, author, bot = false, body, id, outdated = false }) => ({
  isResolved: resolved,
  isOutdated: outdated,
  path,
  comments: { nodes: [{ url: url(`pull/${id}`), body, author: { login: author, __typename: bot ? 'Bot' : 'User' } }] },
});

/** The review threads GraphQL returns for each pull request, first page only. */
export const THREADS = {
  12: [],
  13: [thread({ id: '13#discussion_r1', resolved: true, path: 'src/store/colour.mjs', author: 'claude', bot: true, body: '🔴 Off by one: the last colour is dropped.' })],
  14: [],
  15: [thread({ id: '15#discussion_r2', resolved: false, path: 'src/show/colour.mjs', author: 'ada', body: 'Why grey by default?' })],
};

export const EVENTS = {
  13: [],
  14: [
    { id: 141, event: 'labeled', label: { name: 'omni:sub' }, created_at: '2026-09-20T09:45:00Z' },
    { id: 142, event: 'labeled', label: { name: 'omni:needs-fix' }, created_at: '2026-09-20T09:58:00Z' },
    { id: 143, event: 'unlabeled', label: { name: 'omni:needs-fix' }, created_at: '2026-09-20T10:04:00Z' },
  ],
  15: [],
  16: [],
};

export const STUCK_BODY = [
  '## Stuck after 3 attempts',
  '',
  '**Red check:** preflight — `pnpm test` fails in `src/read/colour.test.mjs`',
  '**Tried:** 1. cleared the cache 2. re-read the colour 3. pinned the order',
  '**I believe:** the store answers before the write lands.',
  '**A person should look at:** `src/read/colour.mjs`, because the read races the write',
].join('\n');

export const COMMENTS = [
  { id: 9001, issue: 14, user: user('omni-loop[bot]', 'Bot'), body: '<!-- omni-outbox-status -->\n**Agent status**\n\n- state: stuck', html_url: url('pull/14#issuecomment-9001'), created_at: '2026-09-20T09:46:00Z' },
  { id: 9002, issue: 14, user: user('omni-loop[bot]', 'Bot'), body: STUCK_BODY, html_url: url('pull/14#issuecomment-9002'), created_at: '2026-09-20T09:59:00Z' },
];

/** The recorded reads, in the shape `replayGitHub` replays. */
export function deliveryRecording() {
  const page = (number) => ({ owner: OWNER, repo: REPO, pull_number: number, per_page: 100, page: 1 });
  return [
    ...Object.entries(FILES).map(([number, data]) => ({ route: 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files', params: page(Number(number)), data })),
    ...Object.entries(REVIEWS).map(([number, data]) => ({ route: 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', params: page(Number(number)), data })),
  ];
}

/** GraphQL's answer to the review-threads query for one pull request. */
export function threadsAnswer(number) {
  const nodes = THREADS[number];
  if (!nodes) return null;
  return {
    data: {
      repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } },
    },
  };
}
