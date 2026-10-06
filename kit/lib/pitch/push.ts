// Sends a pitch run read by `./push-run.ts` to the Omni page (PRD 859's spec, "Push"): one call for a
// signed upload link per file of the five, a PUT of each file to its own link, then one call that
// registers the run and answers the Pitch tab's link and the GIF's stable link. A refused or failed call
// is the `AskCallError` it is, and stops the push there; it never retries. A reply missing what the
// contract promises is a `PitchReplyError`.
import { readFileSync } from 'node:fs';
import { at } from '../narrow.ts';
import type { PitchFile, PitchRun } from './push-run.ts';
import type { PrdNumber } from '../ids.ts';

/** A file of the run, as the upload call asks for it. */
type UploadRequest = { name: string; bytes: number; type: string };

/** What the register call sends: the run's id, its audience, look, commit and words. */
type PitchRegistration = Omit<PitchRun, 'files'> & { repo: string; prd: PrdNumber; run: string };

/** The Omni page's three pitch calls (`kit/lib/ask/client.ts`). Their replies are read as unknown. */
export type PitchClient = {
  requestPitchUploads: (request: { repo: string; prd: PrdNumber; files: UploadRequest[] }) => Promise<unknown>;
  upload: (url: string, bytes: Uint8Array<ArrayBuffer>, type: string) => Promise<unknown>;
  registerPitch: (request: PitchRegistration) => Promise<unknown>;
};

export class PitchReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PitchReplyError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The upload link of each of `files`, by name, from the upload call's reply. */
function linksOf(reply: unknown, files: readonly PitchFile[]): { runId: string; links: string[] } {
  const run = isRecord(reply) ? reply.run : undefined;
  if (!isRecord(reply) || !isText(run)) throw new PitchReplyError('no run in the reply');
  const given: unknown[] = Array.isArray(reply.files) ? reply.files : [];
  const byName = new Map(given.map((file) => (isRecord(file) ? [file.name, file.url] : [undefined, undefined])));
  const links = files.map(({ name }) => {
    const url = byName.get(name);
    if (!isText(url)) throw new PitchReplyError(`no upload link for ${name} in the reply`);
    return url;
  });
  return { runId: run, links };
}

/** Sends `run`, and answers the Pitch tab's link and the GIF's stable link, which opens without signing in. */
export async function pushPitch({
  client,
  repo,
  prd,
  run,
  read = readFileSync,
}: {
  client: PitchClient;
  repo: string;
  prd: PrdNumber;
  run: PitchRun;
  read?: (path: string) => Uint8Array<ArrayBuffer>;
}): Promise<{ tab: string; gif: string }> {
  const reply = await client.requestPitchUploads({ repo, prd, files: run.files.map(({ name, bytes, type }) => ({ name, bytes, type })) });
  const { runId, links } = linksOf(reply, run.files);
  for (const [index, file] of run.files.entries()) await client.upload(at(links, index, `the upload link of ${file.name}`), read(file.path), file.type);
  const { audience, look, commit, hook, benefit, kicker, closing } = run;
  const registered = await client.registerPitch({ repo, prd, run: runId, audience, look, commit, hook, benefit, kicker, closing });
  const tab = isRecord(registered) ? registered.url : undefined;
  const gif = isRecord(registered) ? registered.gif : undefined;
  if (!isText(tab)) throw new PitchReplyError('no link in the reply');
  if (!isText(gif)) throw new PitchReplyError('no GIF link in the reply');
  return { tab, gif };
}
