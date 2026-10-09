import { notifyAll, type Channels, type Message } from '../notify/notify';
import type { PushVoid, VoidReachRepository, VoidRepository } from './void.repository';

// Telling an approver their approval no longer holds (PRD 1322 s6, spec §7). `dossier_push` voids the
// approval in force in the push's own transaction; once the push is answered, the push route hands the
// dossier here. This reads the voids the caller's push left (none: nothing to do) and reaches the
// approver they voided by the channels they turned on: `approval voided by <pusher>'s push`, each
// changed kind with its old and new short hash, and the PRD's page. One push voids one approval, so one
// message goes out, however many kinds it changed. Telling never fails a push: what could not be read
// or sent is one log line.

/** What telling needs: the pusher's read, the service role's (null when this deployment has no service
 * key), the channels built for a contact address (this app's origin) with a way to forget a device,
 * and the log. */
export type TellDeps = {
  voids: VoidRepository;
  reach: VoidReachRepository | null;
  channels: (contact: string) => Channels;
  log: (line: string) => void;
};

const short = (sha256: string) => sha256.slice(0, 7);

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** What reaches the approver: the push carries {title, body, url} as the service worker reads it
 * (settled item s9-01-push-payload-shape); the email the same lines and the link. */
function voidMessage(voids: readonly [PushVoid, ...PushVoid[]], origin: string): Message {
  const [first] = voids;
  const path = `/prd/${first.dossier}`;
  const url = `${origin}${path}`;
  const heading = `approval voided by ${first.pusher}'s push`;
  const about = `PRD ${first.prd} · ${first.title}`;
  const changes = voids.map((v) => `${v.kind} ${short(v.from)}→${short(v.to)}`);
  const text = [heading, '', about, first.repo, ...changes, '', `Open it to approve again: ${url}`].join('\n');
  const html = [
    `<h1>${escape(heading)}</h1>`,
    `<p>${escape(about)}</p>`,
    `<p>${escape(first.repo)}</p>`,
    `<ul>${changes.map((c) => `<li>${escape(c)}</li>`).join('')}</ul>`,
    `<p><a href="${escape(url)}">Open PRD ${first.prd} to approve it again</a></p>`,
  ].join('\n');
  return {
    push: JSON.stringify({ title: heading, body: [about, changes.join(' · ')].join('\n'), url: path }),
    email: { subject: `PRD ${first.prd}: ${heading}`, text, html },
  };
}

async function tell(deps: TellDeps, dossier: string, origin: string): Promise<void> {
  const read = await deps.voids.ofPush(dossier);
  if (!read.ok) {
    deps.log(`approvals: the voids of a push of dossier ${dossier} could not be read: ${read.message ?? read.code ?? 'the database failed'}`);
    return;
  }
  const [first, ...rest] = read.value;
  if (!first) return;
  if (!deps.reach) {
    deps.log(`approvals: PRD #${first.prd} of ${first.repo}'s approval is voided, but ${first.approver} is not told: SUPABASE_SERVICE_ROLE_KEY is not set`);
    return;
  }
  const recipients = await deps.reach.recipients(first.id);
  if (!recipients.ok) {
    deps.log(`approvals: how ${first.approver} is reached could not be read: ${recipients.message ?? recipients.code ?? 'the database failed'}`);
    return;
  }
  await notifyAll(recipients.value, voidMessage([first, ...rest], origin), deps.channels(origin), deps.log);
}

/** Tells the approver whose approval the caller's push of `dossier` voided, if it voided one. `origin`
 * is where the caller reached this app: the PRD's page is under it. Never throws. */
export async function tellVoids(deps: TellDeps, dossier: string, origin: string): Promise<void> {
  try {
    await tell(deps, dossier, origin);
  } catch (error) {
    deps.log(`approvals: telling the approver of dossier ${dossier}'s void failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
