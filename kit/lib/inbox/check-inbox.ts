/**
 * **An inbox spec is a typed thing** (PRD #1015, slice s1) — the guard, folders layout.
 *
 * Grades every spec the inbox holds (`ctx.layout.specFiles()`). What must hold, each failing with
 * the file and a reason a human can act on:
 *
 * 1. The spec exists and parses: well-formed front matter holding exactly `prd`, `title`,
 *    `blocked-by`, `spec`, and an optional `areas`, `proof`, `e2e` and `phase0` (PRD 1299: `server` only, a
 *    PRD approved on its PRD page) — nothing else. A `status`, `branch`, `value`,
 *    `priority` or `plan` field is refused by name here — the plan is always the sibling
 *    `plan.md`, never a front-matter value.
 * 2. The `prd` a spec declares agrees with its own folder's number.
 * 3. `blocked-by` names only a PRD some folder actually carries, in the inbox or already shipped
 *    (`ctx.layout.whereIs`).
 * 4. Each `areas` entry, whenever this repository has a knowledge folder
 *    (`ctx.layout.knowledgeRoot`) — whatever `laws.source` says — names a real domain folder.
 * 5. The sibling `before-after.html`, when present, stays at or under the configured size cap
 *    (`ctx.config.limits.beforeAfterMaxBytes`); when its head carries
 *    `<meta name="omni-before-after" content="2">` (PRD 2239), it also keeps the two-tab page's rules
 *    (`../before-after/grade.ts`). A page without the meta is graded on its size alone.
 * 6. The sibling `voice.json`, when present, reads as the voice record (PRD 822, `../voice/voice.ts`):
 *    each refusal names the file, the round and the field.
 * 7. Every roadmap under the inbox's `roadmaps/` passes `omni roadmap check` (PRD 1162,
 *    `../roadmap/index.ts`): each violation names the roadmap's file and its row or question.
 *
 * An empty inbox passes trivially. A missing `plan.md` is never graded here — whether a PRD has
 * been planned yet is a status question, never a violation.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/check-inbox.mjs — changes in kit/porting/inbox--check-inbox.md.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { productAvoids } from '../design/words/product.ts';
import { gradeBeforeAfter } from '../before-after/grade.ts';
import { readRepoFile } from '../check-report.ts';
import { domainsDir } from '../knowledge/registers.ts';
import { parseFolderName } from '../layout.ts';
import { findRoadmapViolations } from '../roadmap/index.ts';
import { parseVoice, VOICE_FILE } from '../voice/voice.ts';
import type { Context } from '../context.ts';
import type { InboxItem } from '../types.ts';
import { parseSpec } from './inbox.ts';
import type { PrdNumber } from '../ids.ts';

/** What the inbox guard reads of a context. */
type Ctx = Pick<Context, 'root' | 'layout' | 'config'>;

/** A graded folder's record: the spec's fields, its file and its folder's name. */
type FolderRecord = InboxItem & { file: string; folder: string };

/** Every folder directly under the knowledge root's `domains/` — a real area name, nothing parsed. */
function knownAreas(ctx: Ctx): Set<string> {
  const dir = join(ctx.root, domainsDir(ctx));
  if (!existsSync(dir)) return new Set<string>();
  return new Set(
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
}

/**
 * Parses one spec's text and, when it parses, grades its own `prd` against its folder and its
 * `areas` (when configured) against the knowledge root. Returns `{ record, violations }` —
 * `record` is `null` when the spec is malformed, so a caller can still collect every violation.
 */
function violationsForFile(
  file: string,
  folder: string,
  text: string,
  ctx: Ctx,
): { record: InboxItem | null; violations: string[] } {
  const parsed = parseSpec(text, { file });
  if (!parsed.ok) {
    return { record: null, violations: parsed.errors };
  }

  const { record } = parsed;
  const violations: string[] = [];

  const folderPrd = parseFolderName(folder)?.prd;
  if (folderPrd !== undefined && record.prd !== folderPrd) {
    violations.push(
      `${file}: prd ${record.prd} does not agree with its folder's number, ${folderPrd} ("${folder}").`,
    );
  }

  if (record.areas?.length && existsSync(join(ctx.root, ctx.layout.knowledgeRoot))) {
    const known = knownAreas(ctx);
    for (const area of record.areas) {
      if (!known.has(area)) {
        violations.push(`${file}: areas names "${area}", which is not a folder under ${domainsDir(ctx)}.`);
      }
    }
  }

  return { record, violations };
}

/** Grades one already-read spec's text. Empty array means entirely well-formed. */
export function checkSpecText(file: string, text: string, { ctx }: { ctx: Ctx }): string[] {
  const folder = basename(dirname(file));
  return violationsForFile(file, folder, text, ctx).violations;
}

/** Every `blocked-by` PRD number no inbox or shipped folder carries, one violation per unresolved dependency. */
function blockedByViolations(records: readonly FolderRecord[], ctx: Ctx): string[] {
  const violations: string[] = [];
  for (const record of records) {
    if (record.blockedBy === 'none') continue;
    for (const prd of record.blockedBy) {
      if (!ctx.layout.whereIs(prd)) {
        violations.push(
          `${record.file}: blocked-by names PRD #${prd}, which no inbox or shipped folder carries.`,
        );
      }
    }
  }
  return violations;
}

/**
 * The size violation for one before-after.html, or `null` when it is absent or within the cap. Also
 * `omni visual`'s size check (`kit/lib/visual/verdict.ts`), so both read one cap one way.
 */
export function beforeAfterViolation(
  file: string,
  ctx: { root: string; config: { limits: { beforeAfterMaxBytes: number } } },
): string | null {
  const absolute = join(ctx.root, file);
  if (!existsSync(absolute)) return null;
  const { size } = statSync(absolute);
  if (size <= ctx.config.limits.beforeAfterMaxBytes) return null;
  return `${file}: is ${size} bytes, over the ${ctx.config.limits.beforeAfterMaxBytes}-byte cap.`;
}

/** The two-tab page's violations of one before-after.html (PRD 2239), each naming the file: none when it is absent. */
function pageViolations(file: string, folder: string, ctx: Ctx): string[] {
  if (!existsSync(join(ctx.root, file))) return [];
  return gradeBeforeAfter({ file, html: readRepoFile(ctx, file), prd: parseFolderName(folder)?.prd ?? null });
}

/** The violations of one voice.json, each naming the file: none when it is absent or reads. */
function voiceViolations(file: string, ctx: Ctx): string[] {
  if (!existsSync(join(ctx.root, file))) return [];
  return parseVoice(readRepoFile(ctx, file)).errors.map((error: string) => `${file}: ${error}`);
}

/**
 * One inbox folder's own grading, its spec file named: the spec's violations, its before-after
 * page's size and (a page carrying the meta) its rules, and the parsed record (`null` when absent or malformed) for the `blocked-by` pass.
 */
function gradeFolder(specFile: string, ctx: Ctx): { violations: string[]; record: FolderRecord | null } {
  const folder = basename(dirname(specFile));
  const violations: string[] = [];
  let record: FolderRecord | null = null;

  if (!existsSync(join(ctx.root, specFile))) {
    violations.push(`${specFile}: spec.md is missing.`);
  } else {
    const text = readRepoFile(ctx, specFile);
    const graded = violationsForFile(specFile, folder, text, ctx);
    violations.push(...graded.violations);
    if (graded.record) record = { ...graded.record, file: specFile, folder };
  }

  const page = `${dirname(specFile)}/before-after.html`;
  const beforeAfter = beforeAfterViolation(page, ctx);
  if (beforeAfter) violations.push(beforeAfter);
  violations.push(...pageViolations(page, folder, ctx));
  violations.push(...voiceViolations(`${dirname(specFile)}/${VOICE_FILE}`, ctx));

  return { violations, record };
}

/**
 * The inbox rules for one PRD's folder only (PRD 675): exactly what `findInboxViolations` reports
 * for that folder, and nothing for any other folder's faults. A PRD with no inbox folder is one
 * violation saying so. What the omni-loop App grades a phase-0 PR with.
 */
export function inboxViolationsFor({ ctx, prd }: { ctx: Ctx; prd: PrdNumber }): string[] {
  const wanted = Number(prd);
  const specFile = ctx.layout
    .specFiles()
    .find((file) => parseFolderName(basename(dirname(file)))?.prd === wanted);
  if (specFile === undefined) return [`PRD ${wanted} has no inbox folder.`];

  const { violations, record } = gradeFolder(specFile, ctx);
  return [...violations, ...blockedByViolations(record ? [record] : [], ctx)];
}

/** Grades every spec the inbox holds, every sibling before-after page, folder by folder, and every
 * roadmap. */
export function findInboxViolations({ ctx }: { ctx: Ctx }): string[] {
  const violations: string[] = [];
  const records: FolderRecord[] = [];

  for (const specFile of ctx.layout.specFiles()) {
    const graded = gradeFolder(specFile, ctx);
    violations.push(...graded.violations);
    if (graded.record) records.push(graded.record);
  }

  violations.push(...blockedByViolations(records, ctx));
  violations.push(...findRoadmapViolations(ctx));

  return violations;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * PRD 2299: one warning line per avoided word of the product's glossary an inbox spec holds,
 * `<spec file>: "<word>" ×<n> → say <term>`, matched whole and without case, never inside another
 * word. Read from the local copy only; no copy, no warning. Never a violation: the caller prints
 * these beside the check's result and its exit code does not change.
 */
export function inboxAvoidWarnings({ ctx }: { ctx: Ctx }): string[] {
  const { words, says } = productAvoids(ctx.root);
  if (words.length === 0) return [];
  const patterns = words.map((word) => ({
    word,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word.trim()).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu'),
  }));
  const lines: string[] = [];
  for (const file of ctx.layout.specFiles()) {
    if (!existsSync(join(ctx.root, file))) continue;
    const text = readRepoFile(ctx, file);
    for (const { word, pattern } of patterns) {
      const count = text.match(pattern)?.length ?? 0;
      if (count > 0) lines.push(`${file}: "${word}" ×${count} → say ${says.get(word) ?? word}`);
    }
  }
  return lines;
}
