// Sends a pitch run read by `./push-run.mjs` to the Omni page (PRD 859's spec, "Push"): one call for a
// signed upload link per file of the five, a PUT of each file to its own link, then one call that
// registers the run and answers the Pitch tab's link and the GIF's stable link. A refused or failed call
// is the `AskCallError` it is, and stops the push there; it never retries. A reply missing what the
// contract promises is a `PitchReplyError`.
import { readFileSync } from 'node:fs';

export class PitchReplyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PitchReplyError';
  }
}

const isText = (value) => typeof value === 'string' && value.length > 0;

/** The upload link of each of `files`, by name, from the upload call's reply. */
function linksOf(reply, files) {
  if (!isText(reply?.run)) throw new PitchReplyError('no run in the reply');
  const given = Array.isArray(reply.files) ? reply.files : [];
  const links = files.map(({ name }) => {
    const url = given.find((file) => file?.name === name)?.url;
    if (!isText(url)) throw new PitchReplyError(`no upload link for ${name} in the reply`);
    return url;
  });
  return { runId: reply.run, links };
}

/**
 * @param {{ client: { requestPitchUploads: Function, upload: Function, registerPitch: Function }, repo: string, prd: number,
 *   run: { audience: string, look: string, commit: string, hook: string, benefit: string, kicker: string, closing: string,
 *     files: Array<{ name: string, path: string, bytes: number, type: string }> },
 *   read?: (path: string) => Uint8Array }} options
 * @returns {Promise<{ tab: string, gif: string }>} the Pitch tab's link and the GIF's stable link, which
 *   opens without signing in
 */
export async function pushPitch({ client, repo, prd, run, read = readFileSync }) {
  const reply = await client.requestPitchUploads({ repo, prd, files: run.files.map(({ name, bytes, type }) => ({ name, bytes, type })) });
  const { runId, links } = linksOf(reply, run.files);
  for (const [index, file] of run.files.entries()) await client.upload(links[index], read(file.path), file.type);
  const { audience, look, commit, hook, benefit, kicker, closing } = run;
  const registered = await client.registerPitch({ repo, prd, run: runId, audience, look, commit, hook, benefit, kicker, closing });
  if (!isText(registered?.url)) throw new PitchReplyError('no link in the reply');
  if (!isText(registered?.gif)) throw new PitchReplyError('no GIF link in the reply');
  return { tab: registered.url, gif: registered.gif };
}
