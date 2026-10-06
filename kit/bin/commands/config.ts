// `omni config [key.path]` — the resolved config as JSON, or one value (a string printed bare).
import { propertyOf } from '../../lib/narrow.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

export const config: Command = {
  run: synchronous((args: string[], { ctx, stdout }: CommandIo): number => {
    const { positional } = parseArgs('config', args);
    if (positional.length > 1) throw usageError('usage: omni config [key.path]');
    const [key] = positional;
    let value: unknown = ctx.config;
    if (key) {
      for (const part of key.split('.')) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
          throw usageError(`omni config: no key ${key}.`);
        }
        value = propertyOf(value, part);
      }
    }
    println(stdout, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    return 0;
  }),
};
