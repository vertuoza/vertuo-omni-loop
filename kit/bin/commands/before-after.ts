// `omni before-after new <n> --services <name>,<name>… [--force]` (PRD 2239, s2) — writes PRD n's
// `before-after.html` into its inbox folder from the kit's skeleton (`kit/templates/before-after/page.html`):
// the head and its version 3 meta, the styles, the three tabs (Functional, Technical, Pixel perfect,
// PRD 2850), the one Pixel perfect section of the page, and for each named service its blocks with
// every section a `<!-- FILL -->`. It prints `wrote <path>`, exit 0. It refuses, writing nothing, with one line
// on stderr and exit 1: a PRD with no inbox folder, a page already there (unless `--force`), and a
// missing or empty `--services`. A usage mistake (a missing or unknown verb, a bad number) exits 2.
//
// `omni before-after render <n>` (PRD 2239, s3) — replaces each `<pre class="mermaid">` of the page with the
// SVG Mermaid draws, through the repository's Playwright or, when it has none, the one the kit fetches into its
// cache (`../../lib/before-after/render.ts`, #3315). It prints `rendered <section> of <service>` per diagram,
// exit 0. With no browser it prints why on stderr, exit 1, the page untouched; a diagram Mermaid refuses is named on stderr, exit 1, the others still drawn.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type RenderLaunch, renderDiagrams, repositoryLaunch } from '../../lib/before-after/render.ts';
import { beforeAfterSkeleton, parseServices } from '../../lib/before-after/skeleton.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { kitTemplate } from '../../lib/playbook/templates.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';

const USAGE = 'usage: omni before-after new <n> --services <name>,<name>… [--force] | omni before-after render <n>';
const TEMPLATE = 'before-after/page.html';

/** The arguments with a `--services` that has no value given an empty one, so that it is refused as an empty list (exit 1), not as a usage mistake. */
function withServicesValue(args: readonly string[]): string[] {
  return args.flatMap((arg, index) => {
    const next = args[index + 1];
    return arg === '--services' && (next === undefined || next.startsWith('--')) ? [arg, ''] : [arg];
  });
}

/** How `omni before-after <verb>` refuses, and the PRD's page when the PRD has an inbox folder (else null). */
function pageOf(verb: string, prd: PrdNumber, { ctx, stderr }: Pick<CommandIo, 'ctx' | 'stderr'>): { refuse: (why: string) => number; path: string | null } {
  const refuse = (why: string): number => {
    println(stderr, `omni before-after ${verb}: ${why}`);
    return 1;
  };
  const where = ctx.layout.whereIs(prd);
  return { refuse, path: where?.state === 'inbox' ? ctx.layout.beforeAfterPath(prd) : null };
}

/** `omni before-after new`: the exit code. */
function writePage(args: string[], { ctx, stdout, stderr }: CommandIo): number {
  const { positional, flags } = parseArgs('before-after new', withServicesValue(args), { values: ['services'], booleans: ['force'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('before-after new', '<n>', positional[0]);
  const { refuse, path } = pageOf('new', prd, { ctx, stderr });
  if (path === null) return refuse(`PRD ${prd} has no inbox folder.`);
  const named = parseServices(flags.services);
  if ('refusal' in named) return refuse(named.refusal);
  if (existsSync(join(ctx.root, path)) && flags.force !== true) return refuse(`${path} already exists: pass --force to replace it.`);
  writeFileSync(join(ctx.root, path), beforeAfterSkeleton({ template: kitTemplate(TEMPLATE), prd, services: named.services }));
  println(stdout, `wrote ${path}`);
  return 0;
}

/** `omni before-after render`: the exit code. `launch` is the browser, the repository's Playwright or the kit's when not given. */
export async function renderPage(prd: PrdNumber, { ctx, stdout, stderr }: CommandIo, launch?: RenderLaunch): Promise<number> {
  const { refuse, path } = pageOf('render', prd, { ctx, stderr });
  if (path === null) return refuse(`PRD ${prd} has no inbox folder.`);
  if (!existsSync(join(ctx.root, path))) return refuse(`${path} does not exist: write it with omni before-after new ${prd}.`);
  const html = readFileSync(join(ctx.root, path), 'utf8');
  const result = await renderDiagrams({ html, launch: launch ?? repositoryLaunch(ctx.root) });
  if (result.kind === 'unavailable') return refuse(`cannot render the diagrams: ${result.why}`);
  if (result.html !== html) writeFileSync(join(ctx.root, path), result.html);
  for (const place of result.drawn) println(stdout, `rendered ${place}`);
  for (const { place, reason } of result.refused) println(stderr, `omni before-after render: ${place}: ${reason}`);
  if (result.drawn.length + result.refused.length === 0) println(stdout, 'no diagrams to render');
  return result.refused.length === 0 ? 0 : 1;
}

async function renderVerb(args: string[], io: CommandIo): Promise<number> {
  const { positional } = parseArgs('before-after render', args, {});
  if (positional.length !== 1) throw usageError(USAGE);
  return await renderPage(prdArg('before-after render', '<n>', positional[0]), io);
}

export const beforeAfter: Command = {
  async run(args: string[], io: CommandIo): Promise<number> {
    const [verb, ...rest] = args;
    if (verb === 'new') return writePage(rest, io);
    if (verb === 'render') return await renderVerb(rest, io);
    throw usageError(USAGE);
  },
};
