/**
 * **An inbox spec is a typed thing** (PRD #1015, slice s1) — the guard, folders layout.
 *
 * Grades every spec the inbox holds (`ctx.layout.specFiles()`). What must hold, each failing with
 * the file and a reason a human can act on:
 *
 * 1. The spec exists and parses: well-formed front matter holding exactly `prd`, `title`,
 *    `blocked-by`, `spec`, and an optional `areas` — nothing else. A `status`, `branch`, `value`,
 *    `priority` or `plan` field is refused by name here — the plan is always the sibling
 *    `plan.md`, never a front-matter value.
 * 2. The `prd` a spec declares agrees with its own folder's number.
 * 3. `blocked-by` names only a PRD some folder actually carries, in the inbox or already shipped
 *    (`ctx.layout.whereIs`).
 * 4. Each `areas` entry, whenever this repository has a knowledge folder
 *    (`ctx.layout.knowledgeRoot`) — whatever `laws.source` says — names a real domain folder.
 * 5. The sibling `before-after.html`, when present, stays at or under the configured size cap
 *    (`ctx.config.limits.beforeAfterMaxBytes`).
 *
 * An empty inbox passes trivially. A missing `plan.md` is never graded here — whether a PRD has
 * been planned yet is a status question, never a violation.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/check-inbox.mjs — changes in kit/porting/inbox--check-inbox.md.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readRepoFile } from '../check-report.mjs';
import { domainsDir } from '../knowledge/registers.mjs';
import { parseFolderName } from '../layout.mjs';
import { parseSpec } from './inbox.mjs';

/** Every folder directly under the knowledge root's `domains/` — a real area name, nothing parsed. */
function knownAreas(ctx) {
  const dir = join(ctx.root, domainsDir(ctx));
  if (!existsSync(dir)) return new Set();
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
function violationsForFile(file, folder, text, ctx) {
  const parsed = parseSpec(text, { file });
  if (!parsed.ok) {
    return { record: null, violations: parsed.errors };
  }

  const { record } = parsed;
  const violations = [];

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
export function checkSpecText(file, text, { ctx }) {
  const folder = basename(dirname(file));
  return violationsForFile(file, folder, text, ctx).violations;
}

/** Every `blocked-by` PRD number no inbox or shipped folder carries, one violation per unresolved dependency. */
function blockedByViolations(records, ctx) {
  const violations = [];
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

/** The size violation for one folder's before-after.html, or `null` when it is absent or within the cap. */
function beforeAfterViolation(file, ctx) {
  const absolute = join(ctx.root, file);
  if (!existsSync(absolute)) return null;
  const { size } = statSync(absolute);
  if (size <= ctx.config.limits.beforeAfterMaxBytes) return null;
  return `${file}: is ${size} bytes, over the ${ctx.config.limits.beforeAfterMaxBytes}-byte cap.`;
}

/** Grades every spec the inbox holds, and every sibling before-after page. */
export function findInboxViolations({ ctx }) {
  const violations = [];
  const records = [];

  for (const specFile of ctx.layout.specFiles()) {
    const folder = basename(dirname(specFile));

    if (!existsSync(join(ctx.root, specFile))) {
      violations.push(`${specFile}: spec.md is missing.`);
    } else {
      const text = readRepoFile(ctx, specFile);
      const { record, violations: fileViolations } = violationsForFile(specFile, folder, text, ctx);
      violations.push(...fileViolations);
      if (record) records.push({ ...record, file: specFile, folder });
    }

    const beforeAfter = beforeAfterViolation(`${dirname(specFile)}/before-after.html`, ctx);
    if (beforeAfter) violations.push(beforeAfter);
  }

  violations.push(...blockedByViolations(records, ctx));

  return violations;
}
