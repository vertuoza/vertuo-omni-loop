// The words `omni update` prints and puts in its pull request (PRD 347). Pure: no filesystem, no
// network.
import { posix } from 'node:path';
import type { AgentCopyChange } from '../agents/write.ts';

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

/** The report's line for the skills for other agents (PRD 1890): how many copies moved, none when none did. */
export function agentsLine(changes: readonly AgentCopyChange[]): string[] {
  if (changes.length === 0) return [];
  return [`  agents   ${changes.length} ${changes.length === 1 ? 'copy' : 'copies'} changed`];
}

/** What happened to one copy, as the pull request lists it. */
function changeWords(change: AgentCopyChange): string {
  if (change.change === 'changed') return `${change.lines} ${change.lines === 1 ? 'line' : 'lines'} changed`;
  return change.change;
}

/** The pull request's **Skills for other agents** section: one line per copy that moved, then the
 * generated-copies sentence. Empty when no copy moved. */
function agentsSection(changes: readonly AgentCopyChange[]): string[] {
  if (changes.length === 0) return [];
  return [
    '**Skills for other agents**',
    '',
    ...changes.map((change) => `- \`${posix.basename(change.folder)}\`: ${changeWords(change)}`),
    '',
    "These copies are generated from the kit; read the kit's release notes, not the copies.",
  ];
}

/** The pull request's body: what changed here, the copies for other agents that moved, what changed
 * in the kit, then the footer line when signing is on. */
export function updateBody({
  lines,
  home,
  from,
  to,
  footer,
  agents = [],
}: {
  lines: readonly string[];
  home: string | null;
  from: string | null;
  to: string;
  footer: string | null;
  agents?: readonly AgentCopyChange[];
}): string {
  const section = agentsSection(agents);
  const body = [
    `Brings this repository to the Omni Loop kit v${to}, from ${tagOf(from)}. \`config.yml\` is kept as it was.`,
    '',
    '```text',
    ...lines,
    '```',
    '',
    ...(section.length ? [...section, ''] : []),
    `What changed in the kit: ${changesLink({ home, from, to })}`,
  ];
  if (footer) body.push('', footer);
  return `${body.join('\n')}\n`;
}
