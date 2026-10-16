// Sends a proof run read by `./run.ts` to the Omni page (PRD 798's spec, "The Omni page"): one call for
// a signed upload link per file, a PUT of each file to its own link, then one call that registers the
// run and answers the Proof tab's link. A refused or failed call is the `AskCallError` it is, and stops
// the push there; a reply missing what the contract promises is a `ProofReplyError`.
//
// A run with no file (every criterion unfilmable) asks for no link, since the upload call takes one file
// at least: its id is minted here, a random UUID as the app's own.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { at } from '../narrow.ts';
import type { ProofCriterion, ProofFile, ProofRun } from './run.ts';
import type { PrdNumber } from '../ids.ts';

/** A file of the run, as the upload call asks for it. */
type UploadRequest = { name: string; bytes: number; type: string };

/** The Omni page's three proof calls (`kit/lib/ask/client.ts`). Their replies are read as unknown. */
export type ProofClient = {
  requestProofUploads: (request: { repo: string; prd: PrdNumber; kind?: 'bug'; files: UploadRequest[] }) => Promise<unknown>;
  upload: (url: string, bytes: Uint8Array<ArrayBuffer>, type: string) => Promise<unknown>;
  registerProof: (request: { repo: string; prd: PrdNumber; kind?: 'bug'; run: string; commit: string; url: string; criteria: ProofCriterion[] }) => Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The run's GIF, found by its name (PRD 798, settled item s2-01). */
const GIF = 'preview.gif';

/**
 * The clips of a bug's run, in the order they are linked (PRD 2100): the story filmed before the fix, then after. The
 * proof API serves exactly these two names under a run (`apps/galaxy/src/proof/store.ts`, `PROOF_CLIP_NAMES`).
 */
const BUG_CLIPS = ['before.webm', 'after.webm'] as const;

export class ProofReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProofReplyError';
  }
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The upload link of each of `files`, by name, from the upload call's reply. */
function linksOf(reply: unknown, files: readonly ProofFile[]): { runId: string; links: string[] } {
  const run = isRecord(reply) ? reply.run : undefined;
  if (!isRecord(reply) || !isText(run)) throw new ProofReplyError('no run in the reply');
  const given: unknown[] = Array.isArray(reply.files) ? reply.files : [];
  const links = files.map(({ name }) => {
    const found = given.find((file) => isRecord(file) && file.name === name);
    const url = isRecord(found) ? found.url : undefined;
    if (!isText(url)) throw new ProofReplyError(`no upload link for ${name} in the reply`);
    return url;
  });
  return { runId: run, links };
}

/**
 * Sends `run`, and answers the Proof tab's link and, for a run that sent a `preview.gif`, its stable
 * link: the one link GitHub's image proxy can read without signing in. For a bug (`kind: 'bug'`), a run that
 * sent `before.webm` or `after.webm` also gets a stable link to each, `clips`, before first (PRD 2100); no
 * other run has a `clips` key.
 */
export async function pushProof({
  client,
  repo,
  prd,
  kind,
  run,
  read = readFileSync,
  newRunId = randomUUID,
}: {
  client: ProofClient;
  repo: string;
  prd: PrdNumber;
  /** `bug` sends the run to the bug dossier numbered `prd`; left out, it is the PRD's, and no `kind` is sent. */
  kind?: 'bug';
  run: ProofRun;
  read?: (path: string) => Uint8Array<ArrayBuffer>;
  newRunId?: () => string;
}): Promise<{ tab: string; gif?: string; clips?: string[] }> {
  const kindOf = kind ? { kind } : {};
  let runId: string;
  if (run.files.length) {
    const reply = await client.requestProofUploads({ repo, prd, ...kindOf, files: run.files.map(({ name, bytes, type }) => ({ name, bytes, type })) });
    const given = linksOf(reply, run.files);
    for (const [index, file] of run.files.entries()) await client.upload(at(given.links, index, `the upload link of ${file.name}`), read(file.path), file.type); // one link per file
    runId = given.runId;
  } else {
    runId = newRunId();
  }
  const registered = await client.registerProof({ repo, prd, ...kindOf, run: runId, commit: run.commit, url: run.url, criteria: run.criteria });
  const tab = isRecord(registered) ? registered.url : undefined;
  if (!isText(tab)) throw new ProofReplyError('no link in the reply');
  const stable = (name: string) => `${new URL(tab).origin}/api/proofs/${runId}/${name}`;
  const sent = (name: string) => run.files.some((file) => file.name === name);
  const clips = kind === 'bug' ? BUG_CLIPS.filter(sent).map(stable) : [];
  return { tab, ...(sent(GIF) ? { gif: stable(GIF) } : {}), ...(clips.length ? { clips } : {}) };
}
