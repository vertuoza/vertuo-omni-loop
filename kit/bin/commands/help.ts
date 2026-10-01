// @ts-nocheck
// `omni help [<name>]` — the loop and every command on one screen, or one command or skill
// (`kit/lib/help/`). Help is most needed before anything is set up, so it runs without a context,
// like `init`: it reads the repository's config when there is one, and the kit's defaults when it
// does not load. Exit 0, or 2 for a name it does not know.
import { CONFIG_VERSION, ConfigError, ConfigSchema } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { renderEntry, renderOverview } from '../../lib/help/render.ts';
import { parseArgs, println, usageError } from '../args.ts';

/** The repository's config, or the kit's defaults where it does not load. */
function configAt(cwd, exec) {
  try {
    return loadContext(cwd, { exec }).config;
  } catch (error) {
    if (error instanceof ConfigError || error?.name === 'ConfigError') return ConfigSchema.parse({ kit: CONFIG_VERSION });
    throw error;
  }
}

export const help = {
  withoutContext: true,
  async run(args, { cwd, stdout, exec }) {
    const { positional } = parseArgs('help', args);
    if (positional.length > 1) throw usageError('usage: omni help [<name>]');
    const config = configAt(cwd, exec);
    if (positional.length === 0) {
      println(stdout, renderOverview(config));
      return 0;
    }
    const [name] = positional;
    const text = renderEntry(name, config);
    if (text === null) throw usageError(`omni help: no command "${name}"; omni help lists them all`);
    println(stdout, text);
    return 0;
  },
};
