// Test support only, in a `test/` folder: a kind of finding as its tests call it. The tests hand each kind partial
// fixtures (a scope with only the fields a read needs, a context without a PRD), so these handles
// take any object and read the facts back as present; the kind itself stays strictly typed.
import { replayGitHub } from '../../../../test/github-replay.ts';
import { retroRunner, widgetScenario } from '../../../../test/retro-scenario.ts';
import type { RetroDeps } from '../../retro.ts';
import type { Finding, Kind, KindContext, KindScope, Octokit } from '../index.ts';

export function handles<Records, Facts>(kind: Kind<Records, Facts>) {
  return {
    gather: (octokit: unknown, scope: object = {}) =>
      kind.gather(octokit as Octokit, scope as KindScope) as Promise<NonNullable<Records>>,
    detect: (records: unknown, context: object = {}) =>
      kind.detect(records as Records, context as KindContext) as { facts: Facts; findings: Finding[] },
    section: (facts: unknown) => kind.describe(facts as Facts) as string[],
  };
}

/** The stubbed GitHub over a test's fixtures. */
export function replay(fixtures: Parameters<typeof replayGitHub>[0] = {}): ReturnType<typeof replayGitHub> {
  return replayGitHub(fixtures);
}

/** The widget scenario over a test's parts. */
export function scenario(parts: Parameters<typeof widgetScenario>[0] = {}): ReturnType<typeof widgetScenario> {
  return widgetScenario(parts);
}

/** One run of the retro's job over a test's stubs and the scenario's job: what it returned, or the error it threw. */
export function retroRun(deps: RetroDeps, widget: ReturnType<typeof widgetScenario>): ReturnType<ReturnType<typeof retroRunner>['execute']> {
  return retroRunner(deps, widget.job).execute();
}
