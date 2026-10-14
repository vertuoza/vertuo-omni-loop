// `omni init [--force] [--agent <agent>]… [--setup <cmd>] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]` — installs the
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
// `statusLine` key of `.claude/settings.json` (N-PRODUCT-6) and, in the same file, the band's line of
// `enabledPlugins` (PRD 1208) — both only while `agents` lists `claude`, as is the plugin — and the
// `.agents/skills/omni-*` copies of the skills its manifest owns, only while `agents` lists another
// agent (PRD 1890, N-PRODUCT-13).
// A repository already installed on its default branch (PRD 893) skips all of that but this computer:
// no branch switch, no write, no commit, push or pull request, and only the forms left as a step —
// or, when a form is filled there, the `omni update` and `/omni:invade --refresh` lines. `--force`
// always runs the full install.
import { defined } from '../../lib/narrow.ts';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { parseArgs, usageError } from '../args.ts';
import { CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig } from '../../lib/config.ts';
import { createContext } from '../../lib/context.ts';
import { installCommand, kitHome, runningBundle, runningKit } from '../../lib/init/bundle.ts';
import { renderConfig } from '../../lib/init/config-text.ts';
import { COMMAND_KEYS, detectCommands, detectLawsSource } from '../../lib/init/detect.ts';
import { reconcileLabels } from '../../lib/init/labels.ts';
import { formatterToExclude, legacyLoopWorkflows } from '../../lib/init/notices.ts';
import { closingSteps, computerLines, installedHeadline, installedSteps, setupLines } from '../../lib/init/steps.ts';
import { detectInstall, insideLoop, LOOP_DIR } from '../../lib/init/installed.ts';
import { installPlugin, pluginLines } from '../../lib/init/plugin.ts';
import {
  AGENTS_QUESTION, agentsAnswer, copiesLine, copiesRefusal, needsCopies, NO_PLUGIN_LINE, ownedCopyPaths, parseAgents, servesClaude, takeAgentFlags,
} from '../../lib/init/agents.ts';
import { AgentsError, syncAgentSkills } from '../../lib/agents/write.ts';
import { signInLines, signInStep } from '../../lib/init/signin-step.ts';
import { installLines, openInstallPr, switchToInstallBranch } from '../../lib/init/install-pr.ts';
import { findRoot, readRepo } from '../../lib/init/repo.ts';
import { enableHud, ownSettingsPaths, SETTINGS_FILE, writeStatusLine } from '../../lib/init/settings.ts';
import { writeForms } from '../../lib/playbook/write-forms.ts';
import { signin } from './signin.ts';
import type { Agent, Config } from '../../lib/types.ts';
import type { InitCommands } from '../../lib/init/config-text.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

/** How `omni init` asks a question on a terminal: a test answers it with a function of its own. */
type Ask = (question: string) => Promise<string | null | undefined> | string | null | undefined;

/** What a test hands `omni init` beyond `main()`'s own. */
type InitOptions = {
  stdin?: { isTTY?: boolean } | undefined;
  bundle?: string | null;
  ask?: Ask;
  home?: string | undefined;
  signIn?: (() => Promise<number | { code: number; line?: string | undefined }>) | undefined;
};

export const BIN_FILE = join(LOOP_DIR, 'bin', 'omni.mjs');

const FLAGS = Object.freeze({ setup: 'setup', test: 'test', preflight: 'preflight', preflightFull: 'preflight-full' });
const QUESTIONS: Record<keyof InitCommands, string> = {
  setup: 'the command that prepares a fresh checkout to run the preflight, as an install',
  test: 'the command that runs the tests',
  preflight: 'the command a slice must pass before its sub-PR is ready',
  preflightFull: 'the full preflight, run before a feature PR is ready',
};

async function askTerminal(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

/** Detection, then flags, then — on a terminal — one question per command still unknown, else null. */
async function resolveCommands(
  root: string,
  flags: { [K in (typeof FLAGS)[keyof typeof FLAGS]]?: string },
  { interactive, ask }: { interactive: boolean; ask: Ask },
): Promise<InitCommands> {
  const commands = detectCommands(root);
  for (const key of COMMAND_KEYS) {
    const flag = flags[FLAGS[key]];
    if (typeof flag === 'string') commands[key] = flag;
  }
  if (interactive) {
    for (const key of COMMAND_KEYS) {
      if (commands[key] !== null) continue;
      const answer = ((await ask(`commands.${key}: ${QUESTIONS[key]} (empty for none): `)) ?? '').trim();
      commands[key] = answer || null;
    }
  }
  return commands;
}

/**
 * The agents to install for: the `--agent` flags, else on a terminal the answer to one question
 * (empty keeps Claude alone), else `null`, and the config keeps its default. A name the kit does not
 * know, or one named twice, refuses init before anything is written.
 */
async function resolveAgents(named: readonly string[], { interactive, ask }: { interactive: boolean; ask: Ask }): Promise<Agent[] | null> {
  let names: readonly string[] = named;
  if (!names.length) {
    if (!interactive) return null;
    names = agentsAnswer(await ask(AGENTS_QUESTION));
  }
  const parsed = parseAgents(names);
  if ('error' in parsed) throw usageError(`omni init: ${parsed.error}.`);
  return parsed.agents;
}

/**
 * The `agents` key a new config is written with, none for the default; a kept config keeps its own,
 * and the key is never rendered for it. Refuses init, before anything is written, when the copies are wanted and an `omni-*` folder of
 * `.agents/skills/` is someone else's, or the manifest is not omni's.
 */
async function chooseAgents(
  root: string,
  { kept, named, fallback, interactive, ask }: { kept: Config | null; named: readonly string[]; fallback: readonly Agent[]; interactive: boolean; ask: Ask },
): Promise<{ agents?: Agent[] }> {
  const agents = kept ? kept.agents : await resolveAgents(named, { interactive, ask });
  const refused = needsCopies(agents ?? fallback) ? copiesRefusal(root) : null;
  if (refused) throw usageError(`omni init: ${refused}`);
  return agents ? { agents } : {};
}

/**
 * What init writes for the agents `config` lists (PRD 1890). While it lists Claude, the status line,
 * the one key init writes outside its folder: it runs the bin just installed, and a line that is not
 * the kit's, or a file that is not JSON, is left as it is; and, in the same file by the same rules,
 * the band above the prompt (PRD 1208): one line of `enabledPlugins`, never over a value someone else
 * set. Then the copies of the skills for the other agents, in the folders the manifest says the
 * install owns. Returns each outcome, the copies' setup line, and the paths outside the loop's folder
 * the install pull request commits.
 */
function writeForAgents(root: string, { config, force, exec }: { config: Config; force: boolean; exec: FreeIo['exec'] }) {
  const claude = servesClaude(config.agents);
  const settings = claude ? writeStatusLine(root, { bin: BIN_FILE, force }) : null;
  const hud = claude ? enableHud(root) : null;
  let synced: ReturnType<typeof syncAgentSkills>;
  try {
    synced = syncAgentSkills({ root, agents: config.agents, version: runningKit({ exec }).version });
  } catch (error) {
    if (error instanceof AgentsError) throw usageError(`omni init: ${error.message}`);
    throw error;
  }
  const folders = ownedCopyPaths(root);
  return {
    settings,
    hud,
    copies: copiesLine({ agents: config.agents, owned: folders.length, changes: synced.changes }),
    owned: folders.length > 0,
    // The settings file while the kit's status line, or the band's line, is in it; the copies' folders.
    paths: [...ownSettingsPaths(settings && hud ? [settings, hud] : []), ...folders],
  };
}

/** This computer's lines: the plugin, then the sign-in to the Omni page. Neither ever fails init. */
async function thisComputer({ root, config, interactive, stdout, stderr, exec, env, vars, home, signIn }: Pick<FreeIo, 'stdout' | 'stderr' | 'exec' | 'env' | 'vars'> & {
  root: string;
  config: Config;
  interactive: boolean;
  home: string | undefined;
  signIn: InitOptions['signIn'];
}): Promise<string[]> {
  const kit = kitHome({ exec });
  // No Claude in `agents` (PRD 1890): the plugin is none of this repository's, and is left alone.
  const plugin = servesClaude(config.agents)
    ? pluginLines(installPlugin({ exec, kitHome: kit }), { kitHome: kit })
    : { status: [NO_PLUGIN_LINE], todo: [] };
  const signedIn = await signInStep({
    askUrl: config.ask.url,
    home,
    interactive,
    signIn: signIn ?? (async () => {
      let line: string | undefined;
      const code = await signin.run([], { cwd: root, stdout, stderr, exec, env, vars, home, onSignedIn: (said) => { line = said; } });
      return { code, line };
    }),
  });
  return computerLines(plugin, signInLines(signedIn));
}

export const init = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, stderr, exec, env, vars, stdin = process.stdin, bundle = runningBundle(), ask = askTerminal, home: userHome, signIn }: FreeIo & InitOptions,
  ) {
    const agentFlags = takeAgentFlags(args);
    const { positional, flags } = parseArgs('init', agentFlags.rest, { values: Object.values(FLAGS), booleans: ['force'] });
    if (positional.length) throw usageError('usage: omni init [--force] [--agent <agent>]… [--setup <cmd>] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]');
    const force = flags.force === true;
    const root = findRoot(cwd, exec);
    const defaults = ConfigSchema.parse({ kit: CONFIG_VERSION });
    const configPath = join(root, CONFIG_FILE);
    const binPath = join(root, BIN_FILE);
    const interactive = Boolean(stdin.isTTY && stdout.isTTY);
    const computer = (config: Config) => thisComputer({ root, config, interactive, stdout, stderr, exec, env, vars, home: userHome, signIn });

    // Already installed on the default branch: only this computer's steps, and nothing written.
    const installed = force ? null : detectInstall(root, { exec });
    if (installed) {
      stdout.write(`${installedHeadline(installed.defaultBranch)}\n`);
      const forms = { dir: createContext(root, installed.config).layout.frontDoor };
      stdout.write(`${['', ...(await computer(installed.config)), ...installedSteps({ forms, invaded: installed.invaded, configPath: CONFIG_FILE })].join('\n')}\n`);
      return 0;
    }

    // Everything that can refuse runs before anything is written.
    const keepConfig = !force && existsSync(configPath);
    const kept = keepConfig ? parseConfig(readFileSync(configPath, 'utf8'), CONFIG_FILE) : null;
    const copyBin = force || !existsSync(binPath);
    if (copyBin && !bundle) {
      throw usageError(
        `omni init: this omni runs from the kit source, which is never installed as ${BIN_FILE}; run \`${installCommand(kitHome({ exec }))}\` instead.`,
      );
    }
    // The agents (PRD 1890): a kept config keeps its own, as it keeps every other key.
    const agentsKey = await chooseAgents(root, { kept, named: agentFlags.values, fallback: defaults.agents, interactive, ask });

    // The install branch comes first, so everything written below lands on it, never on the branch
    // the person was on. A branch git refuses is reported with the install pull request below.
    const branch = switchToInstallBranch(root, { exec });

    let config: Config;
    if (kept === null) {
      const commands = await resolveCommands(root, flags, { interactive, ask });
      const repo = readRepo(root, { exec, remote: defaults.repo.remote });
      const lawsSource = detectLawsSource({ ctx: createContext(root, defaults) });
      const rendered = renderConfig({ ...repo, commands, lawsSource, ...agentsKey });
      config = rendered.config;
      const { text } = rendered;
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, text);
    } else {
      config = kept;
    }
    if (copyBin) {
      mkdirSync(dirname(binPath), { recursive: true });
      copyFileSync(defined(bundle, 'the kit bundle'), binPath);
      chmodSync(binPath, 0o755);
    }

    // Then the forms, by the same writer as `omni kb init`: never over a file that exists, and never
    // outside `.omni-loop/` — a kept config may keep the playbook elsewhere, and /omni:invade
    // (which runs `omni kb init`) writes them there.
    const ctx = createContext(root, config);
    const outside = !insideLoop(ctx.layout.frontDoor);
    const forms = outside ? [] : writeForms({ ctx });

    // Then the settings keys and the copies, for the agents the config lists (PRD 1890).
    const forAgents = writeForAgents(root, { config, force, exec });
    const { settings, hud } = forAgents;

    // Last: the files are the install, the labels a convenience — a label gh cannot make is a human step.
    const labels = reconcileLabels(root, { exec, labels: config.labels });

    // A kept config may leave the slug to the origin remote, as every other command does at load time.
    const slug = config.repo.slug ?? readRepo(root, { exec, remote: config.repo.remote }).slug;
    const filesWritten = [{ path: CONFIG_FILE, wrote: !keepConfig }, { path: BIN_FILE, wrote: copyBin }];
    const formsDone = { dir: ctx.layout.frontDoor, wrote: forms.filter((file) => file.wrote).map((file) => file.path), outside };
    const out = setupLines({ slug, files: filesWritten, forms: formsDone, settings, hud, copies: forAgents.copies, labels });

    // Then the install pull request: only init's own paths are committed — the loop's folder, the
    // settings file while the kit's status line, or the band's line, is in it, and the copies' folders
    // the manifest owns.
    const paths = [LOOP_DIR, ...forAgents.paths];
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
        settings: settings ?? { path: SETTINGS_FILE, outcome: 'untouched' },
        copies: forAgents.owned,
        labels,
        // A setup left null means none is needed (PRD 1804): it is never listed as unfilled.
        unfilled: COMMAND_KEYS.filter((key) => key !== 'setup' && config.commands[key] === null).map((key) => ({ key, flag: FLAGS[key] })),
        notices: { legacyWorkflows: legacyLoopWorkflows(root), formatter: formatterToExclude(root, LOOP_DIR) },
      }),
    ];
    stdout.write(`${closing.join('\n')}\n`);
    return 0;
  },
} satisfies FreeCommand;
