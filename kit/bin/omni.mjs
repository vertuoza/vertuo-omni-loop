#!/usr/bin/env node
// omni — the kit's one entry point. Installed into a repository as .omni-loop/bin/omni.mjs (bundled),
// called by the skills and by the outbox workflow. Exit 0 ok, 1 red, 2 usage or configuration.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ConfigError } from '../lib/config.mjs';
import { loadContext } from '../lib/context.mjs';
import { COMMAND_TABLE } from './commands/index.mjs';

const USAGE = `usage: omni <command> [args]\ncommands: ${Object.keys(COMMAND_TABLE).join(', ')}\nomni help: what each command does\n`;
// `omni --help` and `omni -h` are `omni help`; `omni --version` is `omni version`.
const HELP_FLAGS = ['--help', '-h'];
const VERSION_FLAG = '--version';

export async function main(
  argv,
  { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, exec = execFileSync, env = process.env, ...more } = {},
) {
  const [first, ...rest] = argv;
  const name = HELP_FLAGS.includes(first) ? 'help' : first === VERSION_FLAG ? 'version' : first;
  const command = Object.hasOwn(COMMAND_TABLE, name ?? '') ? COMMAND_TABLE[name] : undefined;
  if (!command) {
    stderr.write(USAGE);
    return 2;
  }
  try {
    // `init` runs before a config exists: it finds the root itself. `more` is its injected stdin,
    // bundle and prompt; an option left out keeps the command's own default.
    if (command.withoutContext) return await command.run(rest, { cwd, stdout, stderr, exec, env, ...more });
    const ctx = loadContext(cwd, { exec });
    return await command.run(rest, { ctx, stdout, stderr, exec, env });
  } catch (error) {
    if (error instanceof ConfigError || error?.name === 'ConfigError' || error?.name === 'UsageError') {
      stderr.write(`${error.message.split('\n')[0]}\n`);
      return 2;
    }
    throw error;
  }
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exit(1);
  });
}
