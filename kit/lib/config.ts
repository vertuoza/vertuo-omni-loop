// The one definition of `.omni-loop/config.yml`. Every repository-specific value the kit needs is a
// key here; a key that is not here does not exist, and a key the file has that is not here is an
// error, never ignored. `kit/lib/schema/config.ts` names it beside the kit's other schemas.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { isOneOf, messageOf } from './narrow.ts';
import { parseSelector } from './design/words/selector.ts';
import { FlowSchema, hooksByMode, regexSource } from './flow/schema.ts';
import { CANONICAL_LAYERS, layerList, layerOf } from './layers/layers.ts';
import { KIT_MESSAGES } from './schema/messages.ts';

export const CONFIG_FILE = '.omni-loop/config.yml';
export const CONFIG_VERSION = 1;

export class ConfigError extends Error {
  /** True when the file was read and does not hold a valid config, false when there is no file to read. */
  readonly invalid: boolean;
  constructor(message: string, { invalid = false }: { invalid?: boolean } = {}) {
    super(message);
    this.name = 'ConfigError';
    this.invalid = invalid;
  }
}

const text = z.string().min(1);
const nullableText = text.nullable();
// A branch name template (`feat/{topic}--{slice}`) and a label's name (`omni:prd`): text, named by
// what it holds. Their keys (`branches.slice`, `labels.prd`) are the ones users' config files carry,
// so they keep those names; the values are no IDs, and are never branded (ADR-0056).
const branchTemplate = z.string().min(1);
const labelName = z.string().min(1);
// A section every key of which has a default: absent, it parses as `{}` would, defaults filled in.
const section = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.preprocess((value) => (value === undefined ? {} : value), z.object(shape).strict());
// A name or an address a `Co-authored-by: <name> <email>` line can hold: one line, no angle bracket.
const trailerPart = text.regex(/^[^<>\r\n]+$/, 'one line, with no < or >');
// Where ask mode's pages and calls live: https anywhere, or plain http on the loopback address only.
const askUrl = z.string().refine((value) => {
  let url;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === '127.0.0.1');
}, 'an https URL, or http on 127.0.0.1');
// A public link: an absolute https URL on one line, with no loopback exception.
const httpsUrl = z.string().refine((value) => {
  if (/\s/.test(value)) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'an absolute https URL');

// PRD 798: where `/omni:prove` films — the feature PR's preview (`github-deployment`), or a fixed
// absolute http(s) URL.
const PROOF_GITHUB_DEPLOYMENT = 'github-deployment';
const proofUrl = z.string().refine((value) => {
  if (value === PROOF_GITHUB_DEPLOYMENT) return true;
  if (/\s/.test(value)) return false;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}, `${PROOF_GITHUB_DEPLOYMENT}, or an absolute http(s) URL`);
// The NAME of an environment variable, never its value.
const envName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'the name of an environment variable, such as VERCEL_AUTOMATION_BYPASS_SECRET');

// PRD 1407: a selector the word pass reads — tags, ids, classes and attributes, no combinator.
const wordSelector = text.refine((value) => parseSelector(value) !== null, 'a selector of tags, #ids, .classes and [attributes], comma-separated, with no combinator');

// PRD 1726: a law's owner — a GitHub login or an `<org>/<team>`, without the `@` CODEOWNERS adds.
const lawOwner = z
  .string()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9_.-]+)?$/, 'a GitHub login or <org>/<team>, without @');
// PRD 1794: one person's GitHub login, without `@`: never a team, since a team never clears a law.
const personLogin = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/, 'a GitHub login, without @, never a team');
// PRD 1794: an owner and the one person asked in their place once they have not answered. A key the
// entry leaves out reads as empty, so the refusal names that key: a union reports an option's issues
// only when none of them aborts, and a missing key would abort.
const ownerWithDelegate = z.preprocess(
  (value) => (isRecord(value) ? { login: '', delegate: '', ...value } : value),
  z
    .object({ login: personLogin, delegate: personLogin })
    .strict()
    .refine((entry) => entry.login.toLowerCase() !== entry.delegate.toLowerCase(), {
      message: 'a delegate other than its own owner',
      path: ['delegate'],
    }),
);
// An entry of `laws.owners`: a plain owner (PRD 1726), or an owner with a delegate (PRD 1794).
const lawOwnerEntry = z.union([lawOwner, ownerWithDelegate]);

/** An entry of `laws.owners`, as written: a login or `<org>/<team>`, or `{ login, delegate }`. */
export type LawOwner = z.infer<typeof lawOwnerEntry>;

/** An entry of `laws.owners` as its owner and its delegate; a plain entry has no delegate. */
export function lawOwnerParts(entry: LawOwner): { owner: string; delegate: string | null } {
  return typeof entry === 'string' ? { owner: entry, delegate: null } : { owner: entry.login, delegate: entry.delegate };
}

/**
 * The kinds of contract a slice may declare (PRD 1870) when a repository's `contracts.kinds` names
 * none of its own:
 *
 * - `api` — a GraphQL type, field or argument, or a REST route or payload: what the repository's
 *   callers call.
 * - `db` — a migration, or any other change to a stored shape: what the repository keeps.
 *
 * A repository whose callers depend on something else names its own words (`kinds: [api, event]`);
 * `none`, the word for a slice that changes nothing for its callers, is never one of them.
 */
export const DEFAULT_CONTRACT_KINDS: readonly string[] = Object.freeze(['api', 'db']);

/**
 * PRD 2175: how many minutes a draft still on `labels.inProgress` may go with no commit and no update
 * before the board reads its claim as stale, when `limits.claimDeadMinutes` is not set. Long enough
 * that an agent thinking without pushing is not taken over: the longest slice job seen ran 81 minutes.
 */
export const DEFAULT_CLAIM_DEAD_MINUTES = 240;

/** PRD 2175: the label a runner puts on a claim whose job ended, when `labels.released` is not set. */
export const DEFAULT_RELEASED_LABEL = 'omni:released';

/** The label a released claim carries: `labels.released`, or `DEFAULT_RELEASED_LABEL` when it is not set. */
export function releasedLabel(labels: { released?: string | undefined }): string {
  return labels.released ?? DEFAULT_RELEASED_LABEL;
}

// PRD 1870: a kind is one lowercase word, never `none`, which a plan's `contract` cell keeps for a
// slice that changes nothing for its callers.
const contractKind = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'one lowercase word, such as api or db')
  .refine((kind) => kind !== 'none', 'none is what a slice declares when it changes nothing — it is no kind');

// PRD 2346: a kind is read through `LAYER_ALIASES` (`rest` is `api`); any other word is kept, and
// `omni check config` flags it, so a repository's plans are never refused on what already exists.
const contractKinds = z
  .array(contractKind)
  .min(1, 'at least one kind, such as api')
  .transform((kinds) => kinds.map(layerOf))
  .superRefine((kinds, issues) => {
    const twice = kinds.find((kind, index) => kinds.indexOf(kind) !== index);
    if (twice !== undefined) issues.addIssue({ code: 'custom', message: `"${twice}" is listed twice` });
  });

// PRD 2346: `layers.<layer>` is a list of path patterns; a key outside the canonical list is refused
// by name, with the list.
const layersSection = z.record(z.string(), z.array(regexSource).min(1, 'at least one path pattern')).superRefine((layers, issues) => {
  for (const key of Object.keys(layers)) {
    if (!Object.hasOwn(CANONICAL_LAYERS, key)) {
      issues.addIssue({ code: 'custom', path: [key], message: `${key} is not a layer (${layerList()})` });
    }
  }
});

// PRD 522: what a plan repository knows of each target repository's knowledge base.
export const TARGET_KNOWLEDGE = Object.freeze(['own', 'imported', 'none']);

const target = z
  .object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
    role: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'one kebab-case word, such as back-end'),
    knowledge: z.enum(TARGET_KNOWLEDGE),
    readAt: z.string().regex(/^[0-9a-f]{40}$/, 'the full 40-character commit the copy was read at').nullable().default(null),
    // PRD 1162: no slice and no roadmap row may name a read-only target; it is still read, surveyed
    // and imported.
    readOnly: z.boolean().optional(),
    // PRD 1162: the short names of the targets whose default-branch packages this one installs.
    consumes: z.array(z.string()).optional(),
  })
  .strict();

/** The part of an `owner/name` slug after the `/`: the name a plan's `repo` column and a target's
 * `consumes` use. */
function targetShortName(slug: string): string {
  return slug.slice(slug.indexOf('/') + 1);
}

// A plan repository's own section (PRD 522): the page saying which repository does what, pointed at
// and never copied, and its target repositories. Optional: a config without it is no plan repository,
// and parses with no `plan` key at all.
//
// PRD 1364, s4: `product` names the product on the Omni page whose repository links are the targets,
// in place of `targets`; one of the two, never both. With `product`, `targets` parses as `[]`: the
// targets are the server's, read by `omni targets` (`kit/lib/product/`).
const planSection = z
  .object({
    guide: nullableText.default(null),
    targets: z.array(target).min(1, 'at least one target').optional(),
    product: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine(({ targets, product }, issues) => {
    if (targets !== undefined && product !== undefined) {
      issues.addIssue({
        code: 'custom',
        path: [],
        message: 'product and targets cannot both be set — keep product to read the targets from the server, or targets to keep them here',
      });
    }
    if (targets === undefined && product === undefined) issues.addIssue({ code: 'custom', path: ['targets'], message: 'at least one target, or a product' });
    checkTargets(targets ?? [], issues);
  })
  .transform(({ targets, ...plan }) => ({ ...plan, targets: targets ?? [] }));

/** The rules one list of `plan.targets` keeps: no target consumes itself or a stranger, none is
 * listed twice, and only an imported one has a `readAt`, which it must. */
function checkTargets(targets: ReadonlyArray<z.infer<typeof target>>, issues: z.core.$RefinementCtx) {
  const seen = new Set();
  const names = targets.map(({ repo }) => targetShortName(repo));
  targets.forEach(({ repo, knowledge, readAt, consumes = [] }, index) => {
    const own = targetShortName(repo);
    const others = names.filter((name) => name !== own);
    consumes.forEach((name, at) => {
      const path = ['targets', index, 'consumes', at];
      if (name === own) issues.addIssue({ code: 'custom', path, message: `${name} is this target itself — a target never consumes itself` });
      else if (!others.includes(name)) {
        issues.addIssue({ code: 'custom', path, message: `${name} names no other target of plan.targets by its short name (${others.join(', ') || 'none'})` });
      }
    });
    if (seen.has(repo)) issues.addIssue({ code: 'custom', path: ['targets', index, 'repo'], message: `${repo} is listed twice` });
    seen.add(repo);
    if (knowledge === 'imported' && readAt === null) {
      issues.addIssue({ code: 'custom', path: ['targets', index, 'readAt'], message: 'required when knowledge is imported' });
    }
    if (knowledge !== 'imported' && readAt !== null) {
      issues.addIssue({ code: 'custom', path: ['targets', index, 'readAt'], message: `only an imported target has one, and this one is ${knowledge}` });
    }
  });
}

// PRD 1138: a file the repository builds rather than writes. `path` is a path prefix, written as a
// territory entry is; `from` the prefixes whose change makes it stale; `build` the command that
// rebuilds it, run from the repository root.
const generatedEntry = z
  .object({
    path: text,
    from: z.array(text).min(1, 'at least one source prefix'),
    build: z.string().trim().min(1),
  })
  .strict();

// PRD 1890: the coding agents the kit installs its skills for. `claude` gets the plugin; the others
// read the generated `.agents/skills/omni-<name>/` copies (`kit/lib/agents/`).
export const AGENTS = Object.freeze(['claude', 'codex', 'cursor', 'gemini'] as const);

const agentList = z
  .array(z.enum(AGENTS, { error: (issue) => `${String(issue.input)} is no agent the kit installs for — one of ${AGENTS.join(', ')}` }))
  .min(1, 'at least one agent')
  .superRefine((agents, issues) => {
    agents.forEach((agent, index) => {
      if (agents.indexOf(agent) !== index) issues.addIssue({ code: 'custom', path: [index], message: `${agent} is listed twice` });
    });
  })
  .default(['claude']);

// PRD 1934: the tiers a plan advises a slice to run on, named for the capability it needs, and the
// efforts an agent can run a model at. `kit/lib/tiers.ts` reads a slice's tier through them.
export const TIERS = Object.freeze(['deep', 'build', 'light'] as const);
export const EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max'] as const);

const tierEntry = z
  .object({
    model: text,
    effort: z.enum(EFFORTS, { error: (issue) => `${String(issue.input)} is no effort — one of ${EFFORTS.join(', ')}` }).optional(),
  })
  .strict();

// One agent's row: each tier optional. A record refused key by key, so an unknown tier is named by its
// own path (`tiers.claude.huge`), not only listed under its row.
const tierRow = z.record(z.string(), tierEntry).superRefine((row, issues) => {
  for (const tier of Object.keys(row)) {
    if (!isOneOf(TIERS, tier)) {
      issues.addIssue({ code: 'custom', path: [tier], message: `${tier} is no tier — one of ${TIERS.join(', ')}` });
    }
  }
});

// PRD 1990: the four checks `omni sync` runs, heaviest first by default, and the highest colour each
// may show. `kit/lib/sync/` reads them.
export const SYNC_CHECKS = Object.freeze(['main', 'kit', 'knowledge', 'page'] as const);
const SYNC_LEVELS = Object.freeze(['red', 'orange', 'off'] as const);
/** The most hours `sync.mainRedAfter` may name: thirty days. */
const SYNC_MAX_HOURS = 720;

const syncCheck = z.enum(SYNC_CHECKS, { error: (issue) => `${String(issue.input)} is no check — one of ${SYNC_CHECKS.join(', ')}` });
const syncLevel = z.enum(SYNC_LEVELS, { error: (issue) => `${String(issue.input)} is no level — one of ${SYNC_LEVELS.join(', ')}` });

// The weight order: each of the four checks, exactly once.
const syncOrder = z.array(syncCheck).superRefine((order, issues) => {
  const twice = order.find((check, index) => order.indexOf(check) !== index);
  if (twice !== undefined) issues.addIssue({ code: 'custom', message: `${twice} is listed twice` });
  for (const check of SYNC_CHECKS) {
    if (!order.includes(check)) issues.addIssue({ code: 'custom', message: `${check} is not listed — the order names ${SYNC_CHECKS.join(', ')}, each once` });
  }
});

// How old a missing commit of the default branch may be before the main check is red: `<n>h`.
const HOURS_MESSAGE = `a whole number of hours, written <n>h from 1h to ${SYNC_MAX_HOURS}h, such as 24h`;
const syncHours = z
  .string({ error: HOURS_MESSAGE })
  .refine((value) => /^[1-9]\d*h$/.test(value) && Number.parseInt(value, 10) <= SYNC_MAX_HOURS, HOURS_MESSAGE);

/** Where the context budget's ceilings live when `budgets.context.file` does not say (PRD 1679). */
const CONTEXT_BUDGET_FILE = '.omni-loop/budgets/context.json';

export const ConfigSchema = z
  .object({
    kit: z.literal(CONFIG_VERSION),
    repo: section({
      slug: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name').nullable().default(null),
      remote: text.default('origin'),
      defaultBranch: text.default('main'),
    }),
    github: section({ user: nullableText.default(null) }),
    branches: section({
      feature: branchTemplate.default('feat/{topic}'),
      fix: branchTemplate.default('fix/{topic}'),
      phase0: branchTemplate.default('docs/phase-0-{topic}'),
      slice: branchTemplate.default('feat/{topic}--{slice}'),
      // Landings: the branch of each landing of a PRD of more than one, stacked on the one before;
      // `{landing}` and `{landings}` are its number and the count, `{name}` its plan's name for it.
      // A PRD of one landing keeps `feature`.
      landing: branchTemplate.default('feat/{topic}-{landing}of{landings}-{name}'),
      rework: branchTemplate.default('fix-{item}'),
      retro: branchTemplate.default('docs/retro-{topic}'),
      knowledge: branchTemplate.default('docs/knowledge-{topic}'),
      invade: branchTemplate.default('docs/omni-invade'),
      // PRD 347: the branch `omni update` opens its pull request from; `{version}` is `v<x.y.z>`.
      update: branchTemplate.default('chore/omni-update-{version}'),
      // PRD 522: the branch `/omni:mega-invade` opens its one docs-only pull request from.
      megaInvade: branchTemplate.default('docs/omni-mega-invade'),
      // PRD 686: the branch `/omni:think-big` records a concept on; `{topic}` is `<n>-<slug>`.
      concept: branchTemplate.default('docs/concept-{topic}'),
      // PRD 1342: the branch `/omni:enforce` proves a law's test on; `{id}` is the law's register id.
      law: branchTemplate.default('test/law-{id}'),
    }),
    worktrees: text.default('.claude/worktrees'),
    // PRD 1890: which coding agents the repository's people use. `[claude]` by default: a config
    // without the key installs for Claude Code alone, as before.
    agents: agentList,
    // PRD 1934: the model and effort each tier runs on, one row per agent `agents` lists. Optional:
    // a config without it parses with no `tiers` key, and every slice runs on the terminal's model.
    tiers: z.record(z.string(), tierRow).optional(),
    paths: section({
      delivery: text.default('.omni-loop/delivery'),
      knowledge: text.default('.omni-loop/knowledge'),
      adr: text.default('.omni-loop/knowledge/adr'),
      playbook: text.default('.omni-loop/knowledge/playbook'),
      glossary: nullableText.default(null),
      context: z.array(text).default(['AGENTS.md', 'CLAUDE.md']),
    }),
    labels: section({
      prd: labelName.default('omni:prd'),
      phase0: labelName.default('omni:phase-0'),
      feature: labelName.default('omni:feature'),
      sub: labelName.default('omni:sub'),
      inProgress: labelName.default('omni:in-progress'),
      needsFix: labelName.default('omni:needs-fix'),
      outboxGo: labelName.default('omni:outbox-go'),
      retro: labelName.default('omni:retro'),
      knowledge: labelName.default('omni:knowledge'),
      visual: labelName.default('omni:visual'),
      // PRD 556: the bug-fix lane's labels — the issue and its PR, a regression, and the triage's risk.
      bug: labelName.default('omni:bug'),
      regression: labelName.default('omni:regression'),
      riskCritical: labelName.default('omni:risk-critical'),
      riskHigh: labelName.default('omni:risk-high'),
      riskMedium: labelName.default('omni:risk-medium'),
      riskLow: labelName.default('omni:risk-low'),
      // PRD 686: a concept `/omni:think-big` records — its issue and its pull request.
      concept: labelName.default('omni:concept'),
      // PRD 1299: the label the GitHub App adds to a PRD's issue once it is approved on the server. For
      // display: nothing reads it.
      approved: labelName.default('omni:approved'),
      // PRD 1342: a law issue — a law written `Enforced by: pending #<n>`, waiting for its test.
      law: labelName.default('omni:law'),
      // PRD 2175: the label a runner swaps in for `inProgress` on a claim whose job ended while it held
      // it. The board reads a draft carrying it as `claimed-stale` at once (`kit/lib/board.ts`). Left
      // out, `releasedLabel()` reads `DEFAULT_RELEASED_LABEL`, and a config that does not set it parses
      // exactly as before (so `omni init` does not create it: a person does).
      released: labelName.optional(),
      autoCreate: z.boolean().default(false),
    }),
    prLinks: section({
      feature: text.default('Closes #{prd}'),
      sub: text.default('Part of #{prd}'),
      phase0: text.default('Refs #{prd}'),
    }),
    // How a pull request into the default branch or a landing branch is opened: `openWith` names a
    // slash skill of this repository (`/create-pr`, say) that `/omni:pr` runs with `--base`,
    // `--draft` and `--non-interactive`; `null` keeps the kit's own `gh pr create`. Sub-PRs never use it.
    pr: section({ openWith: nullableText.default(null) }),
    board: section({ matchBy: z.enum(['base', 'label']).default('base') }),
    ci: section({
      outboxContext: text.default('outbox'),
      // PRD 675: the name of the check run the omni-loop App posts on a phase-0 PR.
      inboxContext: text.default('inbox'),
      // PRD 1548 and PRD 1612: the name of the check run the omni-loop App posts on a target feature PR
      // of a product PRD, and on a ◆ PRD's feature PR and its target PRs, saying whether what it builds
      // is what was approved; `null` posts none.
      approvedContext: nullableText.default('omni/approved'),
      aggregateCheck: nullableText.default(null),
      branchProtection: z.boolean().default(false),
      runner: text.default('ubuntu-latest'),
    }),
    commands: section({
      // PRD 1804: what prepares a fresh checkout to run the preflight (an install). Only the
      // multi-repository skills read it, from a target's default branch; `null` means none.
      setup: nullableText.default(null),
      preflight: nullableText.default(null),
      preflightFull: nullableText.default(null),
      checks: z.array(text).default([]),
      test: nullableText.default(null),
      // PRD 556: the command that runs mutation testing on the changed lines; `null` means none here.
      mutation: nullableText.default(null),
      // PRD 1369: a design linter `/omni:pixel-perfect review` runs when it is set; it only reports.
      design: nullableText.default(null),
      // PRD 2275: it builds what the repository ships to production, then runs checks against the
      // built output; only the bug-fix skills run it, when a passing reproduction cannot see the bug.
      smoke: nullableText.default(null),
    }),
    acceptance: z
      .object({
        enabled: z.boolean().default(false),
        dir: nullableText.default(null),
        pendingSuffix: nullableText.default(null),
        run: nullableText.default(null),
      })
      .strict()
      .refine((a) => !a.enabled || a.dir !== null, {
        message: 'acceptance.dir is required when acceptance.enabled is true',
        path: ['dir'],
      })
      .prefault({}),
    laws: section({
      source: z.enum(['knowledge', 'claudeMdInvariants', 'none']).default('none'),
      // The heading under which the context files (`paths.context`, in order) list the ADRs that are
      // law when `source` is `claudeMdInvariants`. Both names are kept from when CLAUDE.md alone was
      // read (PRD 1739), so every config that sets them still reads.
      claudeMdHeading: text.default('## Invariants'),
      // PRD 1342: whether every rule and invariant must name its proof — a test's path, or
      // `pending #<n>` — so `omni check knowledge` refuses `Enforced by: unenforced`. Off by default:
      // a repository turns it on with the knowledge PR of its sweep (`omni knowledge judge`).
      requireProof: z.boolean().default(false),
      // PRD 1726: at most this many locked laws (`Locked:` entries); `omni check knowledge` refuses more.
      max: z.number().int().positive().default(20),
      // PRD 1726: who may lock a law and approve a change to one, as CODEOWNERS names them — GitHub
      // logins and `<org>/<team>`s, written without `@`. Empty, `omni check knowledge` refuses any lock.
      // PRD 1794: an entry may be `{ login, delegate }` instead; the delegate is a CODEOWNER too.
      owners: z.array(lawOwnerEntry).default([]),
      // PRD 1794: product leadership, GitHub logins asked last about what still waits on a person.
      // Never written into CODEOWNERS, so its approval never clears a law.
      leadership: z.array(personLogin).default([]),
    }),
    risk: section({
      storedShape: z.array(regexSource).default([]),
      sharedContract: z.array(text).default([]),
    }),
    // Landings: the paths that must reach the default branch in a landing of their own (a
    // repository's migrations directories, say). Regex sources over repository paths, compiled once
    // by `omni plan check`; empty, no plan is refused for what it puts together.
    landings: section({ alone: z.array(regexSource).default([]) }),
    // PRD 2346: the repository's map from canonical layers to the paths that hold them: regular
    // expressions over repository paths, as a flow area's `paths`. A file may be in several layers.
    // Optional: a config without it parses with no `layers` key, and no entry is narrowed by layer.
    layers: layersSection.optional(),
    // PRD 1870: whether every slice that lands in this repository must declare, in its plan's
    // `contract` column, what it changes for the repository's callers — one or more of `kinds`, or
    // `none`. Off by default. `kinds` are this repository's own words, `DEFAULT_CONTRACT_KINDS` when
    // it names none; `omni plan check` refuses a word outside them.
    contracts: section({
      declare: z.boolean().default(false),
      kinds: contractKinds.default(() => [...DEFAULT_CONTRACT_KINDS]),
    }),
    notify: section({
      slack: z
        .object({ channelVar: text.default('OMNI_SLACK_CHANNEL'), tokenSecret: text.default('SLACK_BOT_TOKEN') })
        .strict()
        .nullable()
        .default(null),
    }),
    limits: section({
      stallDays: z.number().int().positive().default(5),
      attempts: z.number().int().positive().default(3),
      claimStaleMinutes: z.number().int().positive().default(60),
      // PRD 2175: how long a draft still on `labels.inProgress` may go with no commit and no update
      // before the board reads its claim as stale: the fallback for a claim no runner saw die. Left
      // out, `DEFAULT_CLAIM_DEAD_MINUTES` applies, and a config that does not set it parses exactly as before.
      claimDeadMinutes: z.number().int().positive().optional(),
      beforeAfterMaxBytes: z.number().int().positive().default(512000),
      // PRD 1205: how many loop steps run at once, counting those already running. 1 is the loop as it
      // was before, one step at a time.
      parallelSteps: z.number().int().min(1).max(6).default(3),
      // PRD 1089: the size a flow hook file may reach. Left out, `DEFAULT_HOOK_MAX_BYTES` applies,
      // and a config that does not set it parses exactly as before.
      hookMaxBytes: z.number().int().positive().optional(),
      // PRD 1794: how many working days (Monday to Friday, UTC) a thing waits on a person before the
      // next people are asked. Its own setting: `stallDays` is unchanged.
      escalationWorkingDays: z.number().int().min(1).max(10).default(2),
    }),
    // Issue 1722: a PRD whose plan has fewer slices than `inlineBelow` is built on its feature branch
    // itself, one slice after the other, with no sub-PR per slice (`/omni:wave`, `inlineWave` in
    // `kit/lib/board.ts`). 0, the default, never does: every slice is a sub-PR, as it always was.
    wave: section({ inlineBelow: z.number().int().min(0).default(0) }),
    ask: section({ url: askUrl.nullable().default(null) }),
    // PRD 216: whether `omni dossier` uploads this repository's PRD folders to the server `ask.url`
    // names. Off by default: a repository opts in. `dossierSwitch()` reads it with `ask.url`.
    dossier: section({ enabled: z.boolean().default(false) }),
    // PRD 262: whether a PRD ships with a release note (`<folder>/release.md`, `kit/lib/releases/`).
    // Off by default: a repository opts in. When it is on, `omni ship` refuses a PRD whose folder has
    // no note, or whose note `omni check releases` would fail.
    releaseNotes: section({ enabled: z.boolean().default(false) }),
    // PRD 251: whether an outbox may be answered outside the pull request — at the end of
    // `/omni:yolo` (`omni answers`) and on the page `ask.url` names. On by default: a repository
    // opts out. The pull request takes replies either way.
    answers: section({ enabled: z.boolean().default(true) }),
    // PRD 2338: whether `/omni:retro-apply` writes the guard test a kept lesson is worth, proved red
    // then green, beside the rule it appends. Off by default: the retro PR stays documents only, and a
    // lesson worth a guard names it for a person to take up. A repository opts in.
    retro: section({ guards: z.boolean().default(false) }),
    // PRD 2410: whether the GitHub App watches main for seven days after a feature PR merges, marking
    // the PRD broke on a red job on the merge commit, a revert or a traced regression, and queueing
    // `/omni:rewind` on the first break. On by default; read at the merge commit, so `false` there
    // opens no watch and queues no rewind.
    mainWatch: section({ enabled: z.boolean().default(true) }),
    // PRD 798: how `/omni:prove` records a PRD's acceptance criteria. Off while `url` is null.
    // `setup` is a command that writes a Playwright storageState to `PROOF_STORAGE_STATE`;
    // `bypassEnv` names the variable holding the Vercel protection-bypass secret; `maxSeconds` caps a clip.
    // `deployment` names the GitHub deployment environment to film when a commit has several previews.
    proof: section({
      url: proofUrl.nullable().default(null),
      deployment: nullableText.default(null),
      setup: nullableText.default(null),
      bypassEnv: envName.nullable().default(null),
      maxSeconds: z.number().int().positive().default(60),
    }),
    // PRD 1233 (beta): how `/omni:validate-e2e` keeps a PRD's acceptance criteria as e2e tests. Off by
    // default. `url`, `deployment`, `setup` and `bypassEnv` mean what they mean under `proof`; `dir` is
    // where the tests and their recordings live; `model` is the goal steps' OpenRouter id.
    e2e: section({
      enabled: z.boolean().default(false),
      url: proofUrl.nullable().default(null),
      deployment: nullableText.default(null),
      setup: nullableText.default(null),
      bypassEnv: envName.nullable().default(null),
      dir: text.default('e2e'),
      model: text.default('anthropic/claude-sonnet-5.5'),
    }),
    // PRD 1369: design craft — the `design` form's readers and `/omni:pixel-perfect review` on UI work.
    // Off by default: a repository opts in, and off restores the loop as it was. `paths` are globs over
    // repository paths where the screens, styles, tokens and components live; `omni design touched`
    // matches a diff against them (`kit/lib/design/`). PRD 1407: `screens` is the screen library's
    // folder, one Markdown file per screen (`kit/lib/design/screens.ts`); null reads as
    // `<paths.knowledge>/design/screens/`, the value `parseConfig` fills in. `words` tunes the word
    // pass, `omni design words` (`kit/lib/design/words/`): `sentence` is how many words make a sentence
    // (on a control at that count, at rest above it), `screen` and `primary` the selectors that mark a
    // screen and its primary action, and `avoid` the words the product avoids, beside any the form's
    // `product` section lists. PRD 1550: `ignore` holds the globs `omni design touched` drops from a
    // diff first; unset, it reads as the common test shapes (`kit/lib/design/ignore.ts`), and `[]`
    // drops nothing. PRD 1584: `words.content` marks the text a screen shows rather than writes, counted
    // apart and never judged; unset, it reads as `[data-content]` (`kit/lib/design/words/content.ts`).
    design: section({
      enabled: z.boolean().default(false),
      paths: z.array(text).default([]),
      ignore: z.array(text).optional(),
      screens: nullableText.default(null),
      words: section({
        sentence: z.number().int().positive().default(7),
        screen: wordSelector.default('[data-screen]'),
        primary: wordSelector.default('[data-primary]'),
        content: wordSelector.optional(),
        avoid: z.array(text).default([]),
      }),
    }),
    markers: section({ prefix: z.string().regex(/^[a-z][a-z0-9-]*$/, 'lowercase letters, digits and hyphens').default('omni-outbox') }),
    // Who co-signs the loop's commits, pull requests and issues (`kit/lib/signature.ts`). By
    // default the omni-loop GitHub App's bot account; `null` switches signing off. `footer` is a
    // template: `{name}` and `{home}` are filled from the keys they name, anything else is printed
    // as written. `home` defaults to the Omni Loop home page (ADR-0047, ADR-0055).
    signature: z
      .object({
        name: trailerPart.default('Omni-man'),
        email: trailerPart.default('333776611+omni-loop-invader[bot]@users.noreply.github.com'),
        home: httpsUrl.default('https://www.omni-loop.xyz'),
        footer: text.default('🦸 {name} by [Omni Loop]({home}) ©'),
      })
      .strict()
      .nullable()
      .prefault({}),
    plan: planSection.optional(),
    // PRD 1089: the repository's flow — its rules, its areas and its hooks (`kit/lib/flow/`).
    // Optional: a config without it runs the loop as the kit defines it, and parses with no `flow` key.
    flow: FlowSchema.optional(),
    // PRD 1138: the repository's generated outputs (`kit/lib/generated/`). Optional: a config without
    // it has none, and parses with no `generated` key.
    generated: z.array(generatedEntry).optional(),
    // PRD 1679: budgets on what the repository's agents read. `context` measures what a session loads
    // (`omni budget measure context`, `kit/lib/budgets/`) against the ceilings in `file`. Off by
    // default: a repository opts in. Optional: a config without it parses with no `budgets` key, and
    // `contextBudget()` reads it as off. Shaped `budgets.<name>` so a later budget is a key beside it.
    budgets: z.object({ context: section({ enabled: z.boolean().default(false), file: text.default(CONTEXT_BUDGET_FILE) }) }).strict().optional(),
    // PRD 1990: how `omni sync` weighs its checks. `order` decides the headline (the heaviest check
    // first), `levels` the highest colour each check may show (`off` gathers nothing), `mainRedAfter`
    // how old a missing commit of the default branch may be before the main check is red.
    sync: section({
      order: syncOrder.default(() => [...SYNC_CHECKS]),
      levels: section({
        main: syncLevel.default('red'),
        kit: syncLevel.default('orange'),
        knowledge: syncLevel.default('orange'),
        page: syncLevel.default('orange'),
      }),
      mainRedAfter: syncHours.default('24h'),
    }),
  })
  .strict()
  .superRefine(({ pr, flow, agents, tiers }, issues) => {
    // A row for an agent the repository does not use maps nothing anyone runs: refused, by its key.
    for (const agent of Object.keys(tiers ?? {})) {
      if (!isOneOf(agents, agent)) {
        issues.addIssue({ code: 'custom', path: ['tiers', agent], message: `${agent} is not in agents (${agents.join(', ')})` });
      }
    }
    // `pr.openWith` reads as the default area's `pr.open` replace hook: two of them is one too many.
    const hooks = flow?.hooks?.['pr.open'];
    if (pr.openWith !== null && hooks !== undefined && hooksByMode(hooks).replace !== null) {
      issues.addIssue({
        code: 'custom',
        path: ['flow', 'hooks', 'pr.open', 'replace'],
        message: 'pr.openWith already replaces how a pull request opens — keep one of the two',
      });
    }
  });

/**
 * Whether dossiers are on in a repository (PRD 216): `dossier.enabled` is true and `ask.url` is set.
 * `reason` says why, in the words `omni dossier status` prints; `askUrl` is where the calls go.
 *
 */
export function dossierSwitch(config: Pick<Config, 'dossier' | 'ask'>): { on: true; reason: string; askUrl: string } | { on: false; reason: string } {
  if (!config.dossier.enabled) return { on: false, reason: 'dossier.enabled is false' };
  if (!config.ask.url) return { on: false, reason: 'ask.url is not set' };
  return { on: true, reason: `dossier.enabled is true in ${CONFIG_FILE}`, askUrl: config.ask.url };
}

/** `.omni-loop/config.yml`, parsed: `Config` in `kit/lib/types.ts`. */
type Config = z.infer<typeof ConfigSchema>;

/** The screen library's folder (PRD 1407): `design.screens`, else `design/screens/` under `paths.knowledge`. */
export function designScreensDir({ paths, design }: { paths: Pick<Config['paths'], 'knowledge'>; design: Pick<Config['design'], 'screens'> }): string {
  return design.screens ?? `${paths.knowledge.replace(/\/+$/, '')}/design/screens/`;
}

/** The context budget (PRD 1679): `budgets.context`, or off with its ceilings in the default file. */
export function contextBudget({ budgets }: Pick<Config, 'budgets'>): { enabled: boolean; file: string } {
  return budgets?.context ?? { enabled: false, file: CONTEXT_BUDGET_FILE };
}

/** One step from a `kit:` format to the next: a raw file in, the same file one `kit:` higher out. */
type Migration = { from: number; migrate: (raw: Record<string, unknown>) => unknown };

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

/** Keys a config once held under another name (PRD #68): refused, naming the key that replaced them,
 * never read as an alias — a person set them by hand, and a clear error beats a silent alias. */
const RENAMED = Object.freeze([{ section: 'branches', from: 'terraform', to: 'invade' }]);

function renamedKey(raw: unknown) {
  return RENAMED.find(({ section: name, from }) => {
    const value: unknown = isRecord(raw) ? raw[name] : undefined;
    return value !== null && typeof value === 'object' && Object.hasOwn(value, from);
  });
}

function describeIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.join('.') || '(top level)';
  const keys = issue.code === 'unrecognized_keys' ? ` (unrecognized: ${issue.keys.join(', ')})` : '';
  return `${path}: ${issue.message}${keys}`;
}

/**
 * The migrations from one `kit:` format to the next (PRD 347), in order: `{ from, migrate(raw) → raw }`,
 * each keeping every value and returning a file one `kit:` higher. None yet: `CONFIG_VERSION` is 1.
 * `omni update` runs them on the parsed YAML, in memory, before checking it; the file itself is never
 * rewritten by an update.
 */
export const MIGRATIONS: readonly Migration[] = Object.freeze([]);

/** `raw` (parsed YAML) brought from its own `kit:` up through every migration that applies. */
export function migrateConfig(raw: unknown, migrations: readonly Migration[] = MIGRATIONS): unknown {
  let current = raw;
  for (const { from, migrate } of migrations) {
    if (isRecord(current) && current.kit === from) current = migrate(current);
  }
  return current;
}

/** Removes from `raw` every key a schema issue says it does not recognize; whether it removed any. */
function dropUnrecognized(raw: unknown, issues: readonly z.core.$ZodIssue[]): boolean {
  let dropped = false;
  for (const issue of issues) {
    if (issue.code !== 'unrecognized_keys') continue;
    let at: unknown = raw;
    for (const step of issue.path) at = isRecord(at) ? at[String(step)] : undefined;
    if (!isRecord(at)) continue;
    for (const key of issue.keys) {
      if (Object.hasOwn(at, key)) {
        Reflect.deleteProperty(at, key);
        dropped = true;
      }
    }
  }
  return dropped;
}

/** `raw` checked by the schema; with `ignoreUnknownKeys`, keys it does not know are dropped and it is checked again. */
function checkConfig(raw: unknown, ignoreUnknownKeys: boolean) {
  const result = ConfigSchema.safeParse(raw, { error: KIT_MESSAGES });
  if (result.success || !ignoreUnknownKeys) return result;
  const copy = structuredClone(raw);
  return dropUnrecognized(copy, result.error.issues) ? ConfigSchema.safeParse(copy, { error: KIT_MESSAGES }) : result;
}

/**
 * Parses config text. Throws ConfigError whose FIRST line names `file` and the first offending key —
 * the CLI prints only that line — and whose later lines list every other issue. With `migrate`, the
 * migration step runs first, as `omni update` checks a file written for an older kit. With
 * `ignoreUnknownKeys`, a key this kit does not know is left out instead of refused: a reader that may
 * run older code than the file was written for (the GitHub App's retro, just before its deploy, #1151)
 * reads what it knows.
 */
export function parseConfig(
  source: string,
  file: string = CONFIG_FILE,
  { migrate = false, ignoreUnknownKeys = false }: { migrate?: boolean; ignoreUnknownKeys?: boolean } = {},
): Config {
  let raw: unknown;
  try {
    raw = parse(source) ?? {};
  } catch (error) {
    throw new ConfigError(`${file}: not valid YAML — ${messageOf(error).split('\n')[0]}`, { invalid: true });
  }
  if (migrate) raw = migrateConfig(raw);
  const renamed = renamedKey(raw);
  if (renamed) {
    const { section: name, from, to } = renamed;
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${name}.${from} was renamed — call it ${name}.${to}`, { invalid: true });
  }
  const result = checkConfig(raw, ignoreUnknownKeys);
  if (!result.success) {
    const [first, ...others] = result.error.issues.map(describeIssue);
    const more = others.length ? `\n${others.map((line) => `  - ${line}`).join('\n')}` : '';
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${first}${more}`, { invalid: true });
  }
  const config = result.data;
  return { ...config, design: { ...config.design, screens: designScreensDir(config) } };
}

/** Reads `<root>/.omni-loop/config.yml`. */
export function loadConfig(root: string): Config {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new ConfigError(`This repository is not installed: ${CONFIG_FILE} is missing. Run \`omni-loop init\`.`);
  }
  return parseConfig(readFileSync(file, 'utf8'), CONFIG_FILE);
}
