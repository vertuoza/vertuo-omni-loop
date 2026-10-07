// The one definition of `.omni-loop/config.yml`. Every repository-specific value the kit needs is a
// key here; a key that is not here does not exist, and a key the file has that is not here is an
// error, never ignored. `kit/lib/schema/config.ts` names it beside the kit's other schemas.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { messageOf } from './narrow.ts';
import { FlowSchema, hooksByMode, regexSource } from './flow/schema.ts';
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

// PRD 522: what a plan repository knows of each target repository's knowledge base.
export const TARGET_KNOWLEDGE = Object.freeze(['own', 'imported', 'none']);

const target = z
  .object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
    role: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'one kebab-case word, such as back-end'),
    knowledge: z.enum(TARGET_KNOWLEDGE),
    readAt: z.string().regex(/^[0-9a-f]{40}$/, 'the full 40-character commit the copy was read at').nullable().default(null),
  })
  .strict();

// A plan repository's own section (PRD 522): the page saying which repository does what, pointed at
// and never copied, and its target repositories. Optional: a config without it is no plan repository,
// and parses with no `plan` key at all.
const planSection = z
  .object({
    guide: nullableText.default(null),
    targets: z.array(target).min(1, 'at least one target'),
  })
  .strict()
  .superRefine(({ targets }, issues) => {
    const seen = new Set();
    targets.forEach(({ repo, knowledge, readAt }, index) => {
      if (seen.has(repo)) issues.addIssue({ code: 'custom', path: ['targets', index, 'repo'], message: `${repo} is listed twice` });
      seen.add(repo);
      if (knowledge === 'imported' && readAt === null) {
        issues.addIssue({ code: 'custom', path: ['targets', index, 'readAt'], message: 'required when knowledge is imported' });
      }
      if (knowledge !== 'imported' && readAt !== null) {
        issues.addIssue({ code: 'custom', path: ['targets', index, 'readAt'], message: `only an imported target has one, and this one is ${knowledge}` });
      }
    });
  });

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
    }),
    worktrees: text.default('.claude/worktrees'),
    paths: section({
      delivery: text.default('.omni-loop/delivery'),
      knowledge: text.default('.omni-loop/knowledge'),
      adr: text.default('.omni-loop/knowledge/adr'),
      playbook: text.default('.omni-loop/knowledge/playbook'),
      glossary: nullableText.default(null),
      context: z.array(text).default(['CLAUDE.md']),
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
      aggregateCheck: nullableText.default(null),
      branchProtection: z.boolean().default(false),
      runner: text.default('ubuntu-latest'),
    }),
    commands: section({
      preflight: nullableText.default(null),
      preflightFull: nullableText.default(null),
      checks: z.array(text).default([]),
      test: nullableText.default(null),
      // PRD 556: the command that runs mutation testing on the changed lines; `null` means none here.
      mutation: nullableText.default(null),
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
      claudeMdHeading: text.default('## Invariants'),
    }),
    risk: section({
      storedShape: z.array(regexSource).default([]),
      sharedContract: z.array(text).default([]),
    }),
    // Landings: the paths that must reach the default branch in a landing of their own (a
    // repository's migrations directories, say). Regex sources over repository paths, compiled once
    // by `omni plan check`; empty, no plan is refused for what it puts together.
    landings: section({ alone: z.array(regexSource).default([]) }),
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
      beforeAfterMaxBytes: z.number().int().positive().default(512000),
      // PRD 1089: the size a flow hook file may reach. Left out, `DEFAULT_HOOK_MAX_BYTES` applies,
      // and a config that does not set it parses exactly as before.
      hookMaxBytes: z.number().int().positive().optional(),
    }),
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
  })
  .strict()
  .superRefine(({ pr, flow }, issues) => {
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
  return result.data;
}

/** Reads `<root>/.omni-loop/config.yml`. */
export function loadConfig(root: string): Config {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new ConfigError(`This repository is not installed: ${CONFIG_FILE} is missing. Run \`omni-loop init\`.`);
  }
  return parseConfig(readFileSync(file, 'utf8'), CONFIG_FILE);
}
