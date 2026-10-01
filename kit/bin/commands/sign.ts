// @ts-nocheck
// `omni sign trailer | footer` — prints the line the loop signs its work with (PRD #99), so no skill
// spells a name or an address: `trailer` ends every commit a skill makes, `footer` every pull
// request and issue a skill opens. With `signature: null` it prints nothing and exits 0, so a skill
// runs unchanged when signing is off.
import { footerLine, trailerLine } from '../../lib/signature.ts';
import { parseArgs, println, usageError } from '../args.ts';

const USAGE = 'usage: omni sign trailer|footer';
const LINES = { trailer: trailerLine, footer: footerLine };

export const sign = {
  async run(args, { ctx, stdout }) {
    const { positional } = parseArgs('sign', args);
    if (positional.length !== 1 || !Object.hasOwn(LINES, positional[0])) throw usageError(USAGE);
    const line = LINES[positional[0]](ctx.config.signature);
    if (line !== null) println(stdout, line);
    return 0;
  },
};
