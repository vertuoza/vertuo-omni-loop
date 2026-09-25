// `omni knowledge <id>` — one entry of the knowledge folder and every entry that serves it.
// Ported from vertuo-ai-domain@c4a210122:scripts/knowledge.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { describeEntry } from '../../lib/knowledge/describe.mjs';
import { readKnowledge } from '../../lib/knowledge/registers.mjs';
import { parseArgs, println, usageError } from '../args.mjs';

export const knowledge = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional } = parseArgs('knowledge', args);
    if (positional.length !== 1) throw usageError('usage: omni knowledge <id>   e.g. omni knowledge P-PRODUCT-1');
    const [id] = positional;
    const text = describeEntry(readKnowledge({ ctx }), id);
    if (text === null) {
      println(stderr, `omni knowledge: nothing in ${ctx.layout.knowledgeRoot}/ claims ${id}.`);
      return 1;
    }
    println(stdout, text);
    return 0;
  },
};
