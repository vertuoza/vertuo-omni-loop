// What `omni init` prints. First what it wrote or kept (`setupLines`); then, after the install pull
// request's block (install-pr.mjs), what it did on this computer — the plugin and the sign-in, each with
// the lines left to type when it could not (`computerLines`); last the closing steps only a person can
// take — the GitHub App, merging the install pull request, the loop labels gh could not make, the
// optional branch protection, filling the forms with /omni:invade — the commands it could not fill,
// what it noticed and left alone, who sees the status line it switched on, how to update the loop later
// (`omni update`), and how to remove it again (`closingSteps`). Only the repository's slug, its default
// branch and the install pull request vary from one repository to the next.
import { dirname } from 'node:path';
import type { InstallPr } from './install-pr.ts';
import type { LabelsResult } from './labels.ts';
import type { FormatterNotice } from './notices.ts';
import type { StepLines } from './plugin.ts';
import { PERSONAL_SETTINGS_FILE, STATUS_LINE_KEY } from './settings.ts';
import type { StatusLineOutcome } from './settings.ts';

// The App a person installs, and the marketplace and plugin init installs (and omni update updates), named once.
export const APP = { name: 'omni-loop', slug: 'omni-loop-invader' };
export const MARKETPLACE = 'omni-loop';
export const PLUGIN = 'omni';

const GITHUB = 'https://github.com';
const PLACEHOLDER_SLUG = '<owner>/<repository>';

// What became of the status line (settings.mjs's outcomes), one line each; `wrote` and `kept` leave
// the kit's own line in place.
const STATUS_LINE: Record<StatusLineOutcome, (path: string) => string> = {
  wrote: (path) => `  wrote   ${path}  (${STATUS_LINE_KEY})`,
  kept: (path) => `  kept    ${path}  (${STATUS_LINE_KEY})`,
  foreign: (path) => `  kept    ${path}  (its ${STATUS_LINE_KEY} is not the kit's)`,
  invalid: (path) => `  skipped ${path}: not valid JSON, no status line added`,
};
const KIT_LINE_IN_PLACE: ReadonlySet<string> = new Set(['wrote', 'kept']);

// The closing steps' numbers: the App, then the merge, then the labels step when there is one.
const LABELS_STEP = 3;
const formsStep = (labels: Pick<LabelsResult, 'byHand'>): number => (labels.byHand.length ? 5 : 4);

/**
 * The first lines: what init wrote or kept. `slug` is the repository's `owner/name`, `null` when
 * nothing could say; `files` each file init owns, and whether this run wrote it; `forms` the forms'
 * front door, and each file of it this run wrote — a form is never overwritten, so one already there
 * is not listed — `outside` when the front door lies outside init's folder, and so nothing was
 * written there; `settings` the settings file the status line goes in, and what this run did with
 * it (see settings.ts).
 */
export function setupLines({ slug, files, forms, settings, labels }: {
  slug: string | null;
  files: { path: string; wrote: boolean }[];
  forms: { dir: string; wrote: string[]; outside: boolean };
  settings: { path: string; outcome: StatusLineOutcome };
  labels: LabelsResult;
}): string[] {
  const dir = dirname(files[0]!.path); // ts-allow: init passes its files, never none
  const lines = [`omni init — ${slug ?? 'this repository'} is set up.`];
  const width = Math.max(...files.map((file) => file.path.length));
  for (const { path, wrote } of files) {
    lines.push(wrote ? `  wrote   ${path}` : `  kept    ${path.padEnd(width)}  (pass --force to overwrite)`);
  }
  for (const path of forms.wrote) lines.push(`  wrote   ${path}`);
  if (forms.outside) lines.push(`  forms   not written: ${forms.dir}/ is outside ${dir}/ — see step ${formsStep(labels)} below`);
  lines.push(STATUS_LINE[settings.outcome](settings.path));
  const done = [];
  if (labels.created.length) done.push(`created ${labels.created.join(', ')}`);
  if (labels.present.length) {
    const present = `already there: ${labels.present.join(', ')}`;
    done.push(labels.created.length ? `   (${present})` : present);
  }
  if (done.length) lines.push(`  labels  ${done.join('')}`);
  if (labels.byHand.length) lines.push(`  labels  gh could not create ${labels.byHand.join(', ')} — see step ${LABELS_STEP} below`);
  return lines;
}

/**
 * What init did on this computer — the plugin, then the sign-in — each a status line, then the lines
 * left to type for any step it could not do (plugin.ts, signin-step.ts).
 */
export function computerLines(plugin: StepLines, signin: StepLines): string[] {
  const lines = ['On this computer:', ...plugin.status, ...signin.status];
  if (plugin.todo.length) lines.push('', 'Type these in Claude Code to install the plugin:', ...plugin.todo.map((line) => `     ${line}`));
  if (signin.todo.length) lines.push('', 'Type this in a terminal to sign in later:', ...signin.todo.map((line) => `     ${line}`));
  return lines;
}

/**
 * The closing lines: the heads-up, the steps only a person can take, the commands left unfilled, how
 * to update the loop and how to remove it. `defaultBranch` is the branch the config names (the
 * schema default when unknown); `configPath` the config file, whose folder is the loop's;
 * `outboxCheck` the check the omni-loop App posts (`ci.outboxContext`); `pr` the install pull
 * request, when init found or opened it; `forms` the forms' front door; `unfilled` each
 * `commands.*` left null, with its flag; `notices` an older loop's workflows found in the
 * repository, and a formatter that would check the bin.
 */
export function closingSteps({ slug, defaultBranch, configPath, outboxCheck, pr, forms, settings, labels, unfilled, notices = {} }: {
  slug: string | null;
  defaultBranch: string;
  configPath: string;
  outboxCheck: string;
  pr: Pick<InstallPr, 'url' | 'number'> | null;
  forms: { dir: string };
  settings: { path: string; outcome: string };
  labels: Pick<LabelsResult, 'byHand'>;
  unfilled: { key: string; flag: string }[];
  notices?: { legacyWorkflows?: string[]; formatter?: FormatterNotice | null };
}): string[] {
  const repo = slug ?? PLACEHOLDER_SLUG;
  const dir = dirname(configPath);
  const lines: string[] = [];

  const headsUp: string[] = [];
  if (notices.legacyWorkflows?.length) {
    headsUp.push(
      `An older copy of the loop already runs here (${notices.legacyWorkflows.join(', ')}). Two loops mean`,
      `  two outbox checks and two label sets: decide which one stays before merging ${dir}/.`,
    );
  }
  if (notices.formatter) {
    headsUp.push(
      `${notices.formatter.tool} checks this repository: add ${dir}/bin/ to ${notices.formatter.file}, or its`,
      '  format check rejects the bundled bin.',
    );
  }
  if (headsUp.length) {
    lines.push('', 'Heads-up:');
    for (const line of headsUp) lines.push(line.startsWith('  ') ? `  ${line}` : `  - ${line}`);
  }

  const steps: [string, ...string[]][] = [
    [
      `Install the ${APP.name} GitHub App on ${slug ?? 'this repository'}:`,
      `     ${GITHUB}/apps/${APP.slug}/installations/new`,
    ],
    pr
      ? [`Merge ${pr.number ? `PR #${pr.number}` : 'the install pull request'} into ${defaultBranch}:`, `     ${pr.url}`]
      : [`Merge the install pull request into ${defaultBranch}, once it is open (see above).`],
  ];
  if (labels.byHand.length) {
    steps.push([
      'Create the labels gh could not create:',
      `     ${GITHUB}/${repo}/labels`,
      `     ${labels.byHand.join(', ')}`,
    ]);
  }
  steps.push([
    `(Optional) Require the \`${outboxCheck}\` check on ${defaultBranch}:`,
    `     ${GITHUB}/${repo}/settings/branches`,
    '   Warning: a required check that is never posted blocks every pull request in this repository.',
    '   If the app is uninstalled, its deploy is broken or Inngest is down, nothing can merge. The remedy',
    '   is to remove the requirement, never to fake a status.',
  ]);
  // Last: the skill needs the plugin, and opens a pull request into the branch the forms were merged to.
  steps.push([
    `Fill the forms in ${forms.dir}/ with what the repository can prove, in Claude Code:`,
    `     /${PLUGIN}:invade`,
  ]);
  lines.push('', 'Then, by hand:');
  steps.forEach(([first, ...rest], index) => {
    lines.push(`  ${index + 1}. ${first}`, ...rest.map((line) => `  ${line}`));
  });

  if (unfilled.length) {
    lines.push('', `Not filled — set them in ${configPath} or rerun with the flag:`);
    for (const { key, flag } of unfilled) lines.push(`  commands.${key} (--${flag} <cmd>)`);
  }

  lines.push(
    '',
    `To update the loop later: node ${dir}/bin/omni.mjs update opens the pull request that brings`,
    `this repository to the latest kit, then updates the ${PLUGIN} plugin on your machine.`,
  );
  // The status line and its removal are named only while the kit's own line is in place: someone
  // else's, or a file init could not read, is none of the loop's to switch on or to delete.
  if (KIT_LINE_IN_PLACE.has(settings.outcome)) {
    lines.push(
      '',
      'The status line is on for everyone who opens Claude Code in this repository. A person who wants',
      `their own sets ${STATUS_LINE_KEY} in ${PERSONAL_SETTINGS_FILE}, which Claude Code reads first.`,
      '',
      `To remove the loop: delete ${dir}/ and the ${STATUS_LINE_KEY} key of ${settings.path}, and commit.`,
      'The labels and the App installation stay.',
    );
  } else {
    lines.push('', `To remove the loop: delete ${dir}/ and commit. The labels and the App installation stay.`);
  }
  return lines;
}
