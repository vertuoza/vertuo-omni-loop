// The loop labels `omni init` makes sure exist: named by the config's `labels.*`, each with a fixed
// colour and description. Reconciled by name only — a label that exists, whatever its colour,
// description or case, is left alone. Nothing here edits, recolours or deletes a label.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { ExecText } from '../context.ts';
import { GhLabelsSchema } from './schema.ts';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

/** The config's `labels.*` (a name per loop label, and `autoCreate`), read by key. */
type Labels = Readonly<Record<string, unknown>>;

/** How a loop label is created: its colour and description. */
type LabelStyle = { color: string; description: string };

/** A loop label to make sure of: its name from the config, and its style. */
export type LoopLabel = LabelStyle & { name: string };

/** What reconciling did with each loop label. */
export type LabelsResult = { created: string[]; present: string[]; byHand: string[] };

// More than any repository's label count, so one `gh label list` sees them all (gh stops at 30).
const LIST_LIMIT = 1000;

/** The colour and description each loop label is created with, keyed like `labels.*`. */
export const LABEL_STYLES = {
  prd: { color: '5319e7', description: 'A PRD the Omni Loop builds' },
  phase0: { color: 'c5def5', description: 'Omni Loop: the docs-only phase-0 pull request of a PRD' },
  feature: { color: '0e8a16', description: 'Omni Loop: the feature pull request of a PRD' },
  sub: { color: 'bfdadc', description: 'Omni Loop: a slice pull request into a feature branch' },
  inProgress: { color: 'fbca04', description: 'Omni Loop: an agent is working on this pull request' },
  needsFix: { color: 'd93f0b', description: 'Omni Loop: this pull request needs a fix before it can move' },
  outboxGo: { color: '1d76db', description: 'Omni Loop: a person lets the outbox gate pass' },
  retro: { color: 'd4c5f9', description: 'Omni Loop: the retro of a merged PRD — its retro pull request, or one finding to act on' },
  knowledge: { color: 'c2e0c6', description: 'Omni Loop: the knowledge pull request harvested from a merged PRD' },
  visual: { color: 'f9a8d4', description: 'Omni Loop: a small visual change, picked from rendered variations and fixed in one PR' },
  bug: { color: 'b60205', description: 'Omni Loop: a behaviour bug, proven red and fixed in one PR' },
  regression: { color: 'e99695', description: 'Omni Loop: a bug a change broke — the triage names the evidence' },
  riskCritical: { color: '7a0000', description: 'Omni Loop: bug triage — critical risk' },
  riskHigh: { color: 'ff7619', description: 'Omni Loop: bug triage — high risk' },
  riskMedium: { color: 'fef2c0', description: 'Omni Loop: bug triage — medium risk' },
  riskLow: { color: 'ededed', description: 'Omni Loop: bug triage — low risk' },
  concept: { color: 'fbbf24', description: 'Omni Loop: a vast idea explored as a concept, before it becomes PRDs' },
  approved: { color: '2da44e', description: 'Omni Loop: a PRD approved on its PRD page, the server holding who and when' },
  law: { color: '5a32a3', description: 'Omni Loop: a law waiting for its test — /omni:enforce proves it red, then green' },
} satisfies Record<string, LabelStyle>;

/** `[{ name, color, description }]` for every loop label `labels` names, first name wins. */
export function loopLabels(labels: Labels): LoopLabel[] {
  const seen = new Set<string>();
  const out: LoopLabel[] = [];
  for (const [key, style] of Object.entries(LABEL_STYLES)) {
    const name = labels[key];
    if (typeof name !== 'string' || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, ...style });
  }
  return out;
}

/**
 * Creates the loop labels the repository at `root` lacks. Never throws: what `gh` could not do is
 * returned as `byHand`, for the person to do.
 */
export function reconcileLabels(root: string, { exec, labels }: { exec: ExecText; labels: Labels }): LabelsResult {
  const wanted = loopLabels(labels);
  let existing: Set<string>;
  try {
    const listed = GhLabelsSchema.parse(JSON.parse(exec('gh', ['label', 'list', '--json', 'name', '--limit', String(LIST_LIMIT)], { cwd: root, ...QUIET })));
    existing = new Set(listed.map((label) => label.name.toLowerCase()));
  } catch {
    return { created: [], present: [], byHand: wanted.map((label) => label.name) };
  }
  const result: LabelsResult = { created: [], present: [], byHand: [] };
  for (const { name, color, description } of wanted) {
    if (existing.has(name.toLowerCase())) {
      result.present.push(name);
      continue;
    }
    try {
      exec('gh', ['label', 'create', name, '--color', color, '--description', description], { cwd: root, ...QUIET });
      result.created.push(name);
    } catch {
      result.byHand.push(name);
    }
  }
  return result;
}
