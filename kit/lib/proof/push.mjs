// Sends a proof run read by `./run.mjs` to the Omni page (PRD 798's spec, "The Omni page"): one call for
// a signed upload link per file, a PUT of each file to its own link, then one call that registers the
// run and answers the Proof tab's link. A refused or failed call is the `AskCallError` it is, and stops
// the push there; a reply missing what the contract promises is a `ProofReplyError`.
//
// A run with no file (every criterion unfilmable) asks for no link, since the upload call takes one file
// at least: its id is minted here, a random UUID as the app's own.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** The run's GIF, found by its name (PRD 798, settled item s2-01). */
const GIF = 'preview.gif';

export class ProofReplyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProofReplyError';
  }
}

const isText = (value) => typeof value === 'string' && value.length > 0;

/** The upload link of each of `files`, by name, from the upload call's reply. */
function linksOf(reply, files) {
  if (!isText(reply?.run)) throw new ProofReplyError('no run in the reply');
  const given = Array.isArray(reply.files) ? reply.files : [];
  const links = files.map(({ name }) => {
    const url = given.find((file) => file?.name === name)?.url;
    if (!isText(url)) throw new ProofReplyError(`no upload link for ${name} in the reply`);
    return url;
  });
  return { runId: reply.run, links };
}

/**
 * @param {{ client: { requestProofUploads: Function, upload: Function, registerProof: Function }, repo: string, prd: number,
 *   run: { commit: string, url: string, criteria: object[], files: Array<{ name: string, path: string, bytes: number, type: string }> },
 *   read?: (path: string) => Uint8Array, newRunId?: () => string }} options
 * @returns {Promise<{ tab: string, gif?: string }>} the Proof tab's link and, for a run that sent a
 *   `preview.gif`, its stable link: the one link GitHub's image proxy can read without signing in
 */
export async function pushProof({ client, repo, prd, run, read = readFileSync, newRunId = randomUUID }) {
  let runId;
  if (run.files.length) {
    const reply = await client.requestProofUploads({ repo, prd, files: run.files.map(({ name, bytes, type }) => ({ name, bytes, type })) });
    const given = linksOf(reply, run.files);
    for (const [index, file] of run.files.entries()) await client.upload(given.links[index], read(file.path), file.type);
    runId = given.runId;
  } else {
    runId = newRunId();
  }
  const registered = await client.registerProof({ repo, prd, run: runId, commit: run.commit, url: run.url, criteria: run.criteria });
  if (!isText(registered?.url)) throw new ProofReplyError('no link in the reply');
  const tab = registered.url;
  if (!run.files.some(({ name }) => name === GIF)) return { tab };
  return { tab, gif: `${new URL(tab).origin}/api/proofs/${runId}/${GIF}` };
}
