// `omni sign trailer | footer` — prints the line the loop signs its work with (PRD #99), so no skill
// spells a name or an address: `trailer` ends every commit a skill makes, `footer` every pull
// request and issue a skill opens. With `signature: null` it prints nothing and exits 0, so a skill
// runs unchanged when signing is off.
import { footerLine, trailerLine } from '../../lib/signature.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni sign trailer|footer';
const LINES = { trailer: trailerLine, footer: footerLine };

export const sign: Command = {
  run: synchronous((args: string[], { ctx, stdout }: CommandIo): number => {
    const { positional } = parseArgs('sign', args);
    const [which = ''] = positional;
    if (positional.length !== 1 || (which !== 'trailer' && which !== 'footer')) throw usageError(USAGE);
    const line = LINES[which](ctx.config.signature);
    if (line !== null) println(stdout, line);
    return 0;
  }),
};
