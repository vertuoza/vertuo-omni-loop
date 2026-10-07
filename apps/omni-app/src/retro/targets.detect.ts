// `withTargets`: the fact sheet of a multi-repository PRD (PRD 1130), its plan repository's sheet and
// each target's in, one sheet grouped by repository out. Pure.
//
// Every finding carries its repository (`repo`); a target's finding is told apart from the plan
// repository's of the same rule by its id (`<name>/<id>`) and says its repository in its title. All
// findings are ranked together by the rules' order, the plan repository's first within a rank, then
// the targets' in `## Repositories` order, and numbered F1, F2… again. `repositories` lists the plan
// repository first, then every target, read (its feature PRs and its kinds' facts) or not (its reason).
import { detect } from './detect.ts';
import type { Kind } from './kinds/index.ts';
import { rankOf } from './rules.ts';
import type { FactSheet, RepositoryFacts, Run, Scope, SheetFinding, TargetRead } from './retro.types.ts';
import { shortName } from './targets.ts';
import { targetScope } from './targets.read.ts';

/** One target and what its kinds gathered: `null` for a target not read. */
export type TargetRecords = { target: TargetRead; records: Record<string, unknown> | null };

type Input = { planSlug: string; targets: readonly TargetRecords[]; run: Run; kinds: readonly Kind[]; scope: Scope };

/** The plan repository's sheet with every target's findings and facts in it; unchanged when there is no target. */
export function withTargets(sheet: FactSheet, { planSlug, targets, run, kinds, scope }: Input): FactSheet {
  if (targets.length === 0) return sheet;
  const plan: RepositoryFacts = { repo: planSlug, name: shortName(planSlug), plan: true, read: true, featurePrs: [{ number: sheet.featurePr.number, url: sheet.featurePr.url }] };
  const repositories = [plan];
  const findings: SheetFinding[] = sheet.findings.map((finding) => ({ ...finding, repo: planSlug }));
  for (const { target, records } of targets) {
    const one = targetSheet(target, records, { run, kinds, scope });
    repositories.push(one.repository);
    findings.push(...one.findings);
  }
  return { ...sheet, findings: ranked(findings), repositories };
}

/** One target's line of `repositories`, and its findings, each naming it. */
function targetSheet(
  target: TargetRead,
  records: Record<string, unknown> | null,
  { run, kinds, scope }: Pick<Input, 'run' | 'kinds' | 'scope'>,
): { repository: RepositoryFacts; findings: SheetFinding[] } {
  const base = { repo: target.repo, name: target.name, plan: false };
  if (!target.read) return { repository: { ...base, read: false, reason: target.reason, featurePrs: [] }, findings: [] };
  const own = targetScope(target, scope);
  const sheet = detect({ run, pr: own.pr, prd: own.prd, config: own.config, pulls: own.pulls, records: records ?? {}, kinds });
  const featurePrs = target.featurePrs.map((pull) => ({ number: pull.number, url: pull.url }));
  return {
    repository: { ...base, read: true, featurePrs, kinds: sheet.kinds },
    findings: sheet.findings.map((finding) => ({ ...finding, id: `${target.name}/${finding.id}`, title: `${target.repo}: ${finding.title}`, repo: target.repo })),
  };
}

/** Every finding ranked by the rules' order, in the order given within a rank, and numbered F1, F2… */
function ranked(findings: readonly SheetFinding[]): SheetFinding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => rankOf(a.finding.kind) - rankOf(b.finding.kind) || a.index - b.index)
    .map(({ finding }, index) => ({ ...finding, ref: `F${index + 1}` }));
}
