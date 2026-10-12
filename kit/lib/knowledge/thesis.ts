// The thesis (PRD 1726): `<paths.knowledge>/product/thesis.md`, the one page a newcomer reads first.
// It holds no parsed entry: four sections of plain words — who it is for, what it promises, the laws,
// what it refuses. Its laws section is a pointer, one line per locked law,
// `<id> — <plain sentence>. If broken: <what breaks, for whom>.`; the entry in its register holds the
// law. This module reads that section and grades it against the locks; `omni kb show briefing` prints
// it, `omni kb laws` takes each law's plain sentence from it, `omni check knowledge` grades it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ID_SHAPE, isLaw, productDir, type KnowledgeCtx, type KnowledgeEntry } from './registers.ts';

/** The thesis's file name, inside the product register folder. */
const THESIS_FILE = 'thesis.md';

/** The heading of the thesis's laws section, matched without regard to case. */
const LAWS_HEADING = /^##\s+the laws\s*$/i;
const ANY_H2 = /^##\s/;

/** A line of the laws section that names a law: an optional bullet, an id, a dash, its sentence. */
const LAW_LINE = /^(?:[-*]\s+)?`?([A-Z0-9-]+)`?\s+[—–-]\s+(.+)$/;

/** What a reader of a thesis needs to know of one law line: the id it names and its plain words. */
export type ThesisLaw = { id: string; sentence: string; line: string };

/** A thesis, read: its file, its laws section's text (`null` when it has none), and each law line. */
export type Thesis = { file: string; lawsSection: string | null; laws: ThesisLaw[] };

/** Where the thesis sits: `<knowledge>/product/thesis.md`. */
export function thesisPath(ctx: { layout: { knowledgeRoot: string } }): string {
  return `${productDir(ctx)}/${THESIS_FILE}`;
}

/** The laws section of a thesis's text, and each line in it that names an id. */
export function parseThesis(file: string, text: string): Thesis {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => LAWS_HEADING.test(line.trim()));
  if (start === -1) return { file, lawsSection: null, laws: [] };
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => ANY_H2.test(line));
  const body = end === -1 ? rest : rest.slice(0, end);
  const laws = body.flatMap((raw): ThesisLaw[] => {
    const line = raw.trim();
    const match = LAW_LINE.exec(line);
    const id = match?.[1];
    const sentence = match?.[2];
    if (id === undefined || sentence === undefined || !ID_SHAPE.test(id)) return [];
    return [{ id, sentence: sentence.trim(), line }];
  });
  return { file, lawsSection: body.join('\n').trim(), laws };
}

/** The repository's thesis, or `null` when it has none. */
export function readThesis(ctx: KnowledgeCtx): Thesis | null {
  const file = thesisPath(ctx);
  const absolute = join(ctx.root, file);
  if (!existsSync(absolute)) return null;
  return parseThesis(file, readFileSync(absolute, 'utf8'));
}

/**
 * What is wrong with a thesis against the locks, one plain sentence each: a law line naming an id that
 * is not locked, a locked law it misses, a law line without its `If broken:`, and — once a law is
 * locked — no thesis, or no laws section, to tell a newcomer about it.
 */
export function thesisProblems(thesis: Thesis | null, entries: readonly KnowledgeEntry[], expected: string): string[] {
  const locked = entries.filter(isLaw);
  if (thesis === null) {
    if (locked.length === 0) return [];
    return [`${expected}: is missing, and ${locked.map(({ id }) => id).join(', ')} ${locked.length === 1 ? 'is' : 'are'} locked — write the thesis, with one line per law in its "## The laws" section.`];
  }
  if (thesis.lawsSection === null) {
    if (locked.length === 0) return [];
    return [`${thesis.file}: has no "## The laws" section, and ${locked.map(({ id }) => id).join(', ')} ${locked.length === 1 ? 'is' : 'are'} locked — add the section, one line per law.`];
  }
  const named = new Set(thesis.laws.map(({ id }) => id));
  const lockedIds = new Set(locked.map(({ id }) => id));
  return [
    ...thesis.laws
      .filter(({ id }) => !lockedIds.has(id))
      .map(({ id }) => `${thesis.file}: ${id} — is listed under "The laws", but it is not a locked law — remove the line, or have a person lock the entry.`),
    ...locked
      .filter(({ id }) => !named.has(id))
      .map(({ id }) => `${thesis.file}: ${id} — is a locked law, but "The laws" does not list it — add "${id} — <plain sentence>. If broken: <what breaks, for whom>."`),
    ...thesis.laws
      .filter(({ id, sentence }) => lockedIds.has(id) && !/\bIf broken:/.test(sentence))
      .map(({ id }) => `${thesis.file}: ${id} — its line says no "If broken:" — say what breaks, and for whom.`),
  ];
}
