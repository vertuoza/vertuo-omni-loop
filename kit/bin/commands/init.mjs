// `omni init [--force] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]` — installs the
// loop on the repository it runs in: writes `.omni-loop/config.yml`, copies the running bundle to
// `.omni-loop/bin/omni.mjs`, lays down the blank knowledge forms as `omni kb init` does, switches on
// the kit's status line in `.claude/settings.json` and creates the loop labels the repository lacks.
// Around those writes it opens the install pull request (PRD 420): it switches to
// `chore/install-omni-loop` first, and afterwards commits only what it wrote, pushes that branch and
// opens (or finds) its pull request. Then it installs the Claude Code plugin on this computer and, on
// a terminal, signs it in to the Omni page. Each step prints one status line, or the exact lines left
// to type when it could not be done, and never makes init fail. Last it prints the closing steps a
// person still has to take — the GitHub App, merging PR #N, /omni:invade — with a heads-up for an
// older copy of the loop or a formatter that would reject the bin. The one command that runs before a
// config exists, so `main()` hands it no context. It writes no file outside `.omni-loop/` but the
// `statusLine` key of `.claude/settings.json` (N-PRODUCT-6).
// A repository already installed on its default branch (PRD 893) skips all of that but this computer:
// no branch switch, no write, no commit, push or pull request, and only the forms left as a step.
// `--force` always runs the full install.
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
import { closingSteps, computerLines, installedHeadline, installedSteps, setupLines } from '../../lib/init/steps.mjs';
import { detectInstall } from '../../lib/init/installed.mjs';
import { installPlugin, pluginLines } from '../../lib/init/plugin.mjs';
import { signInLines, signInStep } from '../../lib/init/signin-step.mjs';
import { installLines, openInstallPr, switchToInstallBranch } from '../../lib/init/install-pr.mjs';
import { findRoot, readRepo } from '../../lib/init/repo.mjs';
import { writeStatusLine } from '../../lib/init/settings.mjs';
import { writeForms } from '../../lib/playbook/write-forms.mjs';
import { signin } from './signin.mjs';

const LOOP_DIR = dirname(CONFIG_FILE);
export const BIN_FILE = join(LOOP_DIR, 'bin', 'omni.mjs');

/** Whether `path` is the loop's folder or lies under it, however it is spelled. */
function insideLoop(path) {
  const clean = posix.normalize(path).replace(/\/+$/, '');
  return clean === LOOP_DIR || clean.startsWith(`${LOOP_DIR}/`);
}

// The status-line outcomes that leave the kit's own line in the settings file (settings.mjs).
const OWN_STATUS_LINE = new Set(['wrote', 'kept']);

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

/** This computer's lines: the plugin, then the sign-in to the Omni page. Neither ever fails init. */
async function thisComputer({ root, config, interactive, stdout, stderr, exec, home, signIn }) {
  const kit = kitHome({ exec });
  const plugin = pluginLines(installPlugin({ exec, kitHome: kit }), { kitHome: kit });
  const signedIn = await signInStep({
    askUrl: config.ask.url,
    home,
    interactive,
    signIn: signIn ?? (async () => {
      let line;
      const code = await signin.run([], { cwd: root, stdout, stderr, exec, home, onSignedIn: (said) => { line = said; } });
      return { code, line };
    }),
  });
  return computerLines(plugin, signInLines(signedIn));
}

export const init = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, stdin = process.stdin, bundle = runningBundle(), ask = askTerminal, home: userHome, signIn }) {
    const { positional, flags } = parseArgs('init', args, { values: Object.values(FLAGS), booleans: ['force'] });
    if (positional.length) throw usageError('usage: omni init [--force] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]');
    const force = flags.force === true;
    const root = findRoot(cwd, exec);
    const defaults = ConfigSchema.parse({ kit: CONFIG_VERSION });
    const configPath = join(root, CONFIG_FILE);
    const binPath = join(root, BIN_FILE);
    const interactive = Boolean(stdin?.isTTY && stdout?.isTTY);
    const computer = (config) => thisComputer({ root, config, interactive, stdout, stderr, exec, home: userHome, signIn });

    // Already installed on the default branch: only this computer's steps, and nothing written.
    const installed = force ? null : detectInstall(root, { exec });
    if (installed) {
      stdout.write(`${installedHeadline(installed.defaultBranch)}\n`);
      const forms = { dir: createContext(root, installed.config).layout.frontDoor };
      stdout.write(`${['', ...(await computer(installed.config)), ...installedSteps({ forms })].join('\n')}\n`);
      return 0;
    }

    // Everything that can refuse runs before anything is written.
    const keepConfig = !force && existsSync(configPath);
    let config = keepConfig ? parseConfig(readFileSync(configPath, 'utf8'), CONFIG_FILE) : null;
    const copyBin = force || !existsSync(binPath);
    if (copyBin && !bundle) {
      throw usageError(
        `omni init: this omni runs from the kit source, which is never installed as ${BIN_FILE}; run \`${installCommand(kitHome({ exec }))}\` instead.`,
      );
    }

    // The install branch comes first, so everything written below lands on it, never on the branch
    // the person was on. A branch git refuses is reported with the install pull request below.
    const branch = switchToInstallBranch(root, { exec });

    if (!keepConfig) {
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
    // outside `.omni-loop/` — a kept config may keep the playbook elsewhere, and /omni:invade
    // (which runs `omni kb init`) writes them there.
    const ctx = createContext(root, config);
    const outside = !insideLoop(ctx.layout.frontDoor);
    const forms = outside ? [] : writeForms({ ctx });

    // Then the status line, the one key init writes outside its folder: it runs the bin just
    // installed, and a line that is not the kit's, or a file that is not JSON, is left as it is.
    const settings = writeStatusLine(root, { bin: BIN_FILE, force });

    // Last: the files are the install, the labels a convenience — a label gh cannot make is a human step.
    const labels = reconcileLabels(root, { exec, labels: config.labels });

    // A kept config may leave the slug to the origin remote, as every other command does at load time.
    const slug = config.repo.slug ?? readRepo(root, { exec, remote: config.repo.remote }).slug;
    const filesWritten = [{ path: CONFIG_FILE, wrote: !keepConfig }, { path: BIN_FILE, wrote: copyBin }];
    const formsDone = { dir: ctx.layout.frontDoor, wrote: forms.filter((file) => file.wrote).map((file) => file.path), outside };
    const out = setupLines({ slug, files: filesWritten, forms: formsDone, settings, labels });

    // Then the install pull request: only init's own paths are committed — the loop's folder, and the
    // settings file while the kit's status line is in it.
    const paths = [LOOP_DIR, ...(OWN_STATUS_LINE.has(settings.outcome) ? [settings.path] : [])];
    const pr = { paths, remote: config.repo.remote, base: config.repo.defaultBranch, slug };
    const install = openInstallPr(root, { exec, branch, ...pr });
    out.push('', 'Install pull request:', ...installLines(install, pr));
    // Printed before the steps that may take a while, or open the browser.
    stdout.write(`${out.join('\n')}\n`);

    // Then this computer: the plugin, and the sign-in to the Omni page.
    const closing = [
      '',
      ...(await computer(config)),
      ...closingSteps({
        slug,
        defaultBranch: config.repo.defaultBranch,
        configPath: CONFIG_FILE,
        outboxCheck: config.ci.outboxContext,
        pr: install.pr,
        forms: formsDone,
        settings,
        labels,
        unfilled: COMMAND_KEYS.filter((key) => config.commands[key] === null).map((key) => ({ key, flag: FLAGS[key] })),
        notices: { legacyWorkflows: legacyLoopWorkflows(root), formatter: formatterToExclude(root, LOOP_DIR) },
      }),
    ];
    stdout.write(`${closing.join('\n')}\n`);
    return 0;
  },
};
