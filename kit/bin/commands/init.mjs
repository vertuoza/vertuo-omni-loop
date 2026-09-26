// `omni init [--force] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]` — installs the
// loop on the repository it runs in: writes `.omni-loop/config.yml`, copies the running bundle to
// `.omni-loop/bin/omni.mjs`, lays down the blank knowledge forms as `omni kb init` does, creates the
// loop labels the repository lacks, then prints the closing steps a person still has to take, with a
// heads-up for an older copy of the loop or a formatter that would reject the bin. The one command
// that runs before a config exists, so `main()` hands it no context. It writes nothing outside
// `.omni-loop/`.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join, posix } from 'node:path';
import { parseArgs, usageError } from '../args.mjs';
import { CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig } from '../../lib/config.mjs';
import { createContext } from '../../lib/context.mjs';
import { installCommand, kitHome, runningBundle } from '../../lib/init/bundle.mjs';
import { renderConfig } from '../../lib/init/config-text.mjs';
import { COMMAND_KEYS, detectCommands, detectLawsSource } from '../../lib/init/detect.mjs';
import { reconcileLabels } from '../../lib/init/labels.mjs';
import { formatterToExclude, legacyLoopWorkflows } from '../../lib/init/notices.mjs';
import { closingSteps } from '../../lib/init/steps.mjs';
import { findRoot, readRepo } from '../../lib/init/repo.mjs';
import { writeForms } from '../../lib/playbook/write-forms.mjs';

const LOOP_DIR = dirname(CONFIG_FILE);
export const BIN_FILE = join(LOOP_DIR, 'bin', 'omni.mjs');

/** Whether `path` is the loop's folder or lies under it, however it is spelled. */
function insideLoop(path) {
  const clean = posix.normalize(path).replace(/\/+$/, '');
  return clean === LOOP_DIR || clean.startsWith(`${LOOP_DIR}/`);
}

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
    let config = keepConfig ? parseConfig(readFileSync(configPath, 'utf8'), CONFIG_FILE) : null;
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
      const lawsSource = detectLawsSource({ ctx: createContext(root, defaults) });
      const rendered = renderConfig({ ...repo, commands, lawsSource });
      config = rendered.config;
      const { text } = rendered;
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, text);
    }
    if (copyBin) {
      mkdirSync(dirname(binPath), { recursive: true });
      copyFileSync(bundle, binPath);
      chmodSync(binPath, 0o755);
    }

    // Then the forms, by the same writer as `omni kb init`: never over a file that exists, and never
    // outside `.omni-loop/` — a kept config may keep the playbook elsewhere, and /omni:terraform
    // (which runs `omni kb init`) writes them there.
    const ctx = createContext(root, config);
    const outside = !insideLoop(ctx.layout.frontDoor);
    const forms = outside ? [] : writeForms({ ctx });

    // Last: the files are the install, the labels a convenience — a label gh cannot make is a human step.
    const labels = reconcileLabels(root, { exec, labels: config.labels });

    // A kept config may leave the slug to the origin remote, as every other command does at load time.
    const slug = config.repo.slug ?? readRepo(root, { exec, remote: config.repo.remote }).slug;
    stdout.write(closingSteps({
      slug,
      defaultBranch: config.repo.defaultBranch,
      kitHome: kitHome({ exec }),
      outboxCheck: config.ci.outboxContext,
      files: [{ path: CONFIG_FILE, wrote: !keepConfig }, { path: BIN_FILE, wrote: copyBin }],
      forms: { dir: ctx.layout.frontDoor, wrote: forms.filter((file) => file.wrote).map((file) => file.path), outside },
      labels,
      unfilled: COMMAND_KEYS.filter((key) => config.commands[key] === null).map((key) => ({ key, flag: FLAGS[key] })),
      notices: { legacyWorkflows: legacyLoopWorkflows(root), formatter: formatterToExclude(root, LOOP_DIR) },
    }));
    return 0;
  },
};
