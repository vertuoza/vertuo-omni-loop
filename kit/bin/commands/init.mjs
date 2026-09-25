// `omni init [--force] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]` — installs the
// loop on the repository it runs in: writes `.omni-loop/config.yml` and copies the running bundle to
// `.omni-loop/bin/omni.mjs`. The one command that runs before a config exists, so `main()` hands it
// no context. It writes nothing outside `.omni-loop/`.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { parseArgs, println, usageError } from '../args.mjs';
import { CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig } from '../../lib/config.mjs';
import { installCommand, kitHome, runningBundle } from '../../lib/init/bundle.mjs';
import { renderConfig } from '../../lib/init/config-text.mjs';
import { COMMAND_KEYS, detectCommands, detectLawsSource } from '../../lib/init/detect.mjs';
import { findRoot, readRepo } from '../../lib/init/repo.mjs';

export const BIN_FILE = join(dirname(CONFIG_FILE), 'bin', 'omni.mjs');

const FLAGS = { test: 'test', preflight: 'preflight', preflightFull: 'preflight-full' };
const QUESTIONS = {
  test: 'the command that runs the tests',
  preflight: 'the command a slice must pass before its sub-PR is ready',
  preflightFull: 'the full preflight, run before a feature PR is ready',
};

async function askTerminal(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

/** Detection, then flags, then — on a terminal — one question per command still unknown, else null. */
async function resolveCommands(root, flags, { interactive, ask }) {
  const commands = detectCommands(root);
  for (const key of COMMAND_KEYS) {
    if (typeof flags[FLAGS[key]] === 'string') commands[key] = flags[FLAGS[key]];
  }
  if (interactive) {
    for (const key of COMMAND_KEYS) {
      if (commands[key] !== null) continue;
      const answer = String((await ask(`commands.${key}: ${QUESTIONS[key]} (empty for none): `)) ?? '').trim();
      commands[key] = answer || null;
    }
  }
  return commands;
}

export const init = {
  withoutContext: true,
  async run(args, { cwd, stdout, exec, stdin = process.stdin, bundle = runningBundle(), ask = askTerminal }) {
    const { positional, flags } = parseArgs('init', args, { values: Object.values(FLAGS), booleans: ['force'] });
    if (positional.length) throw usageError('usage: omni init [--force] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]');
    const force = flags.force === true;
    const root = findRoot(cwd, exec);
    const defaults = ConfigSchema.parse({ kit: CONFIG_VERSION });
    const configPath = join(root, CONFIG_FILE);
    const binPath = join(root, BIN_FILE);

    // Everything that can refuse runs before anything is written.
    const keepConfig = !force && existsSync(configPath);
    if (keepConfig) parseConfig(readFileSync(configPath, 'utf8'), CONFIG_FILE);
    const copyBin = force || !existsSync(binPath);
    if (copyBin && !bundle) {
      throw usageError(
        `omni init: this omni runs from the kit source, which is never installed as ${BIN_FILE}; run \`${installCommand(kitHome({ exec }))}\` instead.`,
      );
    }

    if (!keepConfig) {
      const interactive = Boolean(stdin?.isTTY && stdout?.isTTY);
      const commands = await resolveCommands(root, flags, { interactive, ask });
      const repo = readRepo(root, { exec, remote: defaults.repo.remote });
      const lawsSource = detectLawsSource(root, { knowledge: defaults.paths.knowledge, heading: defaults.laws.claudeMdHeading });
      const { text } = renderConfig({ ...repo, commands, lawsSource });
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, text);
    }
    if (copyBin) {
      mkdirSync(dirname(binPath), { recursive: true });
      copyFileSync(bundle, binPath);
      chmodSync(binPath, 0o755);
    }

    println(stdout, `  ${keepConfig ? 'kept ' : 'wrote'}   ${CONFIG_FILE}${keepConfig ? '    (pass --force to overwrite)' : ''}`);
    println(stdout, `  ${copyBin ? 'wrote' : 'kept '}   ${BIN_FILE}${copyBin ? '' : '  (pass --force to overwrite)'}`);
    return 0;
  },
};
