// The loop's domain types, written once (PRD 725, s3). One source per type: a shape read from
// outside the process is a Zod schema in `kit/lib/schema/` and its type here is `z.infer` of it; a
// shape the kit only builds itself is written here as a type. Types only: this file holds no value.
import type { z } from 'zod';
import type { ConfigSchema } from './schema/config.ts';
import type { VERSION_KINDS } from './schema/dossier.ts';
import type { OutboxItemFrontMatterSchema, PROOF_VALUES, RANK_VALUES, SPEC_VALUES, SpecFrontMatterSchema } from './schema/front-matter.ts';

/** `.omni-loop/config.yml`, parsed: every key present, defaults filled in. */
export type Config = z.infer<typeof ConfigSchema>;

/** The loop's seven stages, in the order a PRD goes through them (`STAGE_WORDS`). */
export type Stage = 'idea' | 'prd' | 'inbox' | 'building' | 'outbox' | 'shipped' | 'retro';

/** The folders a PRD's own folder lives in, once it has one. */
export type PrdState = 'inbox' | 'shipped';

/** Where PRD `prd` lives today, as `omni prd <n>` prints it (`kit/lib/delivery/prd.ts`). */
export type PRD = {
  prd: number;
  /** The folder's name, `<nnnn>-<topic>`. */
  name: string;
  state: PrdState;
  /** The folder, relative to the repository root. */
  dir: string;
  /** Every file directly in the folder, relative to the repository root, sorted. */
  files: string[];
  outboxDir: string | null;
  /** The PRD's open outbox item files. */
  openItems: string[];
  /** The repositories a multi-repository plan lands in; `[]` for an ordinary plan. */
  repos: string[];
};

/** One row of a plan's slice table (`parsePlanSlices`, `kit/lib/inbox/territory.ts`). */
export type Slice = {
  id: string;
  /** The repository the slice lands in, for a plan repository's plan; `null` otherwise. */
  repo: string | null;
  title: string;
  /** The path prefixes the slice may create or change. */
  territory: string[];
  /** The ids of the slices that must merge first. */
  blockedBy: string[];
  /** `null` for a plan with no `wave` column. */
  wave: number | null;
};

export type SpecSource = (typeof SPEC_VALUES)[number];
export type Proof = (typeof PROOF_VALUES)[number];

/** An inbox spec's front matter, parsed (`parseSpec`, `kit/lib/inbox/inbox.ts`), and its file. */
export type InboxItem = {
  prd: number;
  title: string;
  blockedBy: z.infer<typeof SpecFrontMatterSchema>['blocked-by'];
  spec: SpecSource;
  areas?: string[];
  proof?: Proof;
  /** The spec's path, when it was read from one. */
  file: string | null;
};

export type Rank = (typeof RANK_VALUES)[number];

/** One `A. <sentence>` line of an item's options. */
export type OutboxOption = { letter: string; text: string };

/** An outbox item's sections, by field: each present only when the item carries its heading. */
export type OutboxSections = {
  questionPlain?: string;
  decisionPlain?: string;
  introFun?: string;
  punchlineFun?: string;
  options?: OutboxOption[];
  personSteps?: string;
  whatIHadToDecide?: string;
  whatIDidMeanwhile?: string;
  whatItCostsToChangeLater?: string;
  whatICouldNotKnow?: string;
};

type OutboxItemFrontMatter = z.infer<typeof OutboxItemFrontMatterSchema>;

/** An outbox item, parsed (`parseOutboxItem`, `kit/lib/outbox/outbox.ts`). */
export type OutboxItem = Pick<OutboxItemFrontMatter, 'id' | 'prd' | 'slice' | 'rank' | 'raised' | 'wave'> & {
  bearsOn: OutboxItemFrontMatter['bears-on'];
  sections: OutboxSections;
  /** The item's path, when it was read from one. */
  file: string | null;
};

export type DossierVersionKind = (typeof VERSION_KINDS)[number];

/** One version of a dossier's artifact, as the store returns it. */
export type DossierVersion = { id: string; gitBlob: string | null; bytes: number };

/** A dossier, read from its row (`game/dossiers/store.ts`): the latest version of each kind. */
export type Dossier = {
  id: string;
  prd: number;
  title: string;
  latest: Partial<Record<DossierVersionKind, DossierVersion>>;
  /** A visual fix's only: every `variations` version, since each round is its own. */
  rounds?: DossierVersion[];
};

/** A fleet, folded from its row (`configFrom`, `game/config.ts`). */
export type Fleet = {
  /** The sector the fleet calls home, or `null`. */
  home: string | null;
  label?: string;
  color?: string;
  motto?: string;
  mascot?: string | null;
  sort?: number;
  retired: boolean;
};
