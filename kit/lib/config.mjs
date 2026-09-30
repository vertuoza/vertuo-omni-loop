// The one definition of `.omni-loop/config.yml`. Every repository-specific value the kit needs is a
// key here; a key that is not here does not exist, and a key the file has that is not here is an
// error, never ignored.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

export const CONFIG_FILE = '.omni-loop/config.yml';
export const CONFIG_VERSION = 1;

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

const text = z.string().min(1);
const nullableText = text.nullable();
const regexSource = z.string().refine((source) => {
  try { new RegExp(source); return true; } catch { return false; }
}, 'not a valid regular expression');
const section = (shape) => z.object(shape).strict().default({});
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
      feature: text.default('feat/{topic}'),
      fix: text.default('fix/{topic}'),
      phase0: text.default('docs/phase-0-{topic}'),
      slice: text.default('feat/{topic}--{slice}'),
      rework: text.default('fix-{item}'),
      retro: text.default('docs/retro-{topic}'),
      knowledge: text.default('docs/knowledge-{topic}'),
      invade: text.default('docs/omni-invade'),
      // PRD 347: the branch `omni update` opens its pull request from; `{version}` is `v<x.y.z>`.
      update: text.default('chore/omni-update-{version}'),
      // PRD 522: the branch `/omni:mega-invade` opens its one docs-only pull request from.
      megaInvade: text.default('docs/omni-mega-invade'),
      // PRD 686: the branch `/omni:think-big` records a concept on; `{topic}` is `<n>-<slug>`.
      concept: text.default('docs/concept-{topic}'),
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
      prd: text.default('omni:prd'),
      phase0: text.default('omni:phase-0'),
      feature: text.default('omni:feature'),
      sub: text.default('omni:sub'),
      inProgress: text.default('omni:in-progress'),
      needsFix: text.default('omni:needs-fix'),
      outboxGo: text.default('omni:outbox-go'),
      retro: text.default('omni:retro'),
      knowledge: text.default('omni:knowledge'),
      visual: text.default('omni:visual'),
      // PRD 556: the bug-fix lane's labels — the issue and its PR, a regression, and the triage's risk.
      bug: text.default('omni:bug'),
      regression: text.default('omni:regression'),
      riskCritical: text.default('omni:risk-critical'),
      riskHigh: text.default('omni:risk-high'),
      riskMedium: text.default('omni:risk-medium'),
      riskLow: text.default('omni:risk-low'),
      // PRD 686: a concept `/omni:think-big` records — its issue and its pull request.
      concept: text.default('omni:concept'),
      autoCreate: z.boolean().default(false),
    }),
    prLinks: section({
      feature: text.default('Closes #{prd}'),
      sub: text.default('Part of #{prd}'),
      phase0: text.default('Refs #{prd}'),
    }),
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
      .default({}),
    laws: section({
      source: z.enum(['knowledge', 'claudeMdInvariants', 'none']).default('none'),
      claudeMdHeading: text.default('## Invariants'),
    }),
    risk: section({
      storedShape: z.array(regexSource).default([]),
      sharedContract: z.array(text).default([]),
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
      beforeAfterMaxBytes: z.number().int().positive().default(512000),
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
    proof: section({
      url: proofUrl.nullable().default(null),
      setup: nullableText.default(null),
      bypassEnv: envName.nullable().default(null),
      maxSeconds: z.number().int().positive().default(60),
    }),
    markers: section({ prefix: z.string().regex(/^[a-z][a-z0-9-]*$/, 'lowercase letters, digits and hyphens').default('omni-outbox') }),
    // Who co-signs the loop's commits, pull requests and issues (`kit/lib/signature.mjs`). By
    // default the omni-loop GitHub App's bot account; `null` switches signing off. `footer` is a
    // template: `{name}` and `{home}` are filled from the keys they name, anything else is printed
    // as written. `home` defaults to the Omni Loop home page (ADR-0047).
    signature: z
      .object({
        name: trailerPart.default('Omni-man'),
        email: trailerPart.default('333776611+omni-loop-invader[bot]@users.noreply.github.com'),
        home: httpsUrl.default('https://vertuo-omni-loop-galaxy.vercel.app'),
        footer: text.default('🦸 {name} by [Omni Loop]({home}) ©'),
      })
      .strict()
      .nullable()
      .default({}),
    plan: planSection.optional(),
  })
  .strict();

/**
 * Whether dossiers are on in a repository (PRD 216): `dossier.enabled` is true and `ask.url` is set.
 * `reason` says why, in the words `omni dossier status` prints; `askUrl` is where the calls go.
 *
 * @returns {{ on: true, reason: string, askUrl: string } | { on: false, reason: string }}
 */
export function dossierSwitch(config) {
  if (!config.dossier.enabled) return { on: false, reason: 'dossier.enabled is false' };
  if (!config.ask.url) return { on: false, reason: 'ask.url is not set' };
  return { on: true, reason: `dossier.enabled is true in ${CONFIG_FILE}`, askUrl: config.ask.url };
}

/** Keys a config once held under another name (PRD #68): refused, naming the key that replaced them,
 * never read as an alias — a person set them by hand, and a clear error beats a silent alias. */
const RENAMED = Object.freeze([{ section: 'branches', from: 'terraform', to: 'invade' }]);

function renamedKey(raw) {
  return RENAMED.find(({ section: name, from }) => {
    const value = raw?.[name];
    return value !== null && typeof value === 'object' && Object.hasOwn(value, from);
  });
}

function describeIssue(issue) {
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
export const MIGRATIONS = Object.freeze([]);

/** `raw` (parsed YAML) brought from its own `kit:` up through every migration that applies. */
export function migrateConfig(raw, migrations = MIGRATIONS) {
  let current = raw;
  for (const { from, migrate } of migrations) {
    if (current?.kit === from) current = migrate(current);
  }
  return current;
}

/**
 * Parses config text. Throws ConfigError whose FIRST line names `file` and the first offending key —
 * the CLI prints only that line — and whose later lines list every other issue. With `migrate`, the
 * migration step runs first, as `omni update` checks a file written for an older kit.
 */
export function parseConfig(source, file = CONFIG_FILE, { migrate = false } = {}) {
  let raw;
  try {
    raw = parse(source) ?? {};
  } catch (error) {
    throw new ConfigError(`${file}: not valid YAML — ${error.message.split('\n')[0]}`);
  }
  if (migrate) raw = migrateConfig(raw);
  const renamed = renamedKey(raw);
  if (renamed) {
    const { section: name, from, to } = renamed;
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${name}.${from} was renamed — call it ${name}.${to}`);
  }
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const [first, ...others] = result.error.issues.map(describeIssue);
    const more = others.length ? `\n${others.map((line) => `  - ${line}`).join('\n')}` : '';
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${first}${more}`);
  }
  return result.data;
}

/** Reads `<root>/.omni-loop/config.yml`. */
export function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new ConfigError(`This repository is not installed: ${CONFIG_FILE} is missing. Run \`omni-loop init\`.`);
  }
  return parseConfig(readFileSync(file, 'utf8'), CONFIG_FILE);
}
