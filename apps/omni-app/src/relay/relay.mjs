// `relay`: the outbox the check evaluated, sent to the Omni page (PRD 251, "The App sends the
// outbox"). Three parts, each pure but the last:
//
//   relayTarget   whether this repository's outbox goes to the page at all: `answers.enabled` on in
//                 the base branch's config, and `ask.url`'s host the host of the App's `OMNI_PAGE_URL`
//   readOutbox    what the check read, as the page keeps it: the numbering the comment carries, the
//                 open items (their files verbatim), the adopted ones (their item text), what the
//                 replies say that nobody has settled yet (the kit's `planReplies`, on the comments
//                 the check already read) and the settled entries
//   sendOutbox    `POST <OMNI_PAGE_URL>/api/outbox`, the body signed with `OMNI_OUTBOX_SECRET`
//                 (`X-Omni-Signature: sha256=<HMAC-SHA256 of the raw body>`)
//
// The relay never changes the check: the `outbox-check` function runs it after the check and the
// comment are published, and a failed send is logged, never raised into the check's conclusion.
// Nothing here runs repository code: it reads YAML and Markdown through the kit's own parsers.
import { createHmac } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.mjs';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.mjs';
import { DOORS } from 'vertuo-omni-plan/kit/lib/outbox/answers.mjs';
import {
  adoptedEntriesForPrd,
  findPrMarkerComment,
  openItemsForPrd,
  parseNumbersMarker,
} from 'vertuo-omni-plan/kit/lib/outbox/comment.mjs';
import { SETTLED_FILE } from 'vertuo-omni-plan/kit/lib/outbox/outbox.mjs';
import { planReplies } from 'vertuo-omni-plan/kit/lib/outbox/replies.mjs';
import { ADOPTED_VERDICT, parseSettledEntries } from 'vertuo-omni-plan/kit/lib/outbox/settle.mjs';

/** The page's route the relay posts to. */
export const OUTBOX_PATH = '/api/outbox';
/** The header carrying the body's signature. */
export const SIGNATURE_HEADER = 'x-omni-signature';
/** The pull request states the page keeps. */
export const PR_STATES = Object.freeze(['open', 'merged', 'closed']);

/**
 * Where the outbox goes, or `null` when it goes nowhere: the switch is off, the repository names no
 * `ask.url`, the App has no `OMNI_PAGE_URL`, or the two are on different hosts (a repository pointing
 * at another page than the one this App serves).
 * @param {{ config: object | null, pageUrl: string | undefined | null }} input
 * @returns {string | null} the page's origin
 */
export function relayTarget({ config, pageUrl }) {
  if (!config?.answers?.enabled || !config.ask?.url || !pageUrl) return null;
  const page = urlOf(pageUrl);
  const asked = urlOf(config.ask.url);
  if (!page || !asked || page.host !== asked.host) return null;
  return page.origin;
}

function urlOf(text) {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/** The PRD a feature branch was cut for, read back through `branches.feature` in the head snapshot. */
export function featurePrdOf({ ctx, baseRef, headRef }) {
  const { repo, branches } = ctx.config;
  if (baseRef !== repo.defaultBranch || !branches.feature.includes('{topic}')) return null;
  const [prefix, suffix = ''] = branches.feature.split('{topic}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const topic = headRef.slice(prefix.length, headRef.length - suffix.length);
  if (!topic) return null;
  for (const dir of [ctx.layout.dirs.inbox, ctx.layout.dirs.shipped]) {
    const absolute = join(ctx.root, dir);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const parsed = entry.isDirectory() ? parseFolderName(entry.name) : null;
      if (parsed?.topic === topic) return parsed.prd;
    }
  }
  return null;
}

/** Which door a reply came through: the reply writer's closing line names the terminal or the page. */
function doorOf(body) {
  const text = String(body ?? '');
  if (text.includes(`_${DOORS.page} · PRD`)) return 'page';
  if (text.includes(`_${DOORS.terminal} · PRD`)) return 'terminal';
  return 'github';
}

/**
 * The outbox of a feature pull request, as the page keeps it — or `null` when the pull request is
 * not one. `head` holds the head's delivery folder, `config` is the base branch's; `comments` are the
 * pull request's, as the check read them; `commentBody` is the outbox comment the check just
 * published (its numbering is the one the pull request now shows), `null` when it wrote none.
 * @returns {null | { prd: number, numbering: object[], open: object[], adopted: object[], pending: object[], settled: object[] }}
 */
export function readOutbox({ head, config, pr, comments = [], commentBody = null }) {
  const ctx = createContext(head, config);
  const prd = featurePrdOf({ ctx, baseRef: pr.baseRef, headRef: pr.headRef });
  if (prd === null) return null;

  const markers = ctx.markers;
  const numberingBody = commentBody ?? findPrMarkerComment(comments, markers)?.body ?? null;
  const numbering = parseNumbersMarker(numberingBody, markers).map(({ number, id, since }) => ({ number, id, since }));
  const numberOf = new Map(numbering.map((entry) => [entry.id, entry.number]));

  const items = openItemsForPrd(prd, { ctx });
  const open = items
    .filter((item) => numberOf.has(item.id))
    .map((item) => ({
      number: numberOf.get(item.id),
      id: item.id,
      rank: item.rank,
      text: readFileSync(join(ctx.root, item.file), 'utf8'),
    }))
    .sort((a, b) => a.number - b.number);

  const adoptedEntries = adoptedEntriesForPrd(prd, { ctx });
  const adopted = adoptedEntries
    .filter((entry) => numberOf.has(entry.id))
    .map((entry) => ({ number: numberOf.get(entry.id), id: entry.id, text: entry.itemText }))
    .sort((a, b) => a.number - b.number);

  const bodyOf = new Map(comments.map((comment) => [comment.html_url, comment.body]));
  const plan = planReplies({ comments, items, adopted: adoptedEntries, markers });
  const pending = [...plan.settle, ...plan.held]
    .map(({ number, item, answer }) => ({
      number,
      id: item.id,
      text: answer.text,
      by: answer.approvedBy,
      at: answer.approvedAt,
      url: answer.url ?? null,
      via: doorOf(bodyOf.get(answer.url)),
    }))
    .sort((a, b) => a.number - b.number);

  const settled = settledEntries(prd, ctx)
    .filter((entry) => entry.verdict !== ADOPTED_VERDICT)
    .map((entry) => ({
      number: numberOf.get(entry.id) ?? null,
      id: entry.id,
      verdict: entry.verdict,
      approvedBy: entry.fields['Approved by'] ?? null,
      approvedAt: entry.fields['Approved at'] ?? null,
      channel: entry.fields.Channel ?? null,
      channelUrl: entry.fields['Channel URL'] ?? null,
      answer: entry.answerText,
    }));

  return { prd, numbering, open, adopted, pending, settled };
}

function settledEntries(prd, ctx) {
  const dir = ctx.layout.outboxDir(prd);
  if (dir === null) return [];
  const file = join(ctx.root, dir, SETTLED_FILE);
  if (!existsSync(file)) return [];
  return parseSettledEntries(readFileSync(file, 'utf8'), ctx.markers);
}

/**
 * The body the page receives. Pure.
 * @param {{ repository: string, pr: { number: number, headSha: string, state: string }, evaluatedAt: string,
 *   outbox: { prd: number, numbering: object[], open: object[], adopted: object[], pending: object[], settled: object[] } }} input
 */
export function relayBody({ repository, pr, evaluatedAt, outbox }) {
  const { prd, numbering, open, adopted, pending, settled } = outbox;
  return {
    repo: repository,
    prd,
    pr: {
      number: pr.number,
      url: `https://github.com/${repository}/pull/${pr.number}`,
      headSha: pr.headSha,
      state: pr.state,
    },
    evaluatedAt,
    numbering,
    open,
    adopted,
    pending,
    settled,
  };
}

/** `sha256=<HMAC-SHA256 of the raw body, hex>`, keyed with the shared secret. */
export function signBody(raw, secret) {
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

/**
 * Posts the body to the page. Throws on anything but a 2xx, so the step that calls it is retried.
 * @param {{ fetch?: typeof fetch, origin: string, secret: string, body: object }} input
 * @returns {Promise<{ status: number, url: string | null }>}
 */
export async function sendOutbox({ fetch: send = fetch, origin, secret, body }) {
  if (!secret) throw new Error('OMNI_OUTBOX_SECRET is not set.');
  const raw = JSON.stringify(body);
  const response = await send(new URL(OUTBOX_PATH, origin).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signBody(raw, secret) },
    body: raw,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`the page answered ${response.status}: ${text.slice(0, 200)}`);
  let url = null;
  try {
    url = JSON.parse(text)?.url ?? null;
  } catch {
    // The page answered 2xx without JSON: the outbox is stored; there is no address to log.
  }
  return { status: response.status, url };
}
