/**
 * **A markdown body is read**: its `## ` sections, and the first table among some lines, shared by
 * the parsers of a concept (`concept/parse.ts`) and a roadmap (`roadmap/parse.ts`). Pure: text in,
 * sections and cells out.
 */
import { group } from './narrow.ts';

/** One `## ` section: its heading's text and the lines under it. */
export type MarkdownSection = { name: string; lines: string[] };

/** A table's header cells and its rows' cells, the separator row left out. */
export type MarkdownTable = { header: string[]; rows: string[][] };

const SEPARATOR_ROW = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/;

/** The body's `## ` sections, in the order written; a `# ` heading ends one. */
export function sectionsOf(body: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && !line.startsWith('###')) {
      current = { name: group(heading, 1), lines: [] }; // group 1 always matches
      sections.push(current);
    } else if (/^#\s/.test(line)) {
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

/** A table row's cells, trimmed; a `\|` is a pipe inside a cell. */
function cells(line: string): string[] {
  let inner = line.trim();
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|') && !inner.endsWith('\\|')) inner = inner.slice(0, -1);
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/** The first table among `lines`: its header's cells and its rows' cells, or `null` with none. */
export function firstTable(lines: readonly string[]): MarkdownTable | null {
  const start = lines.findIndex((line) => line.trim().startsWith('|'));
  if (start === -1) return null;
  const block: string[] = [];
  for (const line of lines.slice(start)) {
    if (!line.trim().startsWith('|')) break;
    block.push(line.trim());
  }
  const [header = '', ...rest] = block; // the line at `start` opens the block
  return { header: cells(header), rows: rest.filter((line) => !SEPARATOR_ROW.test(line)).map(cells) };
}
