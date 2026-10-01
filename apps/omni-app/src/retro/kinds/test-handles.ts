// Test support only: a kind of finding as its tests call it. The tests hand each kind partial
// fixtures (a scope with only the fields a read needs, a context without a PRD), so these handles
// take any object and read the facts back as present; the kind itself stays strictly typed.
import { replayGitHub } from '../../../test/github-replay.ts';
import type { Finding, Kind, KindContext, KindScope, Octokit } from './index.ts';

export function handles<Records, Facts>(kind: Kind<Records, Facts>) {
  return {
    gather: (octokit: unknown, scope: object = {}) =>
      kind.gather(octokit as Octokit, scope as KindScope) as Promise<NonNullable<Records>>, // ts-allow: a test's stubbed GitHub and partial scope
    detect: (records: unknown, context: object = {}) =>
      kind.detect(records as Records, context as KindContext) as { facts: Facts; findings: Finding[] }, // ts-allow: a test's fixture records and partial context
    section: (facts: unknown) => kind.describe(facts as Facts) as string[], // ts-allow: a test's facts, and a section it expects
  };
}

/**
 * The stubbed GitHub over any fixtures. `replayGitHub` is typed by its own slice; until then the
 * options it infers from its defaults take only empty lists and maps.
 */
export function replay(fixtures: object = {}): ReturnType<typeof replayGitHub> {
  return replayGitHub(fixtures as Parameters<typeof replayGitHub>[0]); // ts-allow: the options its own slice will type
}
