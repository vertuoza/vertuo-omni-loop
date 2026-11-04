import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Message } from '../notify/notify';
import { escapeHtml, reachAll, type ReachDeps } from './approvals.service';
import type { Answer, Refusal } from './answer';
import type { TechRepository, TechRequested } from './tech.repository';

// A Tech Approval's rules on the server (PRD 2608 s3, spec §2 and §4). Who may request it is the database's
// to say. This reaches the one person named by the channels they have on, with the PRD's page and the line
// that starts the review; reaching them never fails the request, which stands in their Waiting section.

/** What a request needs: the caller's repository, and how the person named is reached. */
export type TechDeps = ReachDeps & { tech: TechRepository };

/** The PRD a call names: a repository's by its number (the kit), or its dossier (the page). */
export type TechPrd = { repo: string; prd: PrdNumber } | { dossier: string };

/** A request's outcome: the kit's reply, or why it did not go through; `missing` when the caller reads no such PRD. */
type Requested = { ok: true; reply: { login: string; state: 'asked'; url: string } } | { ok: false; refusal: Refusal } | { ok: false; missing: true };

/** A member who can be named: only one with a login, for no email is ever shown. */
type NamedMember = { login: string; name: string | null };

/** What reaches the person named: the PRD, its page, and `/omni:tech-review <n>`. */
function techMessage(request: TechRequested, origin: string): Message {
  const path = `/prd/${request.dossier}`;
  const url = `${origin}${path}`;
  const heading = `PRD ${request.prd} waits for your tech approval`;
  const review = `/omni:tech-review ${request.prd}`;
  const text = [heading, '', request.title, request.repo, '', `Review it in your terminal: ${review}`, `Then give it on its page: ${url}`].join('\n');
  const html = [
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(request.title)}</p>`,
    `<p>${escapeHtml(request.repo)}</p>`,
    `<p>Review it in your terminal: <code>${escapeHtml(review)}</code></p>`,
    `<p><a href="${escapeHtml(url)}">Then give it on PRD ${request.prd}'s page</a></p>`,
  ].join('\n');
  return {
    push: JSON.stringify({ title: heading, body: [request.title, review].join('\n'), url: path }),
    email: { subject: `${heading}: ${request.title}`, text, html },
  };
}

/** The dossier a call names: the page names it, and the database answers when it is no such; the kit names
 * a number, which is looked up. Null when the caller reads no such PRD. */
async function dossierIdOf(tech: TechRepository, prd: TechPrd): Promise<Answer<string | null>> {
  if ('dossier' in prd) return { ok: true, value: prd.dossier };
  const found = await tech.dossier(prd.repo, prd.prd);
  return found.ok ? { ok: true, value: found.value?.dossier ?? null } : found;
}

/** Requests the Tech Approval of `login` as the caller, and reaches them. `origin` is where the caller
 * reached this app: the PRD's page is under it. */
export async function requestTech(deps: TechDeps, prd: TechPrd, login: string, origin: string): Promise<Requested> {
  const id = await dossierIdOf(deps.tech, prd);
  if (!id.ok) return id;
  if (id.value === null) return { ok: false, missing: true };
  const recorded = await deps.tech.request(id.value, login);
  if (!recorded.ok) return recorded;
  const request = recorded.value;
  try {
    await reachAll(deps, request, techMessage(request, origin), origin);
  } catch (error) {
    deps.log(`approvals: reaching PRD #${request.prd}'s tech approver failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const [named] = request.asked;
  return { ok: true, reply: { login: named?.login ?? login, state: 'asked', url: `${origin}/prd/${request.dossier}` } };
}

/** The members of the workspace that holds the PRD who can be named, oldest first; null when the caller reads no such PRD. */
export async function techMembersOf(tech: TechRepository, prd: TechPrd): Promise<Answer<NamedMember[] | null>> {
  const id = await dossierIdOf(tech, prd);
  if (!id.ok || id.value === null) return id.ok ? { ok: true, value: null } : id;
  const found = await tech.workspace(id.value);
  if (!found.ok) return found;
  const [dossier] = found.value;
  if (!dossier) return { ok: true, value: null };
  const roster = await tech.roster(dossier.workspace_id);
  if (!roster.ok) return roster;
  return { ok: true, value: roster.value.flatMap((m) => (m.github_login ? [{ login: m.github_login, name: m.name }] : [])) };
}
