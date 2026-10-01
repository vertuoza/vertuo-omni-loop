// @ts-nocheck
// The words `omni update` prints and puts in its pull request (PRD 347). Pure: no filesystem, no
// network.

/** `v<x.y.z>`, or `unversioned` for a bin that carried no version. */
export const tagOf = (version) => (version ? `v${version}` : 'unversioned');

/** The update branch: `branches.update` with `{version}` filled as `v<x.y.z>`. */
export function updateBranch(template, version) {
  return template.replaceAll('{version}', `v${version}`);
}

/** The commit's and the pull request's title. */
export const updateTitle = (version) => `chore(omni): update to v${version}`;

/** The labels line: `ok`, how many were created, and which a person must create. */
function labelsWords({ created, byHand }) {
  const parts = [];
  if (created.length) parts.push(`${created.length} created`);
  if (byHand.length) parts.push(`to create by hand: ${byHand.join(', ')}`);
  return parts.length ? parts.join(', ') : 'ok';
}

/** The forms line: none missing, how many were created, or why none were written. */
function formsWords(forms) {
  if (forms.outside) return `left as they are (${forms.dir} is outside .omni-loop/)`;
  return forms.created.length ? `${forms.created.length} created (${forms.created.join(', ')})` : 'none missing';
}

/**
 * What changed in the repository, one line each, under the `from → to` header.
 *
 * @param {{ from: string | null, to: string, forms: { created: string[], outside: boolean, dir: string }, labels: { created: string[], byHand: string[] } }} report
 */
export function reportLines({ from, to, forms, labels }) {
  return [
    `${tagOf(from)} → v${to}`,
    '  bin      updated',
    `  config   kept, valid under v${to}`,
    `  forms    ${formsWords(forms)}`,
    `  labels   ${labelsWords(labels)}`,
  ];
}

/** GitHub's page of what changed in the kit: the compare page between two tags, or the release's own. */
export function changesLink({ home, from, to }) {
  return from ? `https://github.com/${home}/compare/v${from}...v${to}` : `https://github.com/${home}/releases/tag/v${to}`;
}

/** The pull request's body: what changed here, what changed in the kit, then the footer line when signing is on. */
export function updateBody({ lines, home, from, to, footer }) {
  const body = [
    `Brings this repository to the Omni Loop kit v${to}, from ${tagOf(from)}. \`config.yml\` is kept as it was.`,
    '',
    '```text',
    ...lines,
    '```',
    '',
    `What changed in the kit: ${changesLink({ home, from, to })}`,
  ];
  if (footer) body.push('', footer);
  return `${body.join('\n')}\n`;
}
