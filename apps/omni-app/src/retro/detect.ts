// `detect`: plain records in, the fact sheet out (PRD 72, decision 9). Pure: it touches no GitHub and
// no clock, so the same records always give the same sheet, and a later PRD can feed it from a clone
// of the repository instead of from the API.
//
// It runs each kind's detector on that kind's records, keeps each kind's facts under its id, and ranks
// every finding by `rules`' order (then by kind, then as found), numbering them F1, F2… The sheet is
// what `retro.json` keeps for the run, and what `render` reads every number from.
import { kindsFor, type Kind } from './kinds/index.ts';
import { rankOf, rulesSheet } from './rules.ts';
import type { DetectContext, FactSheet, Finding, Run } from './retro.types.ts';

export type DetectInput = DetectContext & {
  run: Run;
  records: Record<string, unknown>;
  kinds?: readonly Kind[];
};

export function detect({ run, pr, prd, config, pulls, records, kinds = kindsFor(run) }: DetectInput): FactSheet {
  const context = { pr, prd, config, pulls };
  const facts: Record<string, unknown> = {};
  const found: { finding: Finding & { source: string }; kindIndex: number; index: number }[] = [];
  kinds.forEach((kind, kindIndex) => {
    const out = kind.detect(records[kind.id] ?? null, context) ?? {};
    facts[kind.id] = out.facts ?? null;
    (out.findings ?? []).forEach((finding, index) => found.push({ finding: { ...finding, source: kind.id }, kindIndex, index }));
  });

  const seen = new Set<string>();
  const findings = found
    .sort((a, b) => rankOf(a.finding.kind) - rankOf(b.finding.kind) || a.kindIndex - b.kindIndex || a.index - b.index)
    .map(({ finding }) => finding)
    .filter((finding) => !seen.has(finding.id) && seen.add(finding.id))
    .map((finding, index) => ({ ref: `F${index + 1}`, ...finding }));

  return {
    run,
    rules: rulesSheet(),
    prd: { number: prd.number, title: prd.title, topic: prd.topic, state: prd.state, folder: prd.folder },
    featurePr: {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      openedAt: pr.openedAt,
      mergedAt: pr.mergedAt,
      mergeSha: pr.mergeSha,
    },
    kinds: facts,
    findings,
  };
}
