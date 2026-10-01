// @ts-nocheck
// `omni prd <n>` — where PRD <n> lives today, as text: the one lookup an agent runs before following
// any delivery path.
import { whereIs } from '../../lib/delivery/prd.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';

export const prd = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional } = parseArgs('prd', args);
    if (positional.length !== 1) throw usageError('usage: omni prd <n>');
    const number = positiveInt('prd', '<n>', positional[0]);
    const where = whereIs(ctx, number);
    if (!where) {
      println(stderr, `omni prd: PRD ${number} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}.`);
      return 1;
    }
    const lines = [
      `PRD ${where.prd} — ${where.name}`,
      `state: ${where.state}`,
      `dir: ${where.dir}`,
      'files:',
      ...where.files.map((file) => `  - ${file}`),
      `outbox: ${where.outboxDir ?? 'none'}`,
      `open items: ${where.openItems.length === 0 ? 'none' : ''}`.trimEnd(),
      ...where.openItems.map((file) => `  - ${file}`),
      ...(where.repos.length === 0 ? [] : [`repos: ${where.repos.join(', ')}`]),
    ];
    println(stdout, lines.join('\n'));
    return 0;
  },
};
