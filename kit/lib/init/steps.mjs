// What `omni init` prints last: what it wrote or kept, then the steps only a person can take — the
// plugin, the GitHub App, the loop labels gh could not make, the optional branch protection, filling
// the forms with /omni:invade — the commands it could not fill, what it noticed and left alone, who
// sees the status line it switched on, how to update the loop later (`omni update`), and how to remove
// it again. Only the repository's slug and default branch (and the kit's own address, see bundle.mjs)
// vary from one repository to the next.
import { dirname } from 'node:path';
import { PERSONAL_SETTINGS_FILE, STATUS_LINE_KEY } from './settings.mjs';

// The App, the marketplace and the plugin a repository installs by hand, named once.
export const APP = { name: 'omni-loop', slug: 'omni-loop-invader' };
export const MARKETPLACE = 'omni-loop';
export const PLUGIN = 'omni';

const GITHUB = 'https://github.com';
const PLACEHOLDER_SLUG = '<owner>/<repository>';

// What became of the status line (settings.mjs's outcomes), one line each; `wrote` and `kept` leave
// the kit's own line in place.
const STATUS_LINE = {
  wrote: (path) => `  wrote   ${path}  (${STATUS_LINE_KEY})`,
  kept: (path) => `  kept    ${path}  (${STATUS_LINE_KEY})`,
  foreign: (path) => `  kept    ${path}  (its ${STATUS_LINE_KEY} is not the kit's)`,
  invalid: (path) => `  skipped ${path}: not valid JSON, no status line added`,
};
const KIT_LINE_IN_PLACE = new Set(['wrote', 'kept']);

/**
 * @param {object} s
 * @param {string|null} s.slug              the repository's `owner/name`, `null` when nothing could say
 * @param {string} s.defaultBranch          the branch the config names (the schema default when unknown)
 * @param {string|null} s.kitHome           where the kit, and so its plugin marketplace, lives
 * @param {string} s.outboxCheck            the check the omni-loop App posts (`ci.outboxContext`)
 * @param {{ path: string, wrote: boolean }[]} s.files   each file init owns, and whether this run wrote it
 * @param {{ dir: string, wrote: string[], outside: boolean }} s.forms   the forms' front door, and each
 *   file of it this run wrote — a form is never overwritten, so one already there is not listed;
 *   `outside` when the front door lies outside init's folder, and so nothing was written there
 * @param {{ path: string, outcome: 'wrote' | 'kept' | 'foreign' | 'invalid' }} s.settings   the settings
 *   file the status line goes in, and what this run did with it (see settings.mjs)
 * @param {{ created: string[], present: string[], byHand: string[] }} s.labels
 * @param {{ key: string, flag: string }[]} s.unfilled   each `commands.*` left null, with its flag
 * @param {{ legacyWorkflows?: string[], formatter?: { tool: string, file: string } | null }} [s.notices]
 *   an older loop's workflows found in the repository, and a formatter that would check the bin
 * @returns {string} the closing steps, newline-terminated
 */
export function closingSteps({ slug, defaultBranch, kitHome, outboxCheck, files, forms, settings, labels, unfilled, notices = {} }) {
  const repo = slug ?? PLACEHOLDER_SLUG;
  const dir = dirname(files[0].path);
  const lines = [`omni init — ${slug ?? 'this repository'} is set up.`];

  const width = Math.max(...files.map((file) => file.path.length));
  for (const { path, wrote } of files) {
    lines.push(wrote ? `  wrote   ${path}` : `  kept    ${path.padEnd(width)}  (pass --force to overwrite)`);
  }
  for (const path of forms.wrote) lines.push(`  wrote   ${path}`);

  const steps = [
    [
      `Install the ${PLUGIN} plugin in Claude Code:`,
      `     /plugin marketplace add ${kitHome ?? '<owner>/<kit repository>'}`,
      `     /plugin install ${PLUGIN}@${MARKETPLACE}`,
    ],
    [
      `Install the ${APP.name} GitHub App on ${slug ?? 'this repository'}:`,
      `     ${GITHUB}/apps/${APP.slug}/installations/new`,
    ],
  ];
  const labelsStep = labels.byHand.length ? steps.length + 1 : null;
  if (labelsStep) {
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
  const formsStep = steps.length + 1;
  steps.push([
    `Fill the forms in ${forms.dir}/ with what the repository can prove, in Claude Code:`,
    `     /${PLUGIN}:invade`,
  ]);

  if (forms.outside) lines.push(`  forms   not written: ${forms.dir}/ is outside ${dir}/ — see step ${formsStep} below`);
  lines.push(STATUS_LINE[settings.outcome](settings.path));
  const done = [];
  if (labels.created.length) done.push(`created ${labels.created.join(', ')}`);
  if (labels.present.length) {
    const present = `already there: ${labels.present.join(', ')}`;
    done.push(labels.created.length ? `   (${present})` : present);
  }
  if (done.length) lines.push(`  labels  ${done.join('')}`);
  if (labelsStep) lines.push(`  labels  gh could not create ${labels.byHand.join(', ')} — see step ${labelsStep} below`);

  const headsUp = [];
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

  // What to commit: the loop's folder when this run wrote in it, the settings file when it wrote the key.
  const toCommit = [];
  if (files.some((file) => file.wrote) || forms.wrote.length) toCommit.push(`${dir}/`);
  if (settings.outcome === 'wrote') toCommit.push(settings.path);
  lines.push(
    '',
    toCommit.length === 2
      ? `Commit ${toCommit.join(' and ')}, and merge them into ${defaultBranch}, then, by hand:`
      : toCommit.length
        ? `Commit ${toCommit[0]} and merge it into ${defaultBranch}, then, by hand:`
        : 'Nothing new to commit. By hand, unless already done:',
  );
  steps.forEach(([first, ...rest], index) => {
    lines.push(`  ${index + 1}. ${first}`, ...rest.map((line) => `  ${line}`));
  });

  if (unfilled.length) {
    lines.push('', `Not filled — set them in ${files[0].path} or rerun with the flag:`);
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
  return `${lines.join('\n')}\n`;
}
