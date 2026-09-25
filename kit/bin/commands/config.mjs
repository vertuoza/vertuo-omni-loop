// `omni config [key.path]` — the resolved config as JSON, or one value (a string printed bare).
import { parseArgs, println, usageError } from '../args.mjs';

export const config = {
  async run(args, { ctx, stdout }) {
    const { positional } = parseArgs('config', args);
    if (positional.length > 1) throw usageError('usage: omni config [key.path]');
    const [key] = positional;
    let value = ctx.config;
    if (key) {
      for (const part of key.split('.')) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
          throw usageError(`omni config: no key ${key}.`);
        }
        value = value[part];
      }
    }
    println(stdout, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    return 0;
  },
};
