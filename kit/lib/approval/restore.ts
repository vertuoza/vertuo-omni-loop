// `omni approval restore <n>` (PRD 1612, s1): each file the judge found drifted is written back from
// the pinned version's content the server sent with the approval (`dossier_versions.content`), after
// checking that content hashes to the sha256 the approval pinned. One line per file:
//
// | line                                                                      | when                          |
// |---------------------------------------------------------------------------|-------------------------------|
// | `restored <file> · <how> · sha256 <7>`                                    | written back                  |
// | `refused <file> · the pinned version does not hash to <7> · approve again` | the content is not the pinned |
// | `cannot restore <file> · the pinned version cannot be read · approve again` | the server sent no content   |
// | `cannot restore <file> · the approval was voided · approve again`          | a push voided the approval    |
//
// A reading that is not drifted restores nothing: approved says so, any other state prints its own
// lines. It writes files only; it never commits and never pushes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sha256 } from '../dossier/folder.ts';
import type { Layout } from '../layout.ts';
import type { PrdNumber } from '../ids.ts';
import { treeFileOf } from './approval.ts';
import type { ApprovalReading, ApprovalTree } from './approval.ts';

/** Where restored files are written: the tree's file for a pinned one, and a writer. */
export type RestoreTree = Pick<ApprovalTree, 'fileOf'> & { write(file: string, content: string): void };

/** What a restore did: one line per file, and whether every drifted file was written back. */
export type Restored = { ok: boolean; lines: string[] };

/** The checkout at `ctx.root`, as a restore writes it. */
export function checkoutWriter(ctx: { root: string; layout: Layout }, prd: PrdNumber): RestoreTree {
  return {
    fileOf: (file) => treeFileOf(ctx, prd, file),
    write: (file, content) => {
      const absolute = join(ctx.root, file);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
    },
  };
}

/** Writes each drifted file of `reading` back to its pinned content through `tree`. */
export function restoreDrift(reading: ApprovalReading, tree: RestoreTree): Restored {
  if (reading.state === 'approved') return { ok: true, lines: reading.lines.map((line) => `nothing to restore · ${line}`) };
  if (reading.state !== 'drifted' || !reading.approval) return { ok: false, lines: reading.lines };
  const { approval, url } = reading;
  const again = `approve again: ${url ?? 'the PRD page'}`;
  let ok = true;
  const lines = reading.drift.map((drift) => {
    const pin = approval.files.find((file) => file.kind === drift.kind && tree.fileOf(file) === drift.file);
    const refuse = (line: string) => {
      ok = false;
      return line;
    };
    if (drift.how === 'voided') return refuse(`cannot restore ${drift.file} · the approval was voided · ${again}`);
    if (pin?.content === undefined) return refuse(`cannot restore ${drift.file} · the pinned version cannot be read · ${again}`);
    if (sha256(pin.content) !== pin.sha256) {
      return refuse(`refused ${drift.file} · the pinned version does not hash to ${pin.sha256.slice(0, 7)} · ${again}`);
    }
    tree.write(drift.file, pin.content);
    return `restored ${drift.file} · ${drift.how} · sha256 ${pin.sha256.slice(0, 7)}`;
  });
  return { ok, lines };
}
