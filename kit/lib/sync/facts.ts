// The facts `omni sync` gathers (PRD 1990), one shape per check and one for the newcomer's setup,
// which `syncStatus` (`./status.ts`) turns into findings. Types only: each check's gatherer
// (`./main.ts`, `./kit.ts`, `./knowledge.ts`, `./page.ts`, `./setup.ts`) returns its shape.
//
// Any fact, or a whole check, may be `{ notChecked: <why> }` (`offline`, `no gh`, `timed out`,
// `no sign-in`): it is one orange finding, never a red one. A whole check may also be
// `{ na: <why> }`: it does not apply here, and reads green (`n/a · <why>`).
import type { ExecText } from '../context.ts';
import type { Config } from '../types.ts';

/** What a gatherer is handed: the folder `omni sync` runs in, the main checkout, the config, how
 * to run a process, and the run's time (ms). */
export type GatherIo = { readonly cwd: string; readonly root: string; readonly config: Config; readonly exec: ExecText; readonly now: number };

/** A check's gatherer: its facts, never a throw. */
export type Gatherer<F> = (io: GatherIo) => Promise<F>;

/** A fact that could not be gathered, and why, in a few words. */
export type Unchecked = { readonly notChecked: string };

/** A check that does not apply here, and why: green, `n/a · <why>`. */
export type NotApplicable = { readonly na: string };

/** `T`, or why it could not be gathered. */
export type Fact<T> = T | Unchecked;

/** The main check's facts: where `HEAD` stands against `<remote>/<defaultBranch>`. */
export type MainFacts = {
  readonly remote: string;
  readonly defaultBranch: string;
  /** In a linked worktree (one a skill cut): only the behind rule runs there. */
  readonly linked: boolean;
  /** The branch checked out, `null` on a detached `HEAD`. */
  readonly branch: string | null;
  /** The commits of `<remote>/<defaultBranch>` that `HEAD` does not have, and when the oldest of them was committed (ms). */
  readonly behind: Fact<{ readonly count: number; readonly oldestAt: number | null }>;
  /** Tracked files changed in the checkout. */
  readonly changed: Fact<number>;
  /** The default branch's commits that `<remote>/<defaultBranch>` does not have. */
  readonly unpushed: Fact<number>;
};

/** A Claude plugin, as `claude plugin list` names it: `version` null when it is not installed. */
export type PluginFact = {
  /** As the list names it: `omni@omni-loop`. */
  readonly name: string;
  /** As a finding names it: `plugin`, `HUD plugin`. */
  readonly label: string;
  readonly version: string | null;
  /** What installs it, as `omni init` prints it. */
  readonly fix: string;
};

/** A target repository's kit: `version` null when it has none. */
export type TargetKitFact = { readonly repo: string } & ({ readonly version: string | null } | Unchecked);

/** The kit check's facts. */
export type KitFacts =
  | NotApplicable
  | Unchecked
  | {
      /** The kit home's latest release, `x.y.z`. */
      readonly latest: Fact<string>;
      /** The repository's kit (or the running kit's, for a shim bin); `null` when it carries no version. */
      readonly repo: Fact<string | null>;
      /** The two plugins; `null` when there is no `claude` command, and this part does not run. */
      readonly plugins: Fact<readonly PluginFact[]> | null;
      /** The target repositories: a plan repository's, or the product's other repositories. */
      readonly targets: readonly TargetKitFact[];
    };

/** A target's knowledge copy, as `omni targets` judges it (its `TargetState`). */
export type TargetCopyFact = { readonly repo: string; readonly state: 'ok' | 'drifted' | 'stale' | 'unreachable' };

/** The knowledge check's facts. */
export type KnowledgeFacts =
  | NotApplicable
  | Unchecked
  | {
      /** The playbook entries whose evidence changed or is gone. */
      readonly staleEvidence: Fact<number>;
      /** The target copies; `null` outside a plan repository, where this part does not run. */
      readonly targets: Fact<readonly TargetCopyFact[]> | null;
      /** Tracked files changed under `paths.knowledge`. */
      readonly changed: Fact<number>;
    };

/** The page check's facts. */
export type PageFacts =
  | NotApplicable
  | Unchecked
  | {
      /** A sign-in is stored and not expired. */
      readonly signedIn: boolean;
      /** When the constituents cache was last written (ms), `null` when there is none. */
      readonly syncedAt: number | null;
      /** Whether the page answered `omni constituents` within its budget. */
      readonly answering: boolean;
    };

/** The newcomer's first three steps (the fourth is the main check's). */
export type SetupFacts = {
  /** Whether the `claude` command is on the PATH: without it, the two plugin steps are skipped. */
  readonly claude: boolean;
  readonly plugin: { readonly done: boolean; readonly fix: string };
  readonly hud: { readonly done: boolean; readonly fix: string };
  readonly signedIn: boolean;
};

/** Everything one run gathered: `null` for a check whose level is `off`, which gathers nothing. */
export type SyncFacts = {
  /** When the run checked (ms). */
  readonly now: number;
  /** When the setup was first all done in this checkout (ISO), from the cache; `null` for a newcomer. */
  readonly setupDoneAt: string | null;
  /** `repo.defaultBranch`, as the words name it. */
  readonly defaultBranch: string;
  readonly main: MainFacts | NotApplicable | Unchecked | null;
  readonly kit: KitFacts | null;
  readonly knowledge: KnowledgeFacts | null;
  readonly page: PageFacts | null;
  readonly setup: SetupFacts;
};

/** Why a check whose gatherer gathers nothing yet reads `n/a`. */
export const NOT_CHECKED_YET = 'not checked yet';

/** Whether `value` is a fact that could not be gathered. */
export function isUnchecked(value: unknown): value is Unchecked {
  return typeof value === 'object' && value !== null && 'notChecked' in value;
}

/** Whether `value` is a check that does not apply here. */
export function isNotApplicable(value: unknown): value is NotApplicable {
  return typeof value === 'object' && value !== null && 'na' in value;
}
