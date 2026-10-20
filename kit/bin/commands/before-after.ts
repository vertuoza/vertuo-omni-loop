// `omni before-after new <n> --services <name>,<name>… [--force]` (PRD 2239, s2) — writes PRD n's
// `before-after.html` into its inbox folder from the kit's skeleton (`kit/templates/before-after/page.html`):
// the head and its meta, the styles, the two tabs, and for each named service its blocks with every
// section a `<!-- FILL -->`. It prints `wrote <path>`, exit 0. It refuses, writing nothing, with one line
// on stderr and exit 1: a PRD with no inbox folder, a page already there (unless `--force`), and a
// missing or empty `--services`. A usage mistake (a missing or unknown verb, a bad number) exits 2.
//
// `omni before-after render <n>` (the diagrams) is the next slice's: it names itself and exits 1 until then.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAfterSkeleton, parseServices } from '../../lib/before-after/skeleton.ts';
import { kitTemplate } from '../../lib/playbook/templates.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni before-after new <n> --services <name>,<name>… [--force] | omni before-after render <n>';
const TEMPLATE = 'before-after/page.html';

/** The arguments with a `--services` that has no value given an empty one, so that it is refused as an empty list (exit 1), not as a usage mistake. */
function withServicesValue(args: readonly string[]): string[] {
  return args.flatMap((arg, index) => {
    const next = args[index + 1];
    return arg === '--services' && (next === undefined || next.startsWith('--')) ? [arg, ''] : [arg];
  });
}

/** `omni before-after new`: the exit code. */
function writePage(args: string[], { ctx, stdout, stderr }: CommandIo): number {
  const { positional, flags } = parseArgs('before-after new', withServicesValue(args), { values: ['services'], booleans: ['force'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('before-after new', '<n>', positional[0]);
  const refuse = (why: string): number => {
    println(stderr, `omni before-after new: ${why}`);
    return 1;
  };
  const where = ctx.layout.whereIs(prd);
  const path = where?.state === 'inbox' ? ctx.layout.beforeAfterPath(prd) : null;
  if (path === null) return refuse(`PRD ${prd} has no inbox folder.`);
  const named = parseServices(flags.services);
  if ('refusal' in named) return refuse(named.refusal);
  if (existsSync(join(ctx.root, path)) && flags.force !== true) return refuse(`${path} already exists: pass --force to replace it.`);
  writeFileSync(join(ctx.root, path), beforeAfterSkeleton({ template: kitTemplate(TEMPLATE), prd, services: named.services }));
  println(stdout, `wrote ${path}`);
  return 0;
}

export const beforeAfter: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [verb, ...rest] = args;
    if (verb === 'new') return writePage(rest, io);
    if (verb === 'render') {
      println(io.stderr, 'omni before-after render: not available in this version of the kit.');
      return 1;
    }
    throw usageError(USAGE);
  }),
};
