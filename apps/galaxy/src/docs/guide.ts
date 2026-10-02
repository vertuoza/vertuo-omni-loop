import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { defined, group } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { fenceProblem } from './badges';
import { diagramsNamed, svgProblem } from './diagrams';
import { pageUrl } from './paths';

// The guide's markdown, read from the folder (PRD 346): docs/guide/*.md, one file per page, and
// meta.json, the order the sidebar shows them in. The docs guard (guide.test.ts) runs guideProblems on
// it: a page with no title, a Next link to no page, a /omni:<skill> the plugin does not have, or an
// `omni <command>` the CLI does not have, or a code block that does not say where it goes (PRD 373:
// its fence words, badges.ts), is a problem; so is, since PRD 420, a TERMINAL block of more than one
// line on the install page, or a page other than troubleshooting that still names the old
// ~/.local/bin/omni wrapper; and a diagram (diagrams.ts) that is no file of the guide, has no alt
// text, does not stand alone on its line, or does not read. Nothing here renders: fumadocs does
// (source.ts), from the same files.

/** One page of the guide, as its file says. */
export interface GuidePage {
  /** The file's name without `.md`: `index`, `install`… */
  slug: string;
  /** Its frontmatter's title, or null when it has none. */
  title: string | null;
  /** Where its "Next →" link points, or null when it has none. */
  next: string | null;
  /** The markdown after the frontmatter. */
  body: string;
  /** The line of the file the body starts on: 1 when the page has no frontmatter. */
  bodyLine: number;
}

/** The guide: its pages as the order file lists them, then any page it leaves out. */
export interface Guide {
  /** meta.json's `pages`, as written. */
  order: string[];
  pages: GuidePage[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const NEXT = /\[Next →[^\]]*\]\(([^)\s]+)\)/;

/** One page's markdown, read into its title, its Next link and its body. */
export function parsePage(slug: string, markdown: string): GuidePage {
  const front = FRONTMATTER.exec(markdown);
  const titleLine = front ? /^title:\s*(.+?)\s*$/m.exec(group(front, 1)) : null;
  const title = titleLine ? group(titleLine, 1).replace(/^(['"])(.*)\1$/, '$2') : null;
  const body = front ? markdown.slice(front[0].length) : markdown;
  const bodyLine = (front?.[0].match(/\n/g)?.length ?? 0) + 1;
  return { slug, title: title || null, next: NEXT.exec(body)?.[1] ?? null, body, bodyLine };
}

/** A fenced code block's opening fence: the line it is on (1 = the markdown's first), the words
 * after its language, and how many lines of code it holds. A fence may be indented, inside a list,
 * and hold shorter fences. */
export interface Fence {
  line: number;
  meta: string;
  lines: number;
}

/** A fence line's marker and the words after it; null on any other line. */
function fenceOf(text: string): { marker: string; info: string } | null {
  const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(text);
  return fence ? { marker: group(fence, 1), info: group(fence, 2) } : null;
}

/** Every fenced code block a page's markdown opens. */
export function fences(markdown: string): Fence[] {
  const found: Fence[] = [];
  let open: { marker: string; length: number; fence: Fence } | null = null;
  markdown.split('\n').forEach((text, i) => {
    const fence = fenceOf(text);
    if (open && !(fence && fence.marker.charAt(0) === open.marker && fence.marker.length >= open.length && !fence.info.trim())) {
      open.fence.lines += 1;
      return;
    }
    if (!fence) return;
    if (open) {
      open = null;
      return;
    }
    const { marker, info } = fence;
    const opened: Fence = { line: i + 1, meta: info.trim().split(/\s+/).slice(1).join(' '), lines: 0 };
    open = { marker: marker.charAt(0), length: marker.length, fence: opened };
    found.push(opened);
  });
  return found;
}

/** The order file, meta.json: the guide's pages by slug, in order; none when it names none. */
const GuideMeta = z.object({ pages: z.array(z.string()).optional() });

/** meta.json's pages; throws, naming the field, when it is not an object with a list of slugs. */
function readOrder(metaFile: string): string[] {
  const parsed = GuideMeta.safeParse(JSON.parse(readFileSync(metaFile, 'utf8')));
  if (parsed.success) return parsed.data.pages ?? [];
  const issue = defined(parsed.error.issues[0], 'the failed parse\'s first issue');
  throw new Error(`${metaFile}: ${issue.path.join('.') || 'the file'}: ${issue.message}`);
}

/** The guide in `dir`: its order file and every page. */
export function readGuide(dir: string): Guide {
  const metaFile = join(dir, 'meta.json');
  const order = existsSync(metaFile) ? readOrder(metaFile) : [];
  const slugs = readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -'.md'.length));
  const sorted = [...order.filter((slug) => slugs.includes(slug)), ...slugs.filter((slug) => !order.includes(slug)).sort()];
  return { order, pages: sorted.map((slug) => parsePage(slug, readFileSync(join(dir, `${slug}.md`), 'utf8'))) };
}

/** The code a page shows: its fenced blocks and its inline code spans. */
function code(markdown: string): string[] {
  const fenced = [...markdown.matchAll(/^(```|~~~)[^\n]*\n([\s\S]*?)^\1/gm)].map((m) => group(m, 2));
  const prose = markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1/gm, '');
  return [...fenced, ...[...prose.matchAll(/`([^`\n]+)`/g)].map((m) => group(m, 1))];
}

/** Every `/omni:<skill>` a page names, anywhere in it. */
export const skillsNamed = (markdown: string) => [...new Set([...markdown.matchAll(/\/omni:([a-z][a-z0-9-]*)/g)].map((m) => group(m, 1)))];

/** Every `omni <command>` a page shows as code: the words that follow `omni` at a command's start. */
export const commandsNamed = (markdown: string) =>
  [...new Set(code(markdown).flatMap((text) => [...text.matchAll(/(?:^|[\s;&|(])omni ([a-z][a-z0-9-]*)/gm)].map((m) => m[1])))];

/** Where the plugin's skills and the CLI's commands live, in the kit. */
export interface Kit {
  skills: string;
  commands: string;
}

/** The page whose TERMINAL blocks must each be one line (PRD 420): a newcomer pastes them one by one. */
const ONE_LINE_PAGE = 'install';
/** The PATH wrapper PRD 373 had people write, which the global `omni` replaced (PRD 420): only the
 * troubleshooting page names it, to say how to remove it. */
const OLD_WRAPPER = '~/.local/bin/omni';
const OLD_WRAPPER_PAGE = 'troubleshooting';

/** Everything wrong with the guide in `dir`, one line each; empty when the guide holds. */
export function guideProblems(dir: string, kit: Kit): string[] {
  const { order, pages } = readGuide(dir);
  const urls = new Set(pages.map((page) => pageUrl(page.slug)));
  const problems: string[] = [];
  for (const slug of order) if (!pages.some((page) => page.slug === slug)) problems.push(`meta.json: lists ${slug}, which has no ${slug}.md`);
  for (const page of pages) {
    const where = `${page.slug}.md`;
    if (!order.includes(page.slug)) problems.push(`${where}: not in meta.json`);
    if (!page.title) problems.push(`${where}: no title`);
    if (!page.next) problems.push(`${where}: no Next → link`);
    else if (!urls.has(page.next) || page.next === pageUrl(page.slug)) problems.push(`${where}: Next → ${page.next} is no other page of the guide`);
    for (const skill of skillsNamed(page.body)) {
      if (!existsSync(join(kit.skills, skill))) problems.push(`${where}: /omni:${skill} is no skill of the plugin`);
    }
    for (const fence of fences(page.body)) {
      const problem = fenceProblem(fence.meta);
      if (problem) problems.push(`${where}:${page.bodyLine + fence.line - 1}: the code block ${problem}`);
      else if (page.slug === ONE_LINE_PAGE && fence.lines > 1 && fence.meta.split(/\s+/).includes('terminal')) {
        problems.push(`${where}:${page.bodyLine + fence.line - 1}: the TERMINAL block is ${fence.lines} lines: every one on the install page is one line`);
      }
    }
    for (const diagram of diagramsNamed(page.body)) {
      const at = `${where}:${page.bodyLine + diagram.line - 1}: the diagram ${diagram.src}`;
      if (!diagram.alone) problems.push(`${at} does not stand alone on its line`);
      if (!diagram.alt.trim()) problems.push(`${at} has no alt text`);
      const file = join(dir, diagram.src);
      if (!existsSync(file)) problems.push(`${at} is no file of the guide`);
      else {
        const problem = svgProblem(readFileSync(file, 'utf8'));
        if (problem) problems.push(`${at} does not read: ${problem}`);
      }
    }
    if (page.slug !== OLD_WRAPPER_PAGE && page.body.includes(OLD_WRAPPER)) problems.push(`${where}: names ${OLD_WRAPPER}, the old PATH wrapper: only troubleshooting may`);
    for (const command of commandsNamed(page.body)) {
      if (!existsSync(join(kit.commands, `${command}.ts`))) problems.push(`${where}: omni ${command} is no command of the CLI`);
    }
  }
  return problems;
}
