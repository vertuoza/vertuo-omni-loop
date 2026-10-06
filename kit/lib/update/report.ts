// The words `omni update` prints and puts in its pull request (PRD 347). Pure: no filesystem, no
// network.

/** The forms the update wrote: the files it created, or why it wrote none (`dir` outside the loop). */
export type FormsReport = { created: readonly string[]; outside: boolean; dir: string };

/** The labels it reconciled: those it created, and those a person must create. */
export type LabelsReport = { created: readonly string[]; byHand: readonly string[] };

/** `v<x.y.z>`, or `unversioned` for a bin that carried no version. */
export const tagOf = (version: string | null): string => (version ? `v${version}` : 'unversioned');

/** The update branch: `branches.update` with `{version}` filled as `v<x.y.z>`. */
export function updateBranch(template: string, version: string): string {
  return template.replaceAll('{version}', `v${version}`);
}

/** The commit's and the pull request's title. */
export const updateTitle = (version: string): string => `chore(omni): update to v${version}`;

/** The labels line: `ok`, how many were created, and which a person must create. */
function labelsWords({ created, byHand }: LabelsReport): string {
  const parts: string[] = [];
  if (created.length) parts.push(`${created.length} created`);
  if (byHand.length) parts.push(`to create by hand: ${byHand.join(', ')}`);
  return parts.length ? parts.join(', ') : 'ok';
}

/** The forms line: none missing, how many were created, or why none were written. */
function formsWords(forms: FormsReport): string {
  if (forms.outside) return `left as they are (${forms.dir} is outside .omni-loop/)`;
  return forms.created.length ? `${forms.created.length} created (${forms.created.join(', ')})` : 'none missing';
}

/**
 * What changed in the repository, one line each, under the `from → to` header.
 */
export function reportLines({ from, to, forms, labels }: { from: string | null; to: string; forms: FormsReport; labels: LabelsReport }): string[] {
  return [
    `${tagOf(from)} → v${to}`,
    '  bin      updated',
    `  config   kept, valid under v${to}`,
    `  forms    ${formsWords(forms)}`,
    `  labels   ${labelsWords(labels)}`,
  ];
}

/** GitHub's page of what changed in the kit: the compare page between two tags, or the release's own. */
export function changesLink({ home, from, to }: { home: string | null; from: string | null; to: string }): string {
  return from ? `https://github.com/${home}/compare/v${from}...v${to}` : `https://github.com/${home}/releases/tag/v${to}`;
}

/** The pull request's body: what changed here, what changed in the kit, then the footer line when signing is on. */
export function updateBody({ lines, home, from, to, footer }: { lines: readonly string[]; home: string | null; from: string | null; to: string; footer: string | null }): string {
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
