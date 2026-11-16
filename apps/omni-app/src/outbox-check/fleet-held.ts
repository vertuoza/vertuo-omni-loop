// A feature pull request into the default branch is held on the items a fleet answered (PRD 2896 s10, BR-PRODUCT-5): at a
// mission's level `alone` the fleet's committee may answer a high item, which then reads as answered for the mission branch
// only. The outbox check grades pull requests into the default branch alone (../evaluate/evaluate.ts), so here every item whose
// latest ledger entry a fleet answered still holds the feature pull request: a person answers it before it goes there.
//
// Pure over the head's delivery folder and the base's config, as `evaluate` is: it parses Markdown through the kit's own reader
// and runs nothing it fetched. The override label waves it through as it does an open item: only a person applies it.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import { fleetAnswered, fleetHeldLines } from 'omni-loop/kit/lib/outbox/fleet.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import { prdDirs, prdOfTopic, pullKind, type PrFacts, type Verdict } from '../evaluate/evaluate.ts';

/** The folders under `absolute`, by name; none when it does not exist. */
const folderNames = (absolute: string): string[] =>
  existsSync(absolute) ? readdirSync(absolute, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];

/** The PRD a feature pull request into the default branch grades, read from the head; null for any other pull request. */
function featurePrd(config: Config, head: string, pr: PrFacts): PrdNumber | null {
  const kind = pullKind(pr, config);
  if ('skip' in kind || kind.kind !== 'feature') return null;
  const prd = prdOfTopic(kind.topic, prdDirs(config).flatMap((dir) => folderNames(join(head, dir))), config);
  return 'skip' in prd ? null : prd.number;
}

/**
 * `verdict` once the items a fleet answered are read: held on them, the override label aside; unchanged when there are none, when
 * the check was skipped, and on a repository whose base holds no config (`config` null).
 */
export function withFleetHeld(verdict: Verdict, { config, head, pr }: { config: Config | null; head: string; pr: PrFacts }): Verdict {
  const prd = config === null || verdict.conclusion === 'skipped' ? null : featurePrd(config, head, pr);
  if (config === null || prd === null) return verdict;
  const answered = fleetAnswered(prd, { ctx: createContext(head, config) });
  if (answered.length === 0) return verdict;
  const summary = `${verdict.summary}\n${fleetHeldLines(answered).join('\n')}`;
  const overrideLabel = config.labels.outboxGo;
  if ((pr.labels ?? []).includes(overrideLabel)) return { ...verdict, summary };
  const n = answered.length;
  return { ...verdict, conclusion: 'failure', title: `${String(n)} item${n === 1 ? '' : 's'} answered by a fleet: a person answers ${n === 1 ? 'it' : 'them'} first`, summary };
}
