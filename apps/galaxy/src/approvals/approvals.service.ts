import type { Asking } from 'vertuo-omni-plan/kit/lib/approval/stream.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { renderMarkdownBody } from '../dossier/markdown';
import { notifyAll, type Channels, type Message } from '../notify/notify';
import type { Answer, ApprovalsRepository, ReachRepository, Refusal, Requested } from './approvals.repository';

// The approvals' rules (PRD 1322 s2, spec §2 and §3). Asking: the database records the request and
// says who it asked (the product's approvers except the author, or the author when nobody else is);
// this service answers the kit in the shape it reads (settled item s4-01-approval-stream-contract) and
// reaches each asked person by the channels they turned on: a push to each device, an email to their
// address. Reaching people never fails a request: without the service role nobody is reached, said in
// one log line, and the request still stands in their bell. The bell: the requests waiting on the
// person looking, each with its PRD's page.

/** What asking needs: the caller's repository, the service role's (null when this deployment has no
 * service key), the channels built for a contact address (this app's origin, which push services may
 * write to) with a way to forget a device, and the log. */
export type AskDeps = {
  approvals: ApprovalsRepository;
  reach: ReachRepository | null;
  channels: (contact: string, forget: Channels['forget']) => Channels;
  log: (line: string) => void;
};

/** A request's outcome: the kit's reply, or the database's refusal. */
export type Asked = { ok: true; reply: Asking } | { ok: false; refusal: Refusal };

/** One approval request waiting on the person looking, for the bell. */
type WaitingApproval = { id: string; dossierId: string; prd: PrdNumber; title: string; repo: string; askedAt: number };

/** The first seven characters of a hash, as the kit and the page print it. */
const short = (sha256: string) => sha256.slice(0, 7);

/** The body of a spec's `## <heading>` section, up to the next `## `, trimmed; null when it has none. */
function sectionOf(spec: string, heading: string): string | null {
  const lines = spec.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  const body = (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
  return body || null;
}

const ONE_LINE_MAX = 140;

/** A section's first sentence on one line, without heading marks or emphasis, at most 140 characters. */
function firstSentence(markdown: string | null): string | null {
  const paragraph = markdown?.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#'));
  if (!paragraph) return null;
  const flat = paragraph.replace(/^[-*]\s+/, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  const sentence = /^(.+?[.!?])(?:\s|$)/.exec(flat)?.[1] ?? flat;
  return sentence.length > ONE_LINE_MAX ? `${sentence.slice(0, ONE_LINE_MAX - 1).trimEnd()}…` : sentence;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** What reaches each asked person: `PRD <n> waits for your approval`, the title, the one-line before →
 * after (the first sentence of the spec's Problem, then of its Solution), the repository and the short
 * hashes; the email adds the Problem and the Solution. Both open the PRD's page. The push carries the
 * title and the before → after only. */
function approvalMessage(request: Requested, origin: string): Message {
  const path = `/prd/${request.dossier}`;
  const url = `${origin}${path}`;
  const heading = `PRD ${request.prd} waits for your approval`;
  const problem = request.spec === null ? null : sectionOf(request.spec, 'Problem');
  const solution = request.spec === null ? null : sectionOf(request.spec, 'Solution');
  const before = firstSentence(problem);
  const after = firstSentence(solution);
  const line = before && after ? `${before} → ${after}` : (before ?? after);
  const hashes = request.files.map((f) => `${f.kind} ${short(f.sha256)}`).join(' · ');
  const facts = [request.title, line, [request.repo, hashes].filter(Boolean).join(' · ')].filter((part): part is string => Boolean(part));
  const sections = [['Problem', problem], ['Solution', solution]].flatMap(([name, body]) => (name && body ? [{ name, body }] : []));
  const text = [heading, '', ...facts, ...sections.flatMap((s) => ['', s.name, '', s.body]), '', `Open it to approve: ${url}`].join('\n');
  const html = [
    `<h1>${escape(heading)}</h1>`,
    ...facts.map((fact) => `<p>${escape(fact)}</p>`),
    ...sections.map((s) => `<h2>${escape(s.name)}</h2>\n${renderMarkdownBody(s.body)}`),
    `<p><a href="${escape(url)}">Open PRD ${request.prd} to approve it</a></p>`,
  ].join('\n');
  return {
    // The service worker reads exactly {title, body, url}, url a path on this site (settled with s9,
    // item s9-01-push-payload-shape).
    push: JSON.stringify({ title: heading, body: [request.title, line].filter(Boolean).join('\n'), url: path }),
    email: { subject: `${heading}: ${request.title}`, text, html },
  };
}

/** The kit's reply: who was asked, whether nobody but the author was left, the author, the product. */
const replyOf = (request: Requested): Asking => ({
  asked: request.asked.map(({ login, name }) => ({ login, name })),
  nobodyElse: request.nobodyElse,
  author: request.author,
  product: request.product,
});

/** Reaches everyone `request` asked; logs what could not be read, never throws. */
async function reachAll(deps: AskDeps, request: Requested, origin: string): Promise<void> {
  const { reach } = deps;
  if (!reach) {
    deps.log(`approvals: PRD #${request.prd} of ${request.repo} is asked, but nobody is reached: SUPABASE_SERVICE_ROLE_KEY is not set`);
    return;
  }
  const recipients = await reach.recipients(request.id);
  if (!recipients.ok) {
    deps.log(`approvals: who PRD #${request.prd} of ${request.repo} reaches could not be read: ${recipients.refusal.message ?? recipients.refusal.code ?? 'the database failed'}`);
    return;
  }
  const channels = deps.channels(origin, (device) => reach.forget(device));
  await notifyAll(recipients.value, approvalMessage(request, origin), channels, deps.log);
}

/** Asks PRD `prd` of `repo`'s approvers as the caller, reaches each one, and answers who was asked.
 * `origin` is where the caller reached this app: the PRD's page is under it. */
export async function askApprovers(deps: AskDeps, repo: string, prd: PrdNumber, origin: string): Promise<Asked> {
  const recorded = await deps.approvals.request(repo, prd);
  if (!recorded.ok) return recorded;
  const request = recorded.value;
  try {
    await reachAll(deps, request, origin);
  } catch (error) {
    deps.log(`approvals: reaching PRD #${request.prd}'s approvers failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { ok: true, reply: replyOf(request) };
}

/** The approval requests waiting on the caller, oldest first, for the bell. */
export async function waitingApprovals(approvals: ApprovalsRepository): Promise<Answer<WaitingApproval[]>> {
  const read = await approvals.waiting();
  if (!read.ok) return read;
  return {
    ok: true,
    value: read.value.map((row) => ({ id: row.id, dossierId: row.dossier, prd: row.prd, title: row.title, repo: row.repo, askedAt: Date.parse(row.askedAt) })),
  };
}
