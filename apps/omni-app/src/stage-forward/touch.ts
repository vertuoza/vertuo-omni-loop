// Touches (PRD 902, s3): a webhook event in, what it says changed out — `{ repository, issue?, pr?,
// branch? }` — forwarded to galaxy's `/api/github/touched`, which marks the PRD pages it names stale and
// reads GitHub again, once, under their lease.
//
// A touch is read from the payload alone, with no call to GitHub:
//   - issues: the issue; issue_comment: the issue, or the pull request when the issue is one;
//   - pull_request (every action) and pull_request_review: the pull request and its head branch;
//   - check_suite: each pull request it names with its branch, or the branch alone;
//   - push: one touch per PRD folder its commits change in the delivery folder, else the branch alone
//     when it changes the delivery folder or lands on a feature or phase-0 branch; any other push is none.
// The delivery folder and the branch shapes are the kit's defaults, as the stage event's are: the webhook
// reads no GitHub API, so it cannot read the repository's own config.
//
// Each touch is POSTed signed with the stage event's HMAC (`STAGE_EVENT_SECRET`, ./stage-forward.ts). A
// missing secret or a failed POST is logged and never thrown: the 15-minute sync is the safety net.
import { posix } from 'node:path';
import { z } from 'zod';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { IssueNumberSchema, PrNumberSchema, type IssueNumber, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { match, postSigned, type SignedPost } from './stage-forward.ts';

export type Touch = { repository: string; issue?: IssueNumber; pr?: PrNumber; branch?: string };

/** The events a touch is read from: `app.yml` subscribes to each of them. */
export const TOUCH_EVENTS = Object.freeze(['issues', 'issue_comment', 'pull_request', 'pull_request_review', 'check_suite', 'push']);

/** The kit's default delivery folder and branch shapes. */
const DEFAULTS = (() => {
  const { paths, branches } = parseConfig('kit: 1');
  return Object.freeze({ delivery: posix.normalize(paths.delivery).replace(/\/+$/, ''), branches });
})();

const Repository = z.looseObject({ repository: z.looseObject({ full_name: z.string().min(1) }) });
const IssueEvent = z.looseObject({ issue: z.looseObject({ number: IssueNumberSchema, pull_request: z.unknown().optional() }) });
const PullEvent = z.looseObject({ pull_request: z.looseObject({ number: PrNumberSchema, head: z.looseObject({ ref: z.string().min(1) }) }) });
const CheckSuiteEvent = z.looseObject({
  check_suite: z.looseObject({ head_branch: z.string().min(1).nullish(), pull_requests: z.array(z.looseObject({ number: PrNumberSchema })).nullish() }),
});
const Files = z.array(z.string()).nullish();
const PushEvent = z.looseObject({
  ref: z.string(),
  commits: z.array(z.looseObject({ added: Files, modified: Files, removed: Files })).nullish(),
});

type Reader = (repository: string, payload: unknown) => Touch[];

const issueTouches: Reader = (repository, payload) => {
  const read = IssueEvent.safeParse(payload);
  if (!read.success) return [];
  const { number, pull_request: pull } = read.data.issue;
  if (pull === undefined || pull === null) return [{ repository, issue: number }];
  const pr = PrNumberSchema.safeParse(number);
  return pr.success ? [{ repository, pr: pr.data }] : [];
};

const pullTouches: Reader = (repository, payload) => {
  const read = PullEvent.safeParse(payload);
  return read.success ? [{ repository, pr: read.data.pull_request.number, branch: read.data.pull_request.head.ref }] : [];
};

const checkSuiteTouches: Reader = (repository, payload) => {
  const read = CheckSuiteEvent.safeParse(payload);
  const branch = read.success ? read.data.check_suite.head_branch : null;
  if (!read.success || !branch) return [];
  const pulls = read.data.check_suite.pull_requests ?? [];
  return pulls.length === 0 ? [{ repository, branch }] : pulls.map(({ number }) => ({ repository, pr: number, branch }));
};

/** Whether `branch` is a feature or phase-0 branch by the kit's shapes; a slice branch is neither. */
function isFeatureOrPhase0(branch: string): boolean {
  const { branches } = DEFAULTS;
  if (match(branches.slice, branch)) return false;
  return Boolean(match(branches.feature, branch) ?? match(branches.phase0, branch));
}

const pushTouches: Reader = (repository, payload) => {
  const read = PushEvent.safeParse(payload);
  if (!read.success || !read.data.ref.startsWith('refs/heads/')) return [];
  const branch = read.data.ref.slice('refs/heads/'.length);
  const inDelivery = (read.data.commits ?? [])
    .flatMap((commit) => [...(commit.added ?? []), ...(commit.modified ?? []), ...(commit.removed ?? [])])
    .filter((path) => path.startsWith(`${DEFAULTS.delivery}/`));
  const prds = new Set<IssueNumber>();
  for (const path of inDelivery) {
    // <delivery>/<state>/<nnnn-topic>/…
    const folder = path.slice(DEFAULTS.delivery.length + 1).split('/');
    const prd = folder.length > 2 ? parseFolderName(folder[1] ?? '')?.prd : undefined;
    if (prd !== undefined) prds.add(prd);
  }
  if (prds.size > 0) return [...prds].map((issue) => ({ repository, issue, branch }));
  return inDelivery.length > 0 || isFeatureOrPhase0(branch) ? [{ repository, branch }] : [];
};

const READERS = new Map<string, Reader>([
  ['issues', issueTouches],
  ['issue_comment', issueTouches],
  ['pull_request', pullTouches],
  ['pull_request_review', pullTouches],
  ['check_suite', checkSuiteTouches],
  ['push', pushTouches],
]);

/** The touches an event's payload says, pure; none for any other event or a payload of another shape. */
export function toTouches(event: string, payload: unknown): Touch[] {
  const reader = READERS.get(event);
  const source = Repository.safeParse(payload);
  if (!reader || !source.success) return [];
  return reader(source.data.repository.full_name, payload);
}

/** Galaxy's touched route, on its host (`galaxyUrl` of the app's environment). */
export function touchedUrl(galaxyUrl: string): string {
  return `${galaxyUrl.replace(/\/+$/, '')}/api/github/touched`;
}

/** POSTs one touch to galaxy, signed. Never throws: a failure is one line in the log. */
export function forwardTouch(touch: Touch, post: SignedPost): Promise<void> {
  const what = `touch of ${touch.repository}${touch.issue ? ` #${touch.issue}` : ''}${touch.pr ? ` pull request #${touch.pr}` : ''}${touch.branch ? ` on ${touch.branch}` : ''}`;
  return postSigned(touch, post, { name: 'touch', what });
}
