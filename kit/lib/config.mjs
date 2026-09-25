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
    }),
    worktrees: text.default('.claude/worktrees'),
    paths: section({
      delivery: text.default('.omni-loop/delivery'),
      knowledge: text.default('.omni-loop/knowledge'),
      adr: text.default('.omni-loop/knowledge/adr'),
      glossary: nullableText.default(null),
      context: z.array(text).default(['CLAUDE.md']),
    }),
    labels: section({
      prd: text.default('prd'),
      phase0: text.default('pr:phase-0'),
      feature: text.default('pr:feature'),
      sub: text.default('pr:sub'),
      inProgress: text.default('pr:in-progress'),
      needsFix: text.default('pr:needs-fix'),
      outboxGo: text.default('outbox:go'),
      autoCreate: z.boolean().default(false),
    }),
    prLinks: section({
      feature: text.default('Closes #{prd}'),
      sub: text.default('Part of #{prd}'),
      phase0: text.default('Refs #{prd}'),
    }),
    board: section({ matchBy: z.enum(['base', 'label']).default('base') }),
    ci: section({
      outboxContext: text.default('ci/outbox'),
      aggregateCheck: nullableText.default(null),
      branchProtection: z.boolean().default(false),
      runner: text.default('ubuntu-latest'),
    }),
    commands: section({
      preflight: nullableText.default(null),
      preflightFull: nullableText.default(null),
      checks: z.array(text).default([]),
      test: nullableText.default(null),
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
    markers: section({ prefix: z.string().regex(/^[a-z][a-z0-9-]*$/, 'lowercase letters, digits and hyphens').default('omni-outbox') }),
  })
  .strict();

function describeIssue(issue) {
  const path = issue.path.join('.') || '(top level)';
  const keys = issue.code === 'unrecognized_keys' ? ` (unrecognized: ${issue.keys.join(', ')})` : '';
  return `${path}: ${issue.message}${keys}`;
}

/**
 * Parses config text. Throws ConfigError whose FIRST line names `file` and the first offending key —
 * the CLI prints only that line — and whose later lines list every other issue.
 */
export function parseConfig(source, file = CONFIG_FILE) {
  let raw;
  try {
    raw = parse(source) ?? {};
  } catch (error) {
    throw new ConfigError(`${file}: not valid YAML — ${error.message.split('\n')[0]}`);
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
    throw new ConfigError(`This repository is not terraformed: ${CONFIG_FILE} is missing. Run \`omni-loop init\`.`);
  }
  return parseConfig(readFileSync(file, 'utf8'), CONFIG_FILE);
}
