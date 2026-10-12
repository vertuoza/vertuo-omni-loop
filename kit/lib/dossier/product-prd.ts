// A product PRD's files as the kit reads and writes them (PRD 1548): a product PRD (`mobile-12`) lives on
// the server, in no repository, so its spec, plan, before/after and voice are its dossier's versions and
// the kit moves them through typed verbs, never a folder of the delivery tree.
//
// - `readFilesFolder(dir)`: the files `omni dossier push` sends from any folder (a scratch one, most
//   often), named as a PRD's folder names them, each whole with its hash; the spec's front-matter title.
// - `parseLatest(body)`: the get route's answer, `GET /api/dossiers/get`, the latest version of one kind.
// - `writeScratch(prdId, latest)`: that version, written under its file name in a new folder of the
//   system's scratch space, outside every repository; `omni dossier get` prints its path.
// - The last-read copy: each version read is kept in `.omni-loop/local/prd-cache/<id>/<kind>.json` of the
//   main checkout, with when it was read, so `omni prd <id> --show <kind>` answers while the server is
//   down, marked `as of` that time. Only `--show` reads it: no gate ever trusts it (the spec's decision
//   on the voice's objection), and a copy that does not read is none.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import type { ProductPrdId } from '../ids.ts';
import { isOneOf } from '../narrow.ts';
import { VOICE_FILE } from '../voice/voice.ts';
import { ARTIFACT_MAX_BYTES, frontMatterTitle, sha256, TITLE_MAX } from './folder.ts';
import type { Artifact, ArtifactKind, TooLarge } from './folder.ts';

/** A PRD's kinds, in the order a push sends them, each with the file name a PRD's folder gives it. */
export const PRD_FILES: Readonly<Record<ArtifactKind, string>> = Object.freeze({
  spec: 'spec.md', plan: 'plan.md', 'before-after': 'before-after.html', voice: VOICE_FILE,
});
export const PRD_KINDS = Object.freeze(['spec', 'plan', 'before-after', 'voice'] as const satisfies readonly ArtifactKind[]);

/** Whether `value` is one of a PRD's kinds. */
export const isPrdKind = (value: unknown): value is ArtifactKind => isOneOf(PRD_KINDS, value);

/** The files of `dir` a product PRD's push sends: each of a PRD's kinds found there, whole, and the
 * spec's title (null with no spec, or none in its front matter). */
export function readFilesFolder(dir: string): { title: string | null; artifacts: Artifact[]; tooLarge: TooLarge[] } {
  const artifacts: Artifact[] = [];
  const tooLarge: TooLarge[] = [];
  let title: string | null = null;
  for (const kind of PRD_KINDS) {
    const path = join(dir, PRD_FILES[kind]);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path);
    const content = raw.toString('utf8');
    if (kind === 'spec') title = frontMatterTitle(content)?.slice(0, TITLE_MAX) ?? null;
    if (raw.length > ARTIFACT_MAX_BYTES) tooLarge.push({ kind, path, bytes: raw.length });
    else artifacts.push({ kind, path, content, sha256: sha256(content), bytes: raw.length });
  }
  return { title, artifacts, tooLarge };
}

const text = z.string().min(1);

const LatestSchema = z.object({
  id: text, prdId: text, url: text, kind: z.enum(PRD_KINDS), version: z.number().int().positive(), sha256: text, content: z.string(), createdAt: text,
});

/** A product PRD's latest version of one kind, as the get route answers it. */
export type Latest = z.infer<typeof LatestSchema>;

/** The get route's answer, or null when it is not one. */
export function parseLatest(body: unknown): Latest | null {
  const parsed = LatestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Writes `latest` under its file name in a new folder of `base` (the system's scratch space); its path. */
export function writeScratch(prdId: ProductPrdId, latest: Pick<Latest, 'kind' | 'content'>, base: string = tmpdir()): string {
  const path = join(mkdtempSync(join(base, `omni-${prdId}-`)), PRD_FILES[latest.kind]);
  writeFileSync(path, latest.content);
  return path;
}

/** Where the last-read copies are kept, under the main checkout. */
export const LAST_READ_DIR = join(LOCAL_DIR, 'prd-cache');

const LastReadSchema = LatestSchema.extend({ readAt: text });

/** A last-read copy: the version as it was read, and when. */
export type LastRead = z.infer<typeof LastReadSchema>;

const lastReadPath = (root: string, prdId: ProductPrdId, kind: ArtifactKind) => join(root, LAST_READ_DIR, prdId, `${kind}.json`);

/** Keeps `latest` as product PRD `prdId`'s last-read copy of its kind, read at `readAt`. */
export function rememberLatest(root: string, prdId: ProductPrdId, latest: Latest, readAt: string): void {
  ensureLocalDir(root);
  const path = lastReadPath(root, prdId, latest.kind);
  mkdirSync(join(root, LAST_READ_DIR, prdId), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...latest, readAt }, null, 2)}\n`);
}

/** Product PRD `prdId`'s last-read copy of `kind`, or null when there is none that reads. */
export function lastRead(root: string, prdId: ProductPrdId, kind: ArtifactKind): LastRead | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(lastReadPath(root, prdId, kind), 'utf8'));
  } catch {
    return null;
  }
  const parsed = LastReadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
