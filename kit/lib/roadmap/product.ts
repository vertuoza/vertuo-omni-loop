/**
 * **A roadmap born on the server is checked and pushed** (PRD 2011, slice s2): what `omni roadmap check
 * --product <key> <file>` and `omni roadmap push --product <key> (--new | --roadmap <n>) <file>` do
 * beyond a git-born roadmap's. The roadmap is a file anywhere (a scratch folder, most often): it has no
 * issue, no folder of the inbox and no phase-0 PR, and the server numbers it, `<key>-R<n>`.
 *
 * Its rows are checked against the product's own repositories, never `plan.targets`. The kit does not
 * hold them: a check call to the same route as a push (`check: true`, which writes nothing) answers the
 * product's repositories as `plan.targets` would hold them, and {@link gradeProductRoadmap} grades the
 * rows against those. A push runs the same check first, so a row naming a repository outside the
 * product is refused by name and nothing is written; the server refuses it too.
 */
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import { ProductRoadmapIdSchema, productRoadmapParts } from '../ids.ts';
import type { ProductRoadmapId } from '../ids.ts';
import { gradeProductRoadmap } from './grade.ts';
import type { RoadmapTarget } from './grade.ts';
import { parseProductRoadmap } from './parse.ts';
import type { ProductRoadmap } from './parse.ts';
import { productRoadmapPushBody } from './push.ts';
import type { PushedPrerequisiteResult } from './push.ts';

/** What a product roadmap's calls need of a signed-in client. */
export type RoadmapClient = { pushRoadmap: (body: unknown) => Promise<unknown> };

/** The one line a failed call is reported with; the app's reason after it when it gave one. */
export function callLine(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  return error.reason ? `refused (${error.status}): ${error.reason}` : `refused (${error.status})`;
}

/** The check call's answer: the product's repositories, in short names, as `plan.targets` has them. */
const CheckReply = z.object({
  product: z.object({ key: z.string(), name: z.string() }),
  repositories: z.array(z.object({ repo: z.string(), readOnly: z.boolean(), consumes: z.array(z.string()) })),
});

/** A roadmap file read and graded: its record and every violation, or the lines it stops on. */
export type GradedProductRoadmap =
  | { ok: true; roadmap: ProductRoadmap; violations: string[] }
  | { ok: false; lines: string[] };

/**
 * Parses `document` as a roadmap born on the server and grades it against the repositories of the
 * product keyed `key`, which the server answers. Stops, with the lines to print, when the file does not
 * parse or the repositories cannot be read.
 */
export async function gradeProductFile({ key, repo, document, client }: {
  key: string;
  repo: string | null;
  document: string;
  client: RoadmapClient;
}): Promise<GradedProductRoadmap> {
  const parsed = parseProductRoadmap(document);
  if (!parsed.ok) return { ok: false, lines: parsed.errors };
  const { roadmap } = parsed;
  let reply: unknown;
  try {
    reply = await client.pushRoadmap(productRoadmapPushBody({ key, seq: null, repo, roadmap, document, check: true }));
  } catch (error) {
    return { ok: false, lines: [`the repositories of product ${key} could not be read: ${callLine(error)}`] };
  }
  const read = CheckReply.safeParse(reply);
  if (!read.success) return { ok: false, lines: [`the repositories of product ${key} could not be read: the reply is not a check`] };
  const repositories: RoadmapTarget[] = read.data.repositories.map(({ repo: name, readOnly, consumes }) => ({ repo: name, readOnly, consumes }));
  return { ok: true, roadmap, violations: gradeProductRoadmap(roadmap, { key, repositories }) };
}

/** A roadmap id argument for product `key`: `3` or `<key>-R3`; null when it is neither, or another product's. */
function roadmapSeqArg(key: string, value: string): number | null {
  if (/^[1-9]\d{0,9}$/.test(value)) return Number(value);
  const id = ProductRoadmapIdSchema.safeParse(value);
  if (!id.success) return null;
  const parts = productRoadmapParts(id.data);
  return parts.key === key ? parts.seq : null;
}

/** Where a push goes, as the flags and the file's front matter say: the roadmap number, null for the
 * product's next, or the line saying why they do not agree. */
export type PushTarget = { seq: number | null } | { error: string };

/** What the file's front matter names, held against the product and against `--new`. */
function namedFault(key: string, named: ProductRoadmapId | null, create: boolean): string | null {
  if (named === null) return null;
  const parts = productRoadmapParts(named);
  if (parts.key !== key) return `the file names ${named}, a roadmap of product ${parts.key}, not ${key}.`;
  return create ? `the file already names ${named}: push to it with --roadmap ${parts.seq}, or take its roadmap: line out to create another.` : null;
}

/** The number `--roadmap` gives, against the one the file names. */
function explicitTarget(key: string, roadmap: string, named: ProductRoadmapId | null): PushTarget {
  const seq = roadmapSeqArg(key, roadmap);
  if (seq === null) return { error: `--roadmap "${roadmap}" is not a roadmap of product ${key} (as 3 or ${key}-R3).` };
  const fromFile = named === null ? null : productRoadmapParts(named).seq;
  return fromFile !== null && fromFile !== seq ? { error: `the file names ${named}, but --roadmap says ${key}-R${seq}.` } : { seq };
}

/** Where a push goes: `--new` the product's next roadmap, `--roadmap` one of its own, else the roadmap
 * the file's front matter names. */
export function pushTarget({ key, roadmap, create }: { key: string; roadmap: string | null; create: boolean }, named: ProductRoadmapId | null): PushTarget {
  const fault = namedFault(key, named, create);
  if (fault !== null) return { error: fault };
  if (create) return { seq: null };
  if (roadmap !== null) return explicitTarget(key, roadmap, named);
  if (named === null) return { error: 'say where it goes: --new for the next roadmap of the product, or --roadmap <n>.' };
  return { seq: productRoadmapParts(named).seq };
}

/** The push's answer: the roadmap's id and page, whether it was created, the versions it added. */
const PushReply = z.object({
  roadmapId: z.string().min(1),
  roadmap: ProductRoadmapIdSchema,
  created: z.boolean(),
  added: z.array(z.object({ kind: z.string(), version: z.number() })),
  unchanged: z.array(z.string()),
});

export type ProductPushed = { roadmap: ProductRoadmapId; page: string; created: boolean; added: string[]; unchanged: string[] };

/** What a push prints: the roadmap's id on a line of its own, then what the push did and the page. */
export function pushedLines({ roadmap, page, created, added, unchanged }: ProductPushed): string {
  const versions = added.length > 0 ? `added ${added.join(', ')}` : 'no new version';
  return `${roadmap}\n${created ? 'created' : 'updated'} · ${versions}${unchanged.length > 0 ? ` · unchanged ${unchanged.join(', ')}` : ''} — ${page}`;
}

/** Sends a graded roadmap: to the product's next roadmap when `seq` is null, else to `<key>-R<seq>`. */
export async function pushProductFile({ key, seq, repo, roadmap, document, askUrl, client, result = null }: {
  key: string;
  seq: number | null;
  repo: string | null;
  roadmap: ProductRoadmap;
  document: string;
  askUrl: string;
  client: RoadmapClient;
  result?: PushedPrerequisiteResult | null;
}): Promise<{ ok: true; pushed: ProductPushed } | { ok: false; line: string }> {
  let reply: unknown;
  try {
    reply = await client.pushRoadmap(productRoadmapPushBody({ key, seq, repo, roadmap, document, result }));
  } catch (error) {
    return { ok: false, line: callLine(error) };
  }
  const read = PushReply.safeParse(reply);
  if (!read.success) return { ok: false, line: 'refused (no roadmap in the reply)' };
  const { roadmapId, roadmap: id, created, added, unchanged } = read.data;
  return {
    ok: true,
    pushed: { roadmap: id, page: `${askUrl.replace(/\/+$/, '')}/roadmaps/${roadmapId}`, created, added: added.map((item) => `${item.kind} v${item.version}`), unchanged },
  };
}
