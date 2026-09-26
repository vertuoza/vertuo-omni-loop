// The loop labels `omni init` makes sure exist: named by the config's `labels.*`, each with a fixed
// colour and description. Reconciled by name only — a label that exists, whatever its colour,
// description or case, is left alone. Nothing here edits, recolours or deletes a label.
const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

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
};

/** `[{ name, color, description }]` for every loop label `labels` names, first name wins. */
export function loopLabels(labels) {
  const seen = new Set();
  const out = [];
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
 *
 * @returns {{ created: string[], present: string[], byHand: string[] }}
 */
export function reconcileLabels(root, { exec, labels }) {
  const wanted = loopLabels(labels);
  let existing;
  try {
    const listed = JSON.parse(exec('gh', ['label', 'list', '--json', 'name', '--limit', String(LIST_LIMIT)], { cwd: root, ...QUIET }));
    existing = new Set(listed.map((label) => String(label.name).toLowerCase()));
  } catch {
    return { created: [], present: [], byHand: wanted.map((label) => label.name) };
  }
  const result = { created: [], present: [], byHand: [] };
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
