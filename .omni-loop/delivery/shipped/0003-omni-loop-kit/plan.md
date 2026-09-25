# Omni Loop kit — Phase 1: `kit/lib` and `kit/bin` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the delivery loop's library (inbox, outbox, settling, replies, comments, knowledge
registers, policies) from `vertuo-ai-domain` into `kit/lib` so that every repository-specific value is
read from `.omni-loop/config.yml`, add the ship step and the two gate fixes, and expose it all as one
bundled, dependency-free `omni.mjs` CLI.

**Architecture:** Every ported function that used a module-level path, marker, label or repo slug
takes a frozen **context** `ctx = { root, config, layout, markers }` instead. `config` is the parsed
`.omni-loop/config.yml`; `layout` answers every "where does PRD N live" question for the one-folder-
per-PRD delivery layout; `markers` derives every HTML-comment marker from one prefix. Upstream tests
are ported with a *flat* test-only layout and the `vertuo-outbox` marker prefix, so their assertions
stay byte-identical and prove the port; each module then gets folder-layout tests of its own.

**Tech Stack:** Node ≥ 22 ESM (`.mjs`), `zod` 3, `yaml` 2, `vitest` 2, `esbuild` (bundling only),
`gh` CLI (called only from `kit/bin`), `git`.

**Spec:** `spec.md`, beside this plan (`.omni-loop/delivery/shipped/0003-omni-loop-kit/`). **PRD:** #3. (§3–§8, §11, §13 phase 1).

## Global Constraints

- Upstream source is pinned: `vertuo-ai-domain` at **`c4a210122`**, read with
  `git -C ../vertuo-ai-domain show c4a210122:<path>`. Never port from the working tree (stale at
  `c214b06b`) or from `vertuo-workflow`.
- No repository literal in `kit/lib` or `kit/bin`: no `vertuo`, no `docs/` path, no `repoRoot`, no
  `pierrederval`, no `outbox:go`/`pr:feature` string literal. The only exception is the one-line
  provenance comment. `kit/test/no-literals.test.mjs` (Task 1) enforces this.
- Config file: `.omni-loop/config.yml`, schema version `kit: 1`, unknown keys rejected.
- Delivery layout (folders): `<paths.delivery>/{inbox,outbox,shipped,archive}/<prd>-<topic>/`;
  `<prd>` zero-padded to **at least** four digits; `<topic>` kebab-case; inside a PRD folder:
  `spec.md`, `plan.md`, `before-after.html`; a shipped PRD's outbox is `shipped/<prd>-<topic>/outbox/`.
- Marker prefix default `omni-outbox`: `<!-- omni-outbox -->`, `<!-- omni-outbox-settled: <id> -->`.
- Command names live in one constant, `kit/lib/commands.mjs`: `/omni-brainstorm`, `/omni-yolo`,
  `/omni-yolo-fix`, `/omni-deliver`.
- Verdicts `agreed | drifted | adopted`; ranks `human-action > high > medium`; `settled.md` is
  append-only and never rewritten by the ship step.
- No front matter carries `status`, `branch`, `value` or `priority`.
- `kit/lib` does no network I/O. GitHub is reached only through an injected client; the production
  client (`gh` via `execFileSync`) lives in `kit/bin`.
- Tests: `vitest`, one `*.test.mjs` beside each module, temp directories via `mkdtempSync`, never the
  real repository.
- Commits: Conventional Commits, scope `kit`, one per task at minimum.

## Port Protocol (applies to every task marked **Port**)

A port task copies an upstream module and its test, then applies these rules and nothing else:

1. **Fetch** both files verbatim:
   `git -C ../vertuo-ai-domain show c4a210122:<src>.mjs > kit/lib/<dst>.mjs` and the same for
   `<src>.test.mjs` → `kit/lib/<dst>.test.mjs`.
2. **Provenance.** Directly under the module's header comment add
   `// Ported from vertuo-ai-domain@c4a210122:<src>.mjs — changes in kit/porting/<dst>.md.`
3. **No CLI half.** Delete the `if (process.argv[1] === fileURLToPath(import.meta.url)) { … }` block
   and every function or constant used only by it. Task 15 rebuilds the CLI.
4. **Context, not root.** Every `{ root = repoRoot } = {}` option becomes `{ ctx }`; inside, `root`
   becomes `ctx.root`. Delete `here`/`repoRoot`. A pure function that took no root and used a
   constant now covered by `ctx` takes the narrowest thing it needs as a new trailing parameter
   (`markers`, `laws`, `labels`) — never the whole `ctx` when one field suffices.
5. **Literals → context**, per the task's own mapping table.
6. **Tests keep their assertions.** In the test file, replace `{ root }` with `{ ctx }` where
   `ctx = flatCtx(root)` (`kit/test/flat-layout.mjs`, Task 2), fix import paths, and pass `markers`
   /`laws` where a signature grew. An `expect(...)` may change only where it names a literal the
   task's mapping table replaced; list each such change in `kit/porting/<dst>.md`. A test case that reads
   the real upstream repository (`realRepoRoot`, `THE_PLAN`, real `docs/`) is deleted and listed.
7. **Record** `kit/porting/<dst>.md` (one file per module, so no two slices share it; `<dst>` with `/` replaced by `--`): source path, sha, every mapping applied,
   every assertion changed, every test deleted.
8. **Gate:** `pnpm vitest run kit/lib/<dst>.test.mjs kit/test/no-literals.test.mjs` passes.

## Review Focus

1. A mistyped key in `.omni-loop/config.yml` (`outboxgo:` for `outboxGo:`) must stop every command
   with the file, the key path and "unrecognized", never silently fall back to a default. → Task 1.
2. PRD numbers of any width: `omni prd 42` must find `0042-topic/`, and PRD `12345` must find
   `12345-topic/` (padding is a minimum, not a width). → Task 2.
3. Two ADR files with the same number (`0076-a.md`, `0076-b.md` — this exists upstream) make
   `bears-on: ADR-0076` ambiguous: it must fail resolution naming both files, not pick one. → Task 4.
4. Shipping a PRD that never raised a single outbox item (no `outbox/<prd>-<topic>/` folder), and
   shipping one whose `settled.md` contains links to its own inbox path: the first must succeed, the
   second must leave `settled.md` byte-identical. → Task 14.
5. The bundled `omni.mjs` run in a repository with no `node_modules`, and run outside any git
   repository or in one with no `.omni-loop/config.yml`: the first works; the other two print one
   line naming the problem and exit 2, no stack trace. → Task 15.

## Slices

The loop's slice table (the shape `check-territory` parses): each task is a slice, a sub-PR into
`feat/omni-loop-kit`. Territory is what the slice may touch; two slices in one wave never share
ground. Every slice also touches `package.json`/`pnpm-lock.yaml` only if it says so here, and none
touches another slice's `kit/porting/` file.

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Config schema and the no-literals guard | `kit/lib/config.mjs` `kit/lib/config.test.mjs` `kit/test/no-literals.test.mjs` `kit/porting/README.md` `vitest.config.mjs` `package.json` `pnpm-lock.yaml` `.omni-loop/delivery/shipped/0003-omni-loop-kit/spec.md` | — | 1 |
| s2 | Context, layout, markers, fixtures | `kit/lib/layout.mjs` `kit/lib/layout.test.mjs` `kit/lib/markers.mjs` `kit/lib/markers.test.mjs` `kit/lib/commands.mjs` `kit/lib/context.mjs` `kit/lib/context.test.mjs` `kit/test/fixture.mjs` `kit/test/flat-layout.mjs` | s1 | 2 |
| s3 | Knowledge registers | `kit/lib/knowledge/` `kit/lib/check-report.mjs` `kit/porting/knowledge--registers.md` `kit/porting/knowledge--check-knowledge.md` `kit/porting/knowledge--describe.md` `kit/porting/check-report.md` | s2 | 3 |
| s4 | Laws | `kit/lib/laws.mjs` `kit/lib/laws.test.mjs` | s3 | 4 |
| s5 | Outbox item parser | `kit/lib/outbox/outbox.mjs` `kit/lib/outbox/outbox.test.mjs` `kit/porting/outbox--outbox.md` | s4 | 5 |
| s6 | Settling | `kit/lib/outbox/settle.mjs` `kit/lib/outbox/settle.test.mjs` `kit/porting/outbox--settle.md` | s5 | 6 |
| s12 | Inbox, status, territory, collisions | `kit/lib/inbox/` `kit/porting/inbox--inbox.md` `kit/porting/inbox--check-inbox.md` `kit/porting/inbox--status.md` `kit/porting/inbox--territory.md` `kit/porting/inbox--collisions.md` | s3 | 6 |
| s7 | check-outbox, Became: and shipped checks | `kit/lib/outbox/check-outbox.mjs` `kit/lib/outbox/check-outbox.test.mjs` `kit/porting/outbox--check-outbox.md` | s6 | 7 |
| s8 | Decision coverage and accounts | `kit/lib/outbox/decision-coverage.mjs` `kit/lib/outbox/decision-coverage.test.mjs` `kit/lib/outbox/account.mjs` `kit/lib/outbox/account.test.mjs` `kit/lib/outbox/check-decision-coverage.mjs` `kit/lib/outbox/check-decision-coverage.test.mjs` `kit/lib/git.mjs` `kit/porting/outbox--decision-coverage.md` `kit/porting/outbox--account.md` `kit/porting/outbox--check-decision-coverage.md` | s6 | 7 |
| s10 | Reply intake | `kit/lib/outbox/replies.mjs` `kit/lib/outbox/replies.test.mjs` `kit/porting/outbox--replies.md` | s6 | 7 |
| s9 | The gate, red while drift is unreworked | `kit/lib/outbox/status.mjs` `kit/lib/outbox/status.test.mjs` `kit/lib/outbox/settle-head.mjs` `kit/lib/outbox/settle-head.test.mjs` `kit/porting/outbox--status.md` `kit/porting/outbox--settle-head.md` | s8 | 8 |
| s11 | Outbox comments and Slack | `kit/lib/outbox/comment.mjs` `kit/lib/outbox/comment.test.mjs` `kit/porting/outbox--comment.md` | s8 | 8 |
| s13 | Policies: recording, rework, phase-0 | `kit/lib/policy/` `kit/porting/policy--outbox-policy.md` `kit/porting/policy--rework.md` `kit/porting/policy--phase-0.md` | s8, s12 | 8 |
| s14 | Ship step and prd lookup | `kit/lib/delivery/` | s9 | 9 |
| s15 | The omni CLI and its bundle | `kit/bin/` `kit/build.mjs` `.gitignore` | s10, s11, s13, s14 | 10 |
| s16 | Three profiles, end to end | `kit/test/profiles.test.mjs` | s15 | 11 |

Task N in the body below is slice sN.

---

### Task 1: Scaffold `kit/` and the config schema

**Files:**
- Create: `kit/lib/config.mjs`, `kit/lib/config.test.mjs`
- Create: `kit/test/no-literals.test.mjs`
- Create: `kit/porting/README.md`
- Modify: `vitest.config.mjs`, `package.json`
- Modify: `.omni-loop/delivery/shipped/0003-omni-loop-kit/spec.md` §4 (add `risk:` block)

**Interfaces:**
- Produces: `CONFIG_FILE: string`, `CONFIG_VERSION: 1`, `ConfigSchema` (zod), `class ConfigError
  extends Error`, `parseConfig(text: string, file?: string): Config`, `loadConfig(root: string): Config`.
  `Config` is `z.infer<typeof ConfigSchema>`; every section is always present after parsing.

- [ ] **Step 1: Wire vitest and scripts**

`vitest.config.mjs`:
```js
export default { test: { include: ['game/**/*.test.mjs', 'kit/**/*.test.mjs'] } };
```
`package.json` — add to `scripts`: `"kit:build": "node kit/build.mjs"`; add to `devDependencies`:
`"esbuild": "^0.24.0"`. Run `pnpm install`.

- [ ] **Step 2: Write the no-literals guard**

`kit/test/no-literals.test.mjs`:
```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));
const SCANNED = ['lib', 'bin'];
const FORBIDDEN = [/vertuo/i, /\bdocs\//, /\brepoRoot\b/, /pierrederval/, /'outbox:go'/, /'pr:feature'/];
const PROVENANCE = /^\/\/ Ported from vertuo-ai-domain@/;

function files(dir) {
  let out = [];
  let names = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(files(path));
    else if (name.endsWith('.mjs') && !name.endsWith('.test.mjs')) out.push(path);
  }
  return out;
}

describe('kit source carries no repository literal', () => {
  it('finds none outside provenance lines', () => {
    const hits = [];
    for (const dir of SCANNED) {
      for (const file of files(join(kitRoot, dir))) {
        readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
          if (PROVENANCE.test(line.trim())) return;
          for (const pattern of FORBIDDEN) {
            if (pattern.test(line)) hits.push(`${relative(kitRoot, file)}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 3: Write the failing config tests**

`kit/lib/config.test.mjs`:
```js
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_FILE, ConfigError, loadConfig, parseConfig } from './config.mjs';

describe('parseConfig', () => {
  it('fills every section from defaults when only the version is given', () => {
    const config = parseConfig('kit: 1\n');
    expect(config.paths.delivery).toBe('.omni-loop/delivery');
    expect(config.paths.knowledge).toBe('.omni-loop/knowledge');
    expect(config.labels.outboxGo).toBe('outbox:go');
    expect(config.markers.prefix).toBe('omni-outbox');
    expect(config.laws.source).toBe('none');
    expect(config.ci.outboxContext).toBe('ci/outbox');
    expect(config.limits).toEqual({ stallDays: 5, attempts: 3, claimStaleMinutes: 60, beforeAfterMaxBytes: 512000 });
    expect(config.risk).toEqual({ storedShape: [], sharedContract: [] });
    expect(config.notify.slack).toBeNull();
  });

  it('refuses a missing or wrong schema version', () => {
    expect(() => parseConfig('repo: {}\n', 'c.yml')).toThrow(/c\.yml.*kit/s);
    expect(() => parseConfig('kit: 2\n', 'c.yml')).toThrow(ConfigError);
  });

  it('names the file, the key path and the unknown key for a typo', () => {
    let error;
    try { parseConfig('kit: 1\nlabels:\n  outboxgo: go\n', '.omni-loop/config.yml'); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.message).toContain('.omni-loop/config.yml');
    expect(error.message).toContain('labels');
    expect(error.message).toContain('outboxgo');
  });

  it('refuses acceptance enabled without a directory', () => {
    expect(() => parseConfig('kit: 1\nacceptance:\n  enabled: true\n')).toThrow(/acceptance\.dir/);
  });

  it('refuses a risk pattern that is not a regular expression', () => {
    expect(() => parseConfig("kit: 1\nrisk:\n  storedShape: ['(']\n")).toThrow(/risk\.storedShape\.0/);
  });

  it('refuses a marker prefix that could break an HTML comment', () => {
    expect(() => parseConfig('kit: 1\nmarkers:\n  prefix: "a -->"\n')).toThrow(/markers\.prefix/);
  });

  it('reports YAML syntax errors with the file', () => {
    expect(() => parseConfig('kit: [1\n', 'x.yml')).toThrow(/x\.yml/);
  });
});

describe('loadConfig', () => {
  it('says the repository is not terraformed when the file is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'cfg-'));
    expect(() => loadConfig(root)).toThrow(/not terraformed.*\.omni-loop\/config\.yml/s);
  });

  it('reads the file under root', () => {
    const root = mkdtempSync(join(tmpdir(), 'cfg-'));
    mkdirSync(join(root, '.omni-loop'));
    writeFileSync(join(root, CONFIG_FILE), 'kit: 1\nrepo:\n  slug: acme/widgets\n');
    expect(loadConfig(root).repo.slug).toBe('acme/widgets');
  });
});
```

- [ ] **Step 4: Run to see them fail**

Run: `pnpm vitest run kit/lib/config.test.mjs`
Expected: FAIL — `Cannot find module './config.mjs'`.

- [ ] **Step 5: Implement `kit/lib/config.mjs`**

```js
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
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run kit/lib/config.test.mjs kit/test/no-literals.test.mjs`
Expected: PASS. If the `labels.outboxgo` case fails because zod reports the path as `labels` with
`keys: ['outboxgo']`, that is what `describeIssues` prints — the assertion checks both substrings.

- [ ] **Step 7: Amend the spec and start the porting record**

In the spec §4 YAML, after the `laws:` block, add:
```yaml
risk:                                # decision-coverage rules specific to this repository
  storedShape: []                    # regex sources: a persisted schema changed (e.g. '^libs/[^/]+/src/server/migrations\.ts$')
  sharedContract: []                 # path prefixes other repositories read (e.g. 'libs/system-api-contract/')
```
Create `kit/porting/README.md`:
```markdown
# Porting record

Every module under `kit/lib` that came from `vertuo-ai-domain` has one file here, named after it: its source, the
pinned sha (`c4a210122`), every literal replaced by the context, every test assertion changed and
every test deleted. A reviewer reads this beside the diff against upstream.
```

- [ ] **Step 8: Commit**

```bash
git add vitest.config.mjs package.json pnpm-lock.yaml kit .omni-loop/delivery/shipped/0003-omni-loop-kit/spec.md
git commit -m "feat(kit): the .omni-loop/config.yml schema and the no-literals guard"
```

---

### Task 2: Context, layout, markers, commands, and the test fixtures

**Files:**
- Create: `kit/lib/layout.mjs`, `kit/lib/layout.test.mjs`
- Create: `kit/lib/markers.mjs`, `kit/lib/markers.test.mjs`
- Create: `kit/lib/commands.mjs`
- Create: `kit/lib/context.mjs`, `kit/lib/context.test.mjs`
- Create: `kit/test/fixture.mjs`, `kit/test/flat-layout.mjs`

**Interfaces:**
- Consumes: `ConfigSchema`, `loadConfig`, `ConfigError` (Task 1).
- Produces:
  - `padPrd(prd: number|string): string` — at least four digits.
  - `parseFolderName(name: string): { prd: number, topic: string } | null`.
  - `foldersLayout(root: string, paths: Config['paths']): Layout` where `Layout` is
    `{ kind, dirs: { inbox, outbox, shipped, archive }, adrDir, knowledgeRoot,
    whereIs(prd) → { name, state: 'inbox'|'shipped', dir } | null, specPath(prd), planPath(prd),
    beforeAfterPath(prd), outboxDir(prd) → string|null, outboxDirs() → { prd, dir, shipped }[],
    specFiles() → string[] }`. All paths repo-relative with `/`.
  - `makeMarkers(prefix): Markers` — `{ prefix, any, comment, prComment, settledOpen(id),
    settledClose(id), settledOpenRe, announcedPrefix, announcedSuffix, announcedRe, numbersPrefix,
    numbersSuffix, numbersRe, round(n, numbers), roundRe }`.
  - `COMMANDS = { brainstorm, yolo, yoloFix, deliver }`.
  - `createContext(root, config): Ctx` (frozen `{ root, config, layout, markers }`),
    `loadContext(cwd?, { exec? }): Ctx`, `slugFromRemote(url): string|null`.
  - Test-only: `makeRepo({ files?, config?, git? }) → { root, ctx, write(path, text), read(path) }`,
    `testContext(root, overrides?) → Ctx`, `deepMerge(a, b)`, `flatLayout(root)`,
    `flatCtx(root, overrides?) → Ctx`.

- [ ] **Step 1: Write the failing layout tests**

`kit/lib/layout.test.mjs`:
```js
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { foldersLayout, padPrd, parseFolderName } from './layout.mjs';

const PATHS = { delivery: '.omni-loop/delivery', knowledge: '.omni-loop/knowledge', adr: 'docs-adr', glossary: null, context: [] };

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'layout-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('padPrd / parseFolderName', () => {
  it('pads to at least four digits and never truncates', () => {
    expect(padPrd(42)).toBe('0042');
    expect(padPrd('985')).toBe('0985');
    expect(padPrd(12345)).toBe('12345');
  });
  it('parses a PRD folder name and refuses anything else', () => {
    expect(parseFolderName('0042-delivery-folder')).toEqual({ prd: 42, topic: 'delivery-folder' });
    expect(parseFolderName('12345-x')).toEqual({ prd: 12345, topic: 'x' });
    expect(parseFolderName('42-short')).toBeNull();
    expect(parseFolderName('README.md')).toBeNull();
    expect(parseFolderName('0042-Bad_Topic')).toBeNull();
  });
});

describe('foldersLayout', () => {
  it('finds a PRD in the inbox whatever width it is asked with', () => {
    const root = tree({ '.omni-loop/delivery/inbox/0042-topic/spec.md': 'x' });
    const layout = foldersLayout(root, PATHS);
    expect(layout.whereIs(42)).toEqual({ name: '0042-topic', state: 'inbox', dir: '.omni-loop/delivery/inbox/0042-topic' });
    expect(layout.whereIs('0042')?.name).toBe('0042-topic');
    expect(layout.specPath(42)).toBe('.omni-loop/delivery/inbox/0042-topic/spec.md');
    expect(layout.planPath(42)).toBe('.omni-loop/delivery/inbox/0042-topic/plan.md');
    expect(layout.beforeAfterPath(42)).toBe('.omni-loop/delivery/inbox/0042-topic/before-after.html');
  });

  it('puts an in-flight outbox beside the inbox folder, named the same, even before it exists', () => {
    const root = tree({ '.omni-loop/delivery/inbox/0042-topic/spec.md': 'x' });
    expect(foldersLayout(root, PATHS).outboxDir(42)).toBe('.omni-loop/delivery/outbox/0042-topic');
  });

  it('puts a shipped outbox inside the shipped folder', () => {
    const root = tree({ '.omni-loop/delivery/shipped/0042-topic/outbox/settled.md': 'x' });
    const layout = foldersLayout(root, PATHS);
    expect(layout.whereIs(42).state).toBe('shipped');
    expect(layout.outboxDir(42)).toBe('.omni-loop/delivery/shipped/0042-topic/outbox');
  });

  it('returns null for a PRD it cannot find anywhere', () => {
    expect(foldersLayout(tree({}), PATHS).whereIs(7)).toBeNull();
    expect(foldersLayout(tree({}), PATHS).outboxDir(7)).toBeNull();
  });

  it('lists every outbox, in flight and shipped, and ignores READMEs', () => {
    const root = tree({
      '.omni-loop/delivery/outbox/README.md': 'x',
      '.omni-loop/delivery/outbox/0042-a/s1-01-x.md': 'x',
      '.omni-loop/delivery/shipped/0007-b/outbox/settled.md': 'x',
      '.omni-loop/delivery/shipped/0008-c/spec.md': 'x',
    });
    expect(foldersLayout(root, PATHS).outboxDirs()).toEqual([
      { prd: 42, dir: '.omni-loop/delivery/outbox/0042-a', shipped: false },
      { prd: 7, dir: '.omni-loop/delivery/shipped/0007-b/outbox', shipped: true },
    ]);
  });

  it('lists the spec path of every inbox folder, present or not', () => {
    const root = tree({ '.omni-loop/delivery/inbox/0001-a/spec.md': 'x', '.omni-loop/delivery/inbox/0002-b/plan.md': 'x' });
    expect(foldersLayout(root, PATHS).specFiles()).toEqual([
      '.omni-loop/delivery/inbox/0001-a/spec.md',
      '.omni-loop/delivery/inbox/0002-b/spec.md',
    ]);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run kit/lib/layout.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `kit/lib/layout.mjs`**

```js
// Where a PRD lives. The folder is the status: `inbox/<prd>-<topic>/` is approved and not shipped,
// `shipped/<prd>-<topic>/` is merged. Every other module asks this one and never builds a delivery
// path itself.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function padPrd(prd) {
  return String(Number(prd)).padStart(4, '0');
}

export function parseFolderName(name) {
  const match = FOLDER.exec(name);
  return match ? { prd: Number(match[1]), topic: match[2] } : null;
}

export function foldersLayout(root, paths) {
  const base = paths.delivery;
  const dirs = {
    inbox: `${base}/inbox`,
    outbox: `${base}/outbox`,
    shipped: `${base}/shipped`,
    archive: `${base}/archive`,
  };

  function folders(dir) {
    const absolute = join(root, dir);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && parseFolderName(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  function find(dir, prd) {
    const wanted = Number(prd);
    return folders(dir).find((name) => parseFolderName(name).prd === wanted) ?? null;
  }

  function whereIs(prd) {
    const inbox = find(dirs.inbox, prd);
    if (inbox) return { name: inbox, state: 'inbox', dir: `${dirs.inbox}/${inbox}` };
    const shipped = find(dirs.shipped, prd);
    if (shipped) return { name: shipped, state: 'shipped', dir: `${dirs.shipped}/${shipped}` };
    return null;
  }

  const inFolder = (file) => (prd) => {
    const where = whereIs(prd);
    return where ? `${where.dir}/${file}` : null;
  };

  return Object.freeze({
    kind: 'folders',
    dirs,
    adrDir: paths.adr,
    knowledgeRoot: paths.knowledge,
    whereIs,
    specPath: inFolder('spec.md'),
    planPath: inFolder('plan.md'),
    beforeAfterPath: inFolder('before-after.html'),
    outboxDir(prd) {
      const where = whereIs(prd);
      if (where?.state === 'shipped') return `${where.dir}/outbox`;
      if (where) return `${dirs.outbox}/${where.name}`;
      const orphan = find(dirs.outbox, prd);
      return orphan ? `${dirs.outbox}/${orphan}` : null;
    },
    outboxDirs() {
      const out = folders(dirs.outbox).map((name) => ({ prd: parseFolderName(name).prd, dir: `${dirs.outbox}/${name}`, shipped: false }));
      for (const name of folders(dirs.shipped)) {
        const dir = `${dirs.shipped}/${name}/outbox`;
        if (existsSync(join(root, dir))) out.push({ prd: parseFolderName(name).prd, dir, shipped: true });
      }
      return out;
    },
    specFiles() {
      return folders(dirs.inbox).map((name) => `${dirs.inbox}/${name}/spec.md`);
    },
  });
}
```

- [ ] **Step 4: Run layout tests** — `pnpm vitest run kit/lib/layout.test.mjs` — Expected: PASS.

- [ ] **Step 5: Markers and commands, test first**

`kit/lib/markers.test.mjs`:
```js
import { describe, expect, it } from 'vitest';
import { makeMarkers } from './markers.mjs';

describe('makeMarkers', () => {
  it('reproduces upstream markers byte for byte with the vertuo-outbox prefix', () => {
    const m = makeMarkers('vertuo-outbox');
    expect(m.comment).toBe('<!-- vertuo-outbox -->');
    expect(m.prComment).toBe('<!-- vertuo-outbox-pr -->');
    expect(m.settledOpen('s1-01-x')).toBe('<!-- vertuo-outbox-settled: s1-01-x -->');
    expect(m.settledClose('s1-01-x')).toBe('<!-- /vertuo-outbox-settled: s1-01-x -->');
    expect('<!-- vertuo-outbox-settled: s1-01-x -->').toMatch(m.settledOpenRe);
    expect(m.round(2, [1, 3])).toBe('<!-- vertuo-outbox-round: 2 1,3 -->');
    expect('<!-- vertuo-outbox-round: 2 1,3 -->'.match(m.roundRe).slice(1)).toEqual(['2', '1,3']);
    expect('<!-- vertuo-outbox-numbers: {"a":1} -->'.match(m.numbersRe)[1]).toBe('{"a":1}');
    expect('<!-- vertuo-outbox-announced: a,b -->'.match(m.announcedRe)[1]).toBe('a,b');
  });
  it('uses the configured prefix', () => {
    expect(makeMarkers('omni-outbox').settledOpen('x')).toBe('<!-- omni-outbox-settled: x -->');
  });
});
```
`kit/lib/markers.mjs`:
```js
// Every HTML-comment marker the outbox writes, derived from one configured prefix. The regexes carry
// no flags, exactly as upstream's literals did.
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeMarkers(prefix) {
  const p = escape(prefix);
  return Object.freeze({
    prefix,
    any: `<!-- ${prefix}`,
    comment: `<!-- ${prefix} -->`,
    prComment: `<!-- ${prefix}-pr -->`,
    settledOpen: (id) => `<!-- ${prefix}-settled: ${id} -->`,
    settledClose: (id) => `<!-- /${prefix}-settled: ${id} -->`,
    settledOpenRe: new RegExp(`^<!-- ${p}-settled: (.+?) -->$`),
    announcedPrefix: `<!-- ${prefix}-announced: `,
    announcedSuffix: ' -->',
    announcedRe: new RegExp(`<!-- ${p}-announced: (.*?) -->`),
    numbersPrefix: `<!-- ${prefix}-numbers: `,
    numbersSuffix: ' -->',
    numbersRe: new RegExp(`<!-- ${p}-numbers: (.*?) -->`),
    round: (n, numbers) => `<!-- ${prefix}-round: ${n} ${numbers.join(',')} -->`,
    roundRe: new RegExp(`<!-- ${p}-round: (\\d+) ([\\d,]*) -->`),
  });
}
```
`kit/lib/commands.mjs`:
```js
// The slash commands the kit's messages name. One place, because the plugin's namespacing
// (spec §9, open) may still change how they are typed.
export const COMMANDS = Object.freeze({
  brainstorm: '/omni-brainstorm',
  yolo: '/omni-yolo',
  yoloFix: '/omni-yolo-fix',
  deliver: '/omni-deliver',
});
```

- [ ] **Step 6: Context, test first**

`kit/lib/context.test.mjs`:
```js
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadContext, slugFromRemote } from './context.mjs';

describe('slugFromRemote', () => {
  it.each([
    ['git@github.com:vertuoza/some-repo.git', 'vertuoza/some-repo'],
    ['https://github.com/acme/widgets.git', 'acme/widgets'],
    ['https://github.com/acme/widgets', 'acme/widgets'],
    ['ssh://git@github.com/acme/widgets.git', 'acme/widgets'],
    ['/local/path', null],
  ])('%s → %s', (url, slug) => expect(slugFromRemote(url)).toBe(slug));
});

describe('loadContext', () => {
  it('refuses a directory outside any git repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctx-'));
    expect(() => loadContext(dir)).toThrow(/not inside a git repository/);
  });

  it('fills the slug from the remote when the config leaves it null', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctx-'));
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:acme/widgets.git'], { cwd: root });
    mkdirSync(join(root, '.omni-loop'));
    writeFileSync(join(root, '.omni-loop/config.yml'), 'kit: 1\n');
    const ctx = loadContext(join(root));
    expect(ctx.config.repo.slug).toBe('acme/widgets');
    expect(ctx.layout.dirs.inbox).toBe('.omni-loop/delivery/inbox');
    expect(ctx.markers.comment).toBe('<!-- omni-outbox -->');
    expect(Object.isFrozen(ctx)).toBe(true);
  });
});
```
`kit/lib/context.mjs`:
```js
// The one object every kit function receives instead of a repository root: where the repository is,
// what its config says, where its PRDs live, and which markers its comments carry.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { ConfigError, loadConfig } from './config.mjs';
import { foldersLayout } from './layout.mjs';
import { makeMarkers } from './markers.mjs';

export function createContext(root, config) {
  return Object.freeze({
    root,
    config,
    layout: foldersLayout(root, config.paths),
    markers: makeMarkers(config.markers.prefix),
  });
}

export function slugFromRemote(url) {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

export function loadContext(cwd = process.cwd(), { exec = execFileSync } = {}) {
  let root;
  try {
    root = exec('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new ConfigError(`${cwd} is not inside a git repository.`);
  }
  root = realpathSync(root);
  let config = loadConfig(root);
  if (config.repo.slug === null) {
    let url = '';
    try {
      url = exec('git', ['remote', 'get-url', config.repo.remote], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      url = '';
    }
    config = { ...config, repo: { ...config.repo, slug: slugFromRemote(url) } };
  }
  return createContext(root, config);
}
```

- [ ] **Step 7: Test fixtures (no tests of their own; every later task uses them)**

`kit/test/fixture.mjs`:
```js
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ConfigSchema } from '../lib/config.mjs';
import { createContext } from '../lib/context.mjs';

export function deepMerge(base, over) {
  if (Array.isArray(over) || over === null || typeof over !== 'object') return over;
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = base && typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])
      ? deepMerge(base[key], value)
      : value;
  }
  return out;
}

export function testContext(root, overrides = {}) {
  const config = ConfigSchema.parse(deepMerge({ kit: 1, repo: { slug: 'acme/widgets' } }, overrides));
  return createContext(root, config);
}

export function makeRepo({ files = {}, config = {}, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-'));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const [path, text] of Object.entries(files)) write(path, text);
  if (git) {
    const run = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    run('init', '-q', '-b', 'main');
    run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'root');
    if (Object.keys(files).length) {
      run('add', '-A');
      run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture');
    }
  }
  return { root, ctx: testContext(root, config), write, read: (path) => readFileSync(join(root, path), 'utf8') };
}
```
`kit/test/flat-layout.mjs`:
```js
// Test-only. Reproduces upstream vertuo-ai-domain's flat layout (docs/outbox/<prd>/, docs/adr,
// docs/knowledge) and its `vertuo-outbox` markers, so ported upstream tests keep their assertions
// byte for byte. Never shipped: kit/lib knows only the folders layout.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { testContext } from './fixture.mjs';

const unsupported = () => {
  throw new Error('flat test layout: inbox paths are not supported');
};

export function flatLayout(root) {
  return Object.freeze({
    kind: 'flat',
    dirs: { inbox: 'docs/inbox', outbox: 'docs/outbox', shipped: null, archive: null },
    adrDir: 'docs/adr',
    knowledgeRoot: 'docs/knowledge',
    whereIs: () => null,
    specPath: unsupported,
    planPath: unsupported,
    beforeAfterPath: unsupported,
    outboxDir: (prd) => `docs/outbox/${Number(prd)}`,
    outboxDirs() {
      const dir = join(root, 'docs/outbox');
      if (!existsSync(dir)) return [];
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map((entry) => ({ prd: Number(entry.name), dir: `docs/outbox/${entry.name}`, shipped: false }))
        .sort((a, b) => a.prd - b.prd);
    },
    specFiles: unsupported,
  });
}

export function flatCtx(root, overrides = {}) {
  const ctx = testContext(root, {
    markers: { prefix: 'vertuo-outbox' },
    laws: { source: 'knowledge' },
    paths: { knowledge: 'docs/knowledge', adr: 'docs/adr', glossary: 'docs/glossary.md' },
    repo: { slug: 'vertuoza/vertuo-ai-domain' },
    ...overrides,
  });
  return Object.freeze({ ...ctx, layout: flatLayout(root) });
}
```
Note: `kit/test/` is not scanned by the no-literals guard (`SCANNED = ['lib', 'bin']`), which is why
the upstream names may appear here.

- [ ] **Step 8: Run** `pnpm vitest run kit` — Expected: PASS (config, layout, markers, context, no-literals).

- [ ] **Step 9: Commit**

```bash
git add kit
git commit -m "feat(kit): context, folders layout, markers and the test fixtures"
```

---

### Task 3: **Port** the knowledge registers

**Files:**
- Create: `kit/lib/knowledge/registers.mjs` (+ `.test.mjs`) ← `scripts/registers.mjs`
- Create: `kit/lib/knowledge/check-knowledge.mjs` (+ `.test.mjs`) ← `scripts/check-registers.mjs`
- Create: `kit/lib/knowledge/describe.mjs` (+ `.test.mjs`) ← `scripts/knowledge.mjs`
- Create: `kit/lib/check-report.mjs` ← the `fail`/`pass`/`trackedFiles`/`readRepoFile` parts of `scripts/check-utils.mjs`
- Create: `kit/porting/<module>.md` for each module ported here

**Interfaces:**
- Consumes: `Ctx` (Task 2), `flatCtx`, `makeRepo`.
- Produces (names unchanged from upstream unless noted):
  `ID_SHAPE`, `ID_TOKEN`, `PRODUCT_CODE`, `LAYER_FILES`, `idsCitedIn(text)`, `codeOf(name)`,
  `idParts(id)`, `parseEntryFile(file, text, place)`, `glossaryTermOf(text)`,
  `readKnowledge({ ctx })`, `readRegisters({ ctx })`, `resolveId(id, { ctx })`, `servedBy(entries, id)`;
  `gradeKnowledge({ ctx, files })` → `{ violations: string[], wishes: string[] }`;
  `describeEntry(knowledge, id)`;
  `check-report.mjs`: `trackedFiles(ctx) → string[]` (`git ls-files` in `ctx.root`),
  `readRepoFile(ctx, path)`, `formatFailure(title, violations) → string`, `formatPass(message) → string`
  (pure: they return text; `kit/bin` prints it and sets the exit code).

- [ ] **Step 1: Fetch** per Port Protocol §1 for the three modules and `scripts/check-utils.mjs`
  (module only; it has no test).
- [ ] **Step 2: Apply the mapping**

| Upstream | Kit |
|---|---|
| `KNOWLEDGE_DIR` / `PRODUCT_DIR` / `DOMAINS_DIR` / `CROSS_DOMAIN_DIR` constants | functions of `ctx.layout.knowledgeRoot`: `` `${ctx.layout.knowledgeRoot}/product` `` etc. |
| `GLOSSARY_FILE` | `ctx.config.paths.glossary`; when `null`, the domain-README `Glossary term:` must still be present but is not looked up |
| `OLD_REGISTER_PATHS` and `findOldRegisterCitations` | deleted (an upstream migration artefact) |
| `findOwningLibraryViolations` | kept; "the library must exist" becomes "the listed path must exist under `ctx.root`" |
| `readKnowledge(root)` / `readRegisters(root)` / `resolveId(id, root)` positional root | `({ ctx })` / `(id, { ctx })` |
| `fail()`/`pass()` printing and `process.exit` | `formatFailure`/`formatPass` returning strings |
| `trackedFiles()` reading the module's own repo | `trackedFiles(ctx)` |
| `docs/adr/` in `LAW_TEXT`-style patterns and messages | `ctx.layout.adrDir` |

- [ ] **Step 3: Port the tests** per Port Protocol §6 with `flatCtx(root)` (which points
  `paths.knowledge` at `docs/knowledge` and the glossary at `docs/glossary.md`, as upstream).
- [ ] **Step 4: Add a folders-layout test** in `check-knowledge.test.mjs`:
```js
import { makeRepo } from '../../test/fixture.mjs';
import { gradeKnowledge } from './check-knowledge.mjs';

it('grades a knowledge folder at the configured path with no glossary', () => {
  const { ctx } = makeRepo({
    git: true,
    config: { laws: { source: 'knowledge' } },
    files: {
      '.omni-loop/knowledge/product/principles.md': '# Principles\n\n## P-PRODUCT-1\n\nThe AI proposes; a person accepts.\n\nWhy: trust\nDecided: owner, 2026-09-24\nSource: kickoff\n',
      '.omni-loop/knowledge/product/rules.md': '# Rules\n\n## BR-PRODUCT-1\n\nNothing is sent without a click.\n\nServes: P-PRODUCT-1\nSource: kickoff\nEnforced by: unenforced\nStated: 2026-09-24\n',
      '.omni-loop/knowledge/product/invariants.md': '# Invariants\n',
    },
  });
  const { violations, wishes } = gradeKnowledge({ ctx, files: ['.omni-loop/knowledge/product/principles.md', '.omni-loop/knowledge/product/rules.md', '.omni-loop/knowledge/product/invariants.md'] });
  expect(violations).toEqual([]);
  expect(wishes).toEqual([]);
});
```
  Field lines carry no leading dash: upstream's `FIELD_LINE` is `^(Why|Decided|…):\s*(.*)$`. If a
  field upstream requires (for example a trailing section) is missing from this fixture, add it in
  upstream's shape, not the other way round.
- [ ] **Step 5: Gate** — Port Protocol §8 for all three test files. Expected: PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat(kit): port the knowledge registers, read from the configured path"`

---

### Task 4: Laws — what floors an outbox item and what stops a slice

**Files:**
- Create: `kit/lib/laws.mjs`, `kit/lib/laws.test.mjs`

**Interfaces:**
- Consumes: `Ctx`; `ID_SHAPE`, `resolveId` (Task 3).
- Produces: `lawsFor(ctx): Laws` where
  `Laws = { source, floorsHigh(bearsOn: string): boolean, resolve(bearsOn: string): { ok: true } | { ok: false, reason: string } }`;
  `invariantAdrs(claudeMdText: string, heading: string): Set<string>` (e.g. `Set{'ADR-0004'}`);
  `adrFiles(ctx, number: string): string[]`.

Rules:
- `bearsOn === 'none'` → resolves, never floors.
- `ADR-NNNN` → resolves iff exactly one file `<adrDir>/NNNN-*.md` exists; zero → "no decision
  record ADR-NNNN in <adrDir>"; two or more → "ADR-NNNN is ambiguous: <file>, <file>". Floors only
  when `source === 'claudeMdInvariants'` and it is in `invariantAdrs(CLAUDE.md, heading)`.
- A knowledge id (`ID_SHAPE`) → only when `source === 'knowledge'`: resolves via `resolveId`, always
  floors. Under any other source → "knowledge ids need laws.source: knowledge".
- Anything else → "not none, an ADR-NNNN or a knowledge id".

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { invariantAdrs, lawsFor } from './laws.mjs';

const ADR = '.omni-loop/knowledge/adr';

describe('invariantAdrs', () => {
  it('reads the ADR ids cited under the heading, and only there', () => {
    const text = '# X\n\n## Invariants\n\n- Tenants never mix (ADR-0004)\n- Money is exact (ADR-0011, ADR-0016)\n\n## Other\n\n- (ADR-0099)\n';
    expect([...invariantAdrs(text, '## Invariants')].sort()).toEqual(['ADR-0004', 'ADR-0011', 'ADR-0016']);
  });
  it('is empty when the heading is absent', () => {
    expect(invariantAdrs('# X\n', '## Invariants').size).toBe(0);
  });
});

describe('lawsFor', () => {
  it('source none: resolves ADRs by file, floors nothing', () => {
    const { ctx } = makeRepo({ files: { [`${ADR}/0004-tenants.md`]: '# 4' } });
    const laws = lawsFor(ctx);
    expect(laws.resolve('none')).toEqual({ ok: true });
    expect(laws.resolve('ADR-0004')).toEqual({ ok: true });
    expect(laws.floorsHigh('ADR-0004')).toBe(false);
    expect(laws.resolve('BR-QUOTE-1').ok).toBe(false);
  });

  it('refuses an ambiguous ADR number, naming both files', () => {
    const { ctx } = makeRepo({ files: { [`${ADR}/0076-a.md`]: '#', [`${ADR}/0076-b.md`]: '#' } });
    const result = lawsFor(ctx).resolve('ADR-0076');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ambiguous.*0076-a\.md.*0076-b\.md/s);
  });

  it('refuses a missing ADR', () => {
    const { ctx } = makeRepo();
    expect(lawsFor(ctx).resolve('ADR-0001').reason).toMatch(/no decision record ADR-0001/);
  });

  it('source claudeMdInvariants: an ADR named under the heading floors high', () => {
    const { ctx } = makeRepo({
      config: { laws: { source: 'claudeMdInvariants' } },
      files: { 'CLAUDE.md': '## Invariants\n\n- x (ADR-0004)\n', [`${ADR}/0004-a.md`]: '#', [`${ADR}/0005-b.md`]: '#' },
    });
    const laws = lawsFor(ctx);
    expect(laws.floorsHigh('ADR-0004')).toBe(true);
    expect(laws.floorsHigh('ADR-0005')).toBe(false);
  });

  it('source knowledge: a resolved id floors high, an unknown one does not resolve', () => {
    const { ctx } = makeRepo({
      config: { laws: { source: 'knowledge' } },
      files: { '.omni-loop/knowledge/product/principles.md': '# Principles\n\n## P-PRODUCT-1\n\nx\n\nWhy: y\nDecided: z\nSource: w\n' },
    });
    const laws = lawsFor(ctx);
    expect(laws.floorsHigh('P-PRODUCT-1')).toBe(true);
    expect(laws.resolve('P-PRODUCT-1')).toEqual({ ok: true });
    expect(laws.resolve('P-PRODUCT-9').ok).toBe(false);
  });
});
```
(Use the entry-line shape Task 3 established for the knowledge fixture.)

- [ ] **Step 2: Run** `pnpm vitest run kit/lib/laws.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `kit/lib/laws.mjs`**

```js
// What a repository treats as law. An outbox item bearing on a law is ranked high at least, and a
// slice that would break one stops. Where laws come from is config (`laws.source`), because
// repositories disagree: a knowledge folder, the ADRs CLAUDE.md lists as invariants, or nothing.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ID_SHAPE, resolveId } from './knowledge/registers.mjs';

const ADR_ID = /^ADR-(\d{4})$/;

export function invariantAdrs(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading.trim());
  if (start === -1) return new Set();
  const level = heading.trim().match(/^#+/)[0].length;
  const ids = new Set();
  for (const line of lines.slice(start + 1)) {
    const next = line.match(/^(#+)\s/);
    if (next && next[1].length <= level) break;
    for (const match of line.matchAll(/ADR-\d{4}/g)) ids.add(match[0]);
  }
  return ids;
}

export function adrFiles(ctx, number) {
  const dir = join(ctx.root, ctx.layout.adrDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.startsWith(`${number}-`) && name.endsWith('.md')).sort();
}

export function lawsFor(ctx) {
  const { source, claudeMdHeading } = ctx.config.laws;
  let invariants = null;
  const invariantSet = () => {
    if (invariants === null) {
      const file = join(ctx.root, 'CLAUDE.md');
      invariants = existsSync(file) ? invariantAdrs(readFileSync(file, 'utf8'), claudeMdHeading) : new Set();
    }
    return invariants;
  };

  function resolve(bearsOn) {
    if (bearsOn === 'none') return { ok: true };
    const adr = ADR_ID.exec(bearsOn);
    if (adr) {
      const files = adrFiles(ctx, adr[1]);
      if (files.length === 1) return { ok: true };
      if (files.length === 0) return { ok: false, reason: `no decision record ${bearsOn} in ${ctx.layout.adrDir}` };
      return { ok: false, reason: `${bearsOn} is ambiguous: ${files.join(', ')}` };
    }
    if (ID_SHAPE.test(bearsOn)) {
      if (source !== 'knowledge') return { ok: false, reason: `${bearsOn}: knowledge ids need laws.source: knowledge` };
      return resolveId(bearsOn, { ctx }) ? { ok: true } : { ok: false, reason: `${bearsOn} names no entry in ${ctx.layout.knowledgeRoot}` };
    }
    return { ok: false, reason: `${bearsOn}: not none, an ADR-NNNN or a knowledge id` };
  }

  function floorsHigh(bearsOn) {
    if (source === 'knowledge') return ID_SHAPE.test(bearsOn);
    if (source === 'claudeMdInvariants') return invariantSet().has(bearsOn);
    return false;
  }

  return Object.freeze({ source, resolve, floorsHigh });
}
```
If Task 3's `resolveId` returns an entry object or `null`/`undefined`, the truthiness test above is
right; if it returns `{ ok }`, adapt this one line and note it in the commit message.

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(kit): laws come from config — knowledge, CLAUDE.md invariants or none"`

---

### Task 5: **Port** the outbox item parser

**Files:**
- Create: `kit/lib/outbox/outbox.mjs` (+ `.test.mjs`) ← `scripts/outbox.mjs`
- Create: `kit/porting/<module>.md` for each module ported here

**Interfaces:**
- Consumes: `Ctx`, `Laws` (Task 4).
- Produces: unchanged upstream names `SETTLED_FILE`, `RANK_VALUES`, `RANK_ORDER`,
  `REQUIRED_SECTIONS`, `PLAIN_SECTIONS`, `OPTIONS_HEADING`, `PERSON_STEPS_HEADING`, `OPTION_LETTERS`,
  `parseFrontMatterLines`, `parseOutboxItem(text, { file })`, `parseOutboxOptions`,
  `optionLettersInOrder`, `plainWordsProblems`; changed:
  `bearsOnFloorsHigh(bearsOn, laws)`, `floorRank(bearsOn, proposed, laws)`,
  `isBelowFloor(bearsOn, rank, laws)`, `resolveBearsOn(bearsOn, laws)` → `{ ok, reason? }`,
  `outboxItemFiles({ ctx }) → string[]` (open item files in every `ctx.layout.outboxDirs()`, minus
  `settled.md` and anything under `accounts/`).

- [ ] **Step 1: Fetch** per protocol.
- [ ] **Step 2: Mapping**

| Upstream | Kit |
|---|---|
| `import { ID_SHAPE, resolveId } from './registers.mjs'` | removed; laws are passed in |
| `OUTBOX_DIR`, `ADR_DIR`, `repoRoot` | deleted |
| `bearsOnFloorsHigh(bearsOn)` body | `return laws.floorsHigh(bearsOn)` |
| `resolveBearsOn(bearsOn, { root })` body | `return laws.resolve(bearsOn)` (upstream's shape is replaced by `{ ok, reason }`; list in the porting record) |
| `outboxItemFiles(root)` walking `docs/outbox/<n>/` | walks each `ctx.layout.outboxDirs()` `dir` |

- [ ] **Step 3: Port the tests.** In the test, build laws with a stub that reproduces upstream's
  behaviour: `const laws = { source: 'knowledge', floorsHigh: (b) => /^(N\d+|(?:P|BR|N)-[A-Z0-9]+-\d+|X-[A-Z0-9]+-[A-Z0-9]+-\d+)$/.test(b), resolve: (b) => lawsFor(flatCtx(root)).resolve(b) }`
  — for pure cases the regex stub is enough; for `resolveBearsOn` cases build the fixture root and
  use `lawsFor(flatCtx(root))`. Every `expect` on `floorRank`/`isBelowFloor` stays identical.
- [ ] **Step 4: Add one folders-layout case** for `outboxItemFiles`:
```js
it('lists open items in flight and in shipped folders, never settled.md or accounts', () => {
  const { ctx } = makeRepo({ files: {
    '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
    '.omni-loop/delivery/outbox/0042-a/s1-01-x.md': 'x',
    '.omni-loop/delivery/outbox/0042-a/settled.md': 'x',
    '.omni-loop/delivery/outbox/0042-a/accounts/s1.md': 'x',
    '.omni-loop/delivery/shipped/0007-b/outbox/s2-01-y.md': 'x',
  } });
  expect(outboxItemFiles({ ctx })).toEqual([
    '.omni-loop/delivery/outbox/0042-a/s1-01-x.md',
    '.omni-loop/delivery/shipped/0007-b/outbox/s2-01-y.md',
  ]);
});
```
- [ ] **Step 5: Gate** and **Step 6: Commit** — `feat(kit): port the outbox item parser, laws injected`.

---

### Task 6: **Port** settling

**Files:**
- Create: `kit/lib/outbox/settle.mjs` (+ `.test.mjs`) ← `scripts/outbox-settle.mjs`

**Interfaces:**
- Consumes: Task 5 (`parseOutboxItem`, `SETTLED_FILE`), `Markers`, `COMMANDS`.
- Produces: `VERDICTS`, `ADOPTED_VERDICT`, `CHANNEL_KINDS`, `AnswerSchema`, `channelLabel`,
  `judgeAnswer` (unchanged, pure); `settledHeader(prd, { ctx })`,
  `renderSettledEntry({ item, itemText, answer, judgement, markers })`,
  `parseSettledEntries(text, markers)` → entries `{ id, verdict, closed, fields, answerText, itemText, became: string[] }`,
  `settleItem({ ctx, file, answer })`, `renderAdoptedEntry({ item, itemText, markers })`,
  `adoptItem({ ctx, itemText })`.

- [ ] **Step 1: Fetch.**
- [ ] **Step 2: Mapping**

| Upstream | Kit |
|---|---|
| `ENTRY_OPEN` / `ENTRY_CLOSE` / `ENTRY_OPEN_RE` module constants | `markers.settledOpen` / `markers.settledClose` / `markers.settledOpenRe` |
| `(/vertuo-yolo-fix)` in the drifted `Closed:` text | `` `(${COMMANDS.yoloFix})` `` |
| `` `docs/outbox/SETTLING.md` `` in `settledHeader` | `` `${ctx.layout.dirs.outbox}/README.md` `` |
| `join(OUTBOX_DIR, String(item.prd), SETTLED_FILE)` | `` `${ctx.layout.outboxDir(item.prd)}/${SETTLED_FILE}` ``; if `outboxDir` is `null`, throw `Error(\`PRD ${item.prd} has no inbox or shipped folder\`)` |

- [ ] **Step 3: `became`.** In `rawSettledEntries`, after computing `closed`, add
  `const became = (current.fields.Became ?? '').split(',').map((id) => id.trim()).filter(Boolean);`
  and include `became` in the pushed entry. Test:
```js
it('reads Became: as a list of ids', () => {
  const markers = makeMarkers('omni-outbox');
  const text = [markers.settledOpen('s1-01-x'), '## s1-01-x — agreed', '- Verdict: agreed', '- Closed: yes — agreed', '- Became: N-PRODUCT-1, N-PRODUCT-2', markers.settledClose('s1-01-x')].join('\n');
  expect(parseSettledEntries(text, markers)[0].became).toEqual(['N-PRODUCT-1', 'N-PRODUCT-2']);
});
```
- [ ] **Step 4: Port the tests** (`flatCtx`, `markers = makeMarkers('vertuo-outbox')`); the only
  assertion changes allowed are the `/vertuo-yolo-fix` text (now `/omni-yolo-fix`) and the
  `SETTLING.md` path in the header. List both.
- [ ] **Step 5: Add a folders-layout case:** `settleItem` on `.omni-loop/delivery/outbox/0042-a/s1-01-x.md`
  (an item fixture copied from one of upstream's test fixtures, with `prd: 42`) appends to
  `.omni-loop/delivery/outbox/0042-a/settled.md`, removes the item, and the entry begins with
  `<!-- omni-outbox-settled: s1-01-x -->`. Seed `.omni-loop/delivery/inbox/0042-a/spec.md` so
  `outboxDir(42)` resolves.
- [ ] **Step 6: Gate, Commit** — `feat(kit): port settling; Became: is parsed`.

---

### Task 7: **Port** `check-outbox`, with the `Became:` and shipped checks

**Files:**
- Create: `kit/lib/outbox/check-outbox.mjs` (+ `.test.mjs`) ← `scripts/check-outbox.mjs`

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces: `checkItemText(file, text, { ctx, laws })` → `string[]` violations;
  `findOutboxViolations({ ctx })` → `string[]`, now also covering:
  1. every `Became:` id of every `settled.md` resolves (`laws.resolve`), message
     `` `${file}: ${entryId} Became: ${id} — ${reason}` ``;
  2. an open item inside a shipped outbox is a violation:
     `` `${file}: open item in a shipped PRD — settle it or reopen the PRD` ``.

- [ ] **Step 1: Fetch; Step 2: map** (`check-utils` → `check-report.mjs`; `repoRoot` → `ctx`;
  `resolveBearsOn(bearsOn, { root })` → `laws.resolve(bearsOn)`; `isBelowFloor(…)` gains `laws`).
- [ ] **Step 3: Port the tests** with `flatCtx`.
- [ ] **Step 4: New failing tests** (folders layout, `laws.source: 'knowledge'`):
```js
it('refuses a Became: id that names no knowledge entry', () => {
  const m = makeMarkers('omni-outbox');
  const { ctx } = makeRepo({ config: { laws: { source: 'knowledge' } }, files: {
    '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
    '.omni-loop/delivery/outbox/0042-a/settled.md': [m.settledOpen('s1-01-x'), '## s1-01-x — agreed', '- Verdict: agreed', '- Closed: yes', '- Became: P-PRODUCT-9', m.settledClose('s1-01-x'), ''].join('\n'),
  } });
  expect(findOutboxViolations({ ctx }).join('\n')).toMatch(/s1-01-x Became: P-PRODUCT-9/);
});

it('refuses an open item in a shipped PRD', () => {
  const { ctx } = makeRepo({ files: { '.omni-loop/delivery/shipped/0007-b/outbox/s2-01-y.md': VALID_ITEM_TEXT } });
  expect(findOutboxViolations({ ctx }).join('\n')).toMatch(/open item in a shipped PRD/);
});
```
  `VALID_ITEM_TEXT` is the valid-item fixture already defined in the ported upstream test file, with
  `prd: 7`. Run: FAIL. Implement both checks in `findOutboxViolations` (iterate
  `ctx.layout.outboxDirs()`; for each read `settled.md` if present through
  `parseSettledEntries(text, ctx.markers)`; for `shipped: true` dirs, every file `outboxItemFiles`
  lists under it is a violation). Run: PASS.
- [ ] **Step 5: Gate, Commit** — `feat(kit): check the outbox — Became: resolves, nothing open ships`.

---

### Task 8: **Port** decision coverage and accounts

**Files:**
- Create: `kit/lib/outbox/decision-coverage.mjs` (+ test) ← `scripts/decision-coverage.mjs`
- Create: `kit/lib/outbox/account.mjs` (+ test) ← `scripts/outbox-account.mjs`
- Create: `kit/lib/outbox/check-decision-coverage.mjs` (+ test) ← `scripts/check-decision-coverage.mjs`

**Interfaces:**
- Produces: `RULE_IDS = ['stored-shape','law-proof','law-text','test-removed','shared-contract']`,
  `riskyChanges(changes, { ctx })`, `enforcedByPaths({ ctx })`; `ACCOUNTS_DIR`,
  `parseAccount`, `readAccounts(prd, { ctx })`, `compare(risky, accounts)`;
  `parseNameStatus`, `discoveredPrds({ ctx })`, `findFormatViolations({ ctx })`,
  `gradePrd(prd, risky, { ctx })`, `describeUnaccounted(prd, change)`.
  `rangeChanges(base, ctx, exec)` moves to `kit/lib/git.mjs` as
  `rangeChanges({ ctx, base, exec = execFileSync })` (the only `git diff --name-status` caller; Tasks
  9 and 11 import it from there).

- [ ] **Step 1: Fetch; Step 2: mapping**

| Upstream | Kit |
|---|---|
| `STORED_SHAPE_PATH` | `ctx.config.risk.storedShape.some((s) => new RegExp(s).test(path))` |
| `SHARED_CONTRACT_PREFIX` | `ctx.config.risk.sharedContract.some((p) => path.startsWith(p))` |
| `LAW_TEXT_PATH` | a file directly under `<knowledgeRoot>/product/` or `<knowledgeRoot>/domains/<d>/` named `principles.md`/`rules.md`/`invariants.md`, any `.md` under `<knowledgeRoot>/cross-domain/`, or any `.md` under `ctx.layout.adrDir` |
| `law-proof` (`Enforced by:` paths) | only when `ctx.config.laws.source === 'knowledge'`; otherwise never fires |
| every `matches(change)` | `matches(change, { ctx })` |
| `DEFAULT_BASE = 'origin/main'` | `` `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}` `` |
| `OUTBOX_DIR/<prd>/accounts` | `` `${ctx.layout.outboxDir(prd)}/accounts` `` |

- [ ] **Step 3: Port tests** with `flatCtx(root, { risk: { storedShape: ['^libs/[^/]+/src/server/migrations\\.ts$'], sharedContract: ['libs/system-api-contract/'] } })` so upstream's cases hold unchanged.
- [ ] **Step 4: New test** — with an empty `risk` config, a change to
  `libs/x/src/server/migrations.ts` fires no rule; a deleted `a.test.mjs` fires `test-removed`; an
  edit to `.omni-loop/knowledge/adr/0001-x.md` fires `law-text`.
- [ ] **Step 5: Gate, Commit** — `feat(kit): port decision coverage; the risky paths are config`.

---

### Task 9: **Port** the gate, and keep it red while drift is unreworked

**Files:**
- Create: `kit/lib/outbox/status.mjs` (+ test) ← `scripts/outbox-status.mjs`
- Create: `kit/lib/outbox/settle-head.mjs` (+ test) ← `scripts/settle-head.mjs`

**Interfaces:**
- Produces: `openItemFiles(prd, { ctx })`, `openItems(prd, { ctx })`,
  `unaccountedChanges(prd, changes, { ctx })`, `unreworkedDrift(prd, { ctx }) → { id, closedLine }[]`,
  `gateResult(prd, { ctx, labels = [], changes = null })` →
  `{ ok, items, overridden, unreworked, unaccounted? }`, `formatReport(prd, result)`;
  `decideStale(runSha, headSha, apiError)`.

- [ ] **Step 1: Fetch; Step 2: mapping** — `OVERRIDE_LABEL` → `ctx.config.labels.outboxGo`;
  `` `${OUTBOX_DIR}/${prd}/` `` → `` `${ctx.layout.outboxDir(prd)}/` ``.
- [ ] **Step 3: Port tests** (`flatCtx`). Upstream cases that expect `ok: true` with no drift keep
  passing; the new `unreworked: []` field is added to any `toEqual` on the whole result (list in
  the porting record).
- [ ] **Step 4: New failing tests**
```js
function drifted(markers, id, closed) {
  return [markers.settledOpen(id), `## ${id} — drifted`, '- Verdict: drifted', `- Closed: ${closed}`, markers.settledClose(id), ''].join('\n');
}

it('stays red while a drifted entry is not reworked, even with nothing open', () => {
  const { ctx } = makeRepo({ files: {
    '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
    '.omni-loop/delivery/outbox/0042-a/settled.md': drifted(makeMarkers('omni-outbox'), 's1-01-x', 'no — the build and the decision disagree (/omni-yolo-fix)'),
  } });
  const result = gateResult(42, { ctx });
  expect(result.ok).toBe(false);
  expect(result.unreworked.map((e) => e.id)).toEqual(['s1-01-x']);
  expect(formatReport(42, result)).toMatch(/1 drifted decision not yet reworked/);
});

it('goes green once the drifted entry is closed by a rework', () => {
  const { ctx } = makeRepo({ files: {
    '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
    '.omni-loop/delivery/outbox/0042-a/settled.md': drifted(makeMarkers('omni-outbox'), 's1-01-x', 'yes — reworked by #12'),
  } });
  expect(gateResult(42, { ctx }).ok).toBe(true);
});

it('the override label still waves everything through', () => {
  const { ctx } = makeRepo({ files: {
    '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
    '.omni-loop/delivery/outbox/0042-a/settled.md': drifted(makeMarkers('omni-outbox'), 's1-01-x', 'no — x'),
  } });
  expect(gateResult(42, { ctx, labels: ['outbox:go'] }).ok).toBe(true);
});
```
  Run: FAIL. Implement: `unreworkedDrift` reads `settled.md` in `outboxDir(prd)` through
  `parseSettledEntries(text, ctx.markers)` and returns entries with `verdict === 'drifted' && !closed`;
  `gateResult` computes `ok = overridden || (items.length === 0 && unreworked.length === 0 && (unaccounted?.length ?? 0) === 0)`;
  `formatReport` adds the line `` `${n} drifted decision${n === 1 ? '' : 's'} not yet reworked — run ${COMMANDS.yoloFix} #${prd}` `` followed by one `  - <id>` per entry. Run: PASS.
- [ ] **Step 5: Gate, Commit** — `feat(kit): port the outbox gate; drift keeps it red until reworked`.

---

### Task 10: **Port** reply intake

**Files:**
- Create: `kit/lib/outbox/replies.mjs` (+ test) ← `scripts/outbox-replies.mjs`

**Interfaces:**
- Produces: `WRITER_ASSOCIATIONS`, `APPROVE_ALL_TEXT`, `RECOMMENDATION_TEXT`, `parseReplyLines`,
  `interpretAnswer`, `isCountedReply(comment, markers)`, `planReplies({ comments, items, adopted, markers })`,
  `formatRoundComment({ round, questions, markers })`,
  `appendObjection({ ctx, prd, adoptedEntry, item, answer, judgement })`,
  `readReplies({ ctx, prd, pr, post = false }, client)`, `summarize(result)`.
  `client` is the injected GitHub seam upstream already defines (`listComments`, `createComment`,
  `updateComment` — keep upstream's exact method names).

- [ ] **Step 1: Fetch; Step 2: mapping** — `OUTBOX_MARKER_PREFIX` → `markers.any`; the round marker
  literal → `markers.round(round, numbers)`; `DEFAULT_REPO` → deleted (the CLI passes
  `ctx.config.repo.slug`); `join(OUTBOX_DIR, String(prd), SETTLED_FILE)` →
  `` `${ctx.layout.outboxDir(prd)}/${SETTLED_FILE}` ``; `/vertuo-yolo-fix` → `COMMANDS.yoloFix`.
- [ ] **Step 3: Port tests** (`flatCtx`, `makeMarkers('vertuo-outbox')`), fake client unchanged.
- [ ] **Step 4: Gate, Commit** — `feat(kit): port reply intake`.

---

### Task 11: **Port** the outbox comments and the Slack note

**Files:**
- Create: `kit/lib/outbox/comment.mjs` (+ test) ← `scripts/outbox-comment.mjs` (1242 lines — the
  largest port; keep the file whole, do not refactor it)

**Interfaces:**
- Produces (upstream names): `openItemsForPrd(prd, { ctx })`, `sortItems`, `sortUnaccountedChanges`,
  `announcedKeys`, `parseAnnouncedMarker(body, markers)`, `formatOutboxComment({ …, ctx })`,
  `findMarkerComment(comments, markers)`, `findPrMarkerComment(comments, markers)`,
  `formatNumbersMarker(numbering, markers)`, `parseNumbersMarker(body, markers)`, `assignNumbers`,
  `parseRoundMarkers(comments, markers)`, `adoptedEntriesForPrd(prd, { ctx })`,
  `answeredQuestionText`, `answeredOutcome`, `formatOptionsTable`, `formatOutboxPrComment({ …, ctx })`,
  `upsertOutboxPrComment(…, client)`, `parseNameStatus`, `unaccountedChanges(prd, changes, { ctx })`,
  `countsByRank`, `slackOwner`, `slackLine`, `readPrCommentResult`, `maybeWriteSlackNote`,
  `upsertOutboxComment(…, client)`. **Moved out:** `ghClient` → `kit/bin/github.mjs` (Task 15),
  `rangeChanges` → `kit/lib/git.mjs` (Task 8).

- [ ] **Step 1: Fetch; Step 2: mapping**

| Upstream | Kit |
|---|---|
| `MARKER`, `PR_MARKER` | `markers.comment`, `markers.prComment` |
| `ANNOUNCED_*`, `NUMBERS_*`, `ROUND_MARKER_RE` | `markers.announced*`, `markers.numbers*`, `markers.roundRe` |
| `DEFAULT_REPO` | deleted |
| `` `docs/outbox/${prd}/` `` and `` `docs/outbox/${prd}/settled.md` `` in text | `` `${ctx.layout.outboxDir(prd)}/` `` and `` `${ctx.layout.outboxDir(prd)}/settled.md` `` |
| `labels.includes('outbox:go')` and the `outbox:go` text | `ctx.config.labels.outboxGo` |
| `/vertuo-yolo-fix`, `/vertuo-yolo`, `/vertuo-deliver` in text | `COMMANDS.*` |
| the default Slack channel id (#octopod) | none: `maybeWriteSlackNote` writes nothing when `ctx.config.notify.slack` is `null` |

- [ ] **Step 3: Port tests** — `flatCtx`, `makeMarkers('vertuo-outbox')`, labels default
  `outbox:go`. Allowed assertion changes: command names in rendered text. The Slack cases pass
  `flatCtx(root, { notify: { slack: {} } })`.
- [ ] **Step 4: New test** — with `notify.slack: null`, `maybeWriteSlackNote` returns without writing
  the note file (assert the file does not exist).
- [ ] **Step 5: Gate, Commit** — `feat(kit): port the outbox comments; Slack is opt-in`.

---

### Task 12: **Port** the inbox, its status, territory and collisions — folders layout only

**Files:**
- Create: `kit/lib/inbox/inbox.mjs` (+ test) ← `scripts/inbox.mjs`
- Create: `kit/lib/inbox/check-inbox.mjs` (+ test) ← `scripts/check-inbox.mjs`
- Create: `kit/lib/inbox/status.mjs` (+ test) ← `scripts/inbox-status.mjs` (pure; near-verbatim)
- Create: `kit/lib/inbox/territory.mjs` (+ test) ← `scripts/check-territory.mjs`
- Create: `kit/lib/inbox/collisions.mjs` (+ test) ← `scripts/inbox-collisions.mjs`

**Interfaces:**
- Produces: `SPEC_VALUES`, `parseSpec(text, { file })` (was `parseInboxFile`),
  `readInbox({ ctx }) → { prd, title, blockedBy, spec, file, folder }[]`;
  `checkSpecText(file, text, { ctx })`, `findInboxViolations({ ctx })`;
  `STALL_DAYS` → removed, `deriveStatus({ prd, featurePrs, lastCommit, now, stallDays, prLinks })`,
  `findFeaturePr(prd, prs, prLinks)`, `findSubPrs(prd, prs, prLinks)`;
  territory: `territoryPrefixes`, `parsePlanSlices`, `covers`, `breaches`, `sharedGround`,
  `collisions`, `sameWaveCollisions`, `collisionRows`, `territoryVerdict`;
  `planFromMarkdown`, `planCollisions`.

This is the one port whose **front matter changes** (spec §5): `spec.md` keeps `prd`, `title`,
`blocked-by`, `spec`; **`plan` is refused** (the plan is always the sibling `plan.md`); an optional
`areas:` list is accepted and, when `laws.source === 'knowledge'`, each area must be a folder under
`<knowledgeRoot>/domains/`. `status`, `branch`, `value`, `priority` stay refused by name.

- [ ] **Step 1: Fetch** all five.
- [ ] **Step 2: Mapping**

| Upstream | Kit |
|---|---|
| `INBOX_DIR`, `inboxFiles(root)` | `ctx.layout.specFiles()` |
| `BEFORE_AFTER_DIR` + `<topic>.html` | `ctx.layout.beforeAfterPath(prd)` |
| `BEFORE_AFTER_MAX_BYTES` | `ctx.config.limits.beforeAfterMaxBytes` |
| `plan:` resolves (`check-inbox`) | `plan.md` exists beside `spec.md` — reported as a *note* (`unplanned`), not a violation |
| the `prd:` field | must equal the folder's number (`parseFolderName(folder).prd`); mismatch is a violation |
| `STALL_DAYS` | `ctx.config.limits.stallDays`, passed in as `stallDays` |
| `Closes #`/`Part of #` regexes | built from `ctx.config.prLinks.feature`/`.sub` by replacing `{prd}` with the number and escaping the rest |
| `THE_PLAN` and its on-disk test | deleted |

- [ ] **Step 3: Tests.** `status`, `territory`, `collisions`: port upstream tests verbatim (they are
  pure), passing `stallDays: 5` and `prLinks: { feature: 'Closes #{prd}', sub: 'Part of #{prd}' }`.
  `inbox` and `check-inbox`: upstream tests are written for the flat layout, so **rewrite** each
  upstream case against folders fixtures with `makeRepo`, keeping each case's name and expected
  outcome; plus these new cases:
```js
import { makeRepo } from '../../test/fixture.mjs';
import { findInboxViolations } from './check-inbox.mjs';

const IN = '.omni-loop/delivery/inbox';
const spec = (fields) => `---\n${Object.entries({ prd: 42, title: 'A', 'blocked-by': 'none', spec: 'file', ...fields })
  .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join('\n')}\n---\n\n## Problem\n\nx\n`;
const violations = (files, config = {}) => findInboxViolations({ ctx: makeRepo({ files, config }).ctx }).join('\n');

it('accepts a well-formed spec', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({}) })).toBe('');
});
it('refuses a plan: field — the plan is the sibling plan.md', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ plan: 'x.md' }) })).toMatch(/plan/);
});
it('refuses a prd: that disagrees with the folder number', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ prd: 43 }) })).toMatch(/0042-a.*43|43.*0042-a/s);
});
it('refuses a missing spec.md in an inbox folder', () => {
  expect(violations({ [`${IN}/0042-a/plan.md`]: 'x' })).toMatch(/0042-a\/spec\.md/);
});
it('accepts areas: naming knowledge domains, refuses an unknown one', () => {
  const found = violations(
    { [`${IN}/0042-a/spec.md`]: spec({ areas: ['credits', 'nope'] }), '.omni-loop/knowledge/domains/credits/README.md': '# Credits\n' },
    { laws: { source: 'knowledge' } },
  );
  expect(found).toMatch(/nope/);
  expect(found).not.toMatch(/credits/);
});
it('refuses a before-after page over the configured cap', () => {
  expect(violations(
    { [`${IN}/0042-a/spec.md`]: spec({}), [`${IN}/0042-a/before-after.html`]: '12345678901' },
    { limits: { beforeAfterMaxBytes: 10 } },
  )).toMatch(/before-after\.html/);
});
it('still refuses status, branch, value and priority by name', () => {
  for (const field of ['status', 'branch', 'value', 'priority']) {
    expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ [field]: 'x' }) })).toMatch(new RegExp(field));
  }
});
```
- [ ] **Step 4: Gate, Commit** — `feat(kit): port the inbox for one folder per PRD`.

---

### Task 13: **Port** the policies — recording, rework, phase-0

**Files:**
- Create: `kit/lib/policy/outbox-policy.mjs` (+ test) ← `.claude/skills/vertuo-do-work/outbox-policy.mjs`
- Create: `kit/lib/policy/rework.mjs` (+ test) ← `.claude/skills/vertuo-yolo-fix/rework.mjs`
- Create: `kit/lib/policy/phase-0.mjs` (+ test) ← `.claude/skills/vertuo-brainstorming/phase-0-policy.mjs`

**Interfaces:**
- Produces: outbox-policy — `SLICE_STATUSES`, `RECORDING_OUTCOMES`, `AUTHOR_MARK`,
  `proposeRank({ bearsOn, hardToRevert, laws })`, `decideRecording({ …, laws })`,
  `CONSULTATION_POLICIES` keyed by `COMMANDS.deliver` and `COMMANDS.yolo`, `consultationPolicy`,
  `asksAbout`, `consult`, `unknowable`, `renderOutboxItem`, `SLICE_TIME_GUARD`,
  `sliceTimeGuardCommand({ base, prd })` (now emits `node .omni-loop/bin/omni.mjs check coverage …`),
  `ACCOUNT_FORMS`, `accountFile(prd, slice, { ctx })`, `renderAccount`, `planAccount`;
  rework — `driftedEntries(settledText, markers)`, `namedPaths`, `chosenOptionOf`, `reworkSliceId`,
  `deriveRework`, `assignWaves`, `planRework({ …, markers })`, `renderReworkPlan`,
  `closeDriftedEntry(settledText, { id, pullRequest, markers })`, `reworkPullRequest`;
  phase-0 — `PHASE_0_REQUIRED_KINDS`, `phase0Paths(prd, { ctx })` →
  `{ spec, plan, beforeAfter, acceptanceDir }`, `classifyPhase0Path(path, { ctx, prd })`,
  `isDocsOnly(paths, { ctx })`, `phase0Verdict(paths, { ctx, prd, needsBeforeAfter })`,
  `beforeAfterHandoff(value)`.

- [ ] **Step 1: Fetch** the three modules and tests (paths under `.claude/skills/…` at `c4a210122`).
- [ ] **Step 2: Mapping**

| Upstream | Kit |
|---|---|
| `'../../../scripts/…'` imports | the kit modules from Tasks 3–9 |
| consultation keys `'/vertuo-deliver'`, `'/vertuo-yolo'` | `COMMANDS.deliver`, `COMMANDS.yolo` |
| `idParts` law detection in `decideRecording` | `laws.floorsHigh(bearsOn)` for "a law it can name"; a `P-` id conflict still stops only when `laws.source === 'knowledge'` |
| `pnpm check:decision-coverage` / `node scripts/check-decision-coverage.mjs` text | `node .omni-loop/bin/omni.mjs check coverage` |
| `<!-- vertuo-outbox-settled: … -->` in rework | `markers` |
| `PHASE_0_LABEL`, `PHASE_0_BASE`, `PLAN_DIR`, `PENDING_FEATURE_SUFFIX`, `INBOX_DIR`, `BEFORE_AFTER_DIR`, `inboxFilePath`, `beforeAfterPath` | `ctx.config.labels.phase0`, `ctx.config.repo.defaultBranch`, the folder paths from `ctx.layout` (the PRD's spec, plan and page all sit in `inbox/<prd>-<topic>/`), `ctx.config.acceptance.dir` + `.pendingSuffix` (acceptance paths are a phase-0 kind only when `acceptance.enabled`) |

- [ ] **Step 3: Port tests.** outbox-policy and rework: `flatCtx`/`makeMarkers('vertuo-outbox')`,
  laws from the regex stub in Task 5. phase-0: rewrite against folders fixtures (upstream's are
  flat), keeping each case's intent: a docs-only PR with spec + plan + page passes; a source file
  fails; a missing plan fails; a claude.ai link as handoff is refused.
- [ ] **Step 4: Gate, Commit** — `feat(kit): port the recording, rework and phase-0 policies`.

---

### Task 14: The ship step and `prd` lookup

**Files:**
- Create: `kit/lib/delivery/ship.mjs`, `kit/lib/delivery/ship.test.mjs`
- Create: `kit/lib/delivery/prd.mjs`, `kit/lib/delivery/prd.test.mjs`

**Interfaces:**
- Consumes: `Ctx`, `openItemFiles`, `unreworkedDrift` (Task 9), `trackedFiles` (Task 3).
- Produces:
  - `planShip(ctx, prd, { files, read })` → `{ ok: true, moves: {from,to}[], rewrites: {file, text}[] }`
    or `{ ok: false, reasons: string[] }`. Pure over `files` (repo-relative tracked paths) and `read(path)`.
  - `applyShip(ctx, prd, { exec = execFileSync })` → the plan it applied; uses `git mv` then writes
    rewrites; never commits (the skill commits).
  - `whereIs(ctx, prd)` → `{ prd, name, state, dir, files: string[], outboxDir, openItems: string[] } | null`.

Rules for `planShip`:
- Not in `inbox/` → `{ ok: false, reasons: ['PRD <n> is not in the inbox (<state or "nowhere">)'] }`.
- Any open item → reason `open outbox item: <file>` for each.
- Any unreworked drift → reason `drifted, not reworked: <id>` for each.
- Moves: `inbox/<name>` → `shipped/<name>`; if `outbox/<name>` exists, `outbox/<name>` →
  `shipped/<name>/outbox`.
- Rewrites: in every tracked `.md`/`.html`/`.yml`/`.json` file **except any file named `settled.md`**,
  replace `<dirs.inbox>/<name>` with `<dirs.shipped>/<name>` and `<dirs.outbox>/<name>` with
  `<dirs.shipped>/<name>/outbox`. Only files whose text changes are listed.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo } from '../../test/fixture.mjs';
import { makeMarkers } from '../markers.mjs';
import { applyShip, planShip } from './ship.mjs';
import { whereIs } from './prd.mjs';

const D = '.omni-loop/delivery';
const m = makeMarkers('omni-outbox');
const agreed = (id) => [m.settledOpen(id), `## ${id} — agreed`, '- Verdict: agreed', '- Closed: yes — agreed', `See ${D}/inbox/0042-a/spec.md`, m.settledClose(id), ''].join('\n');

function tracked(root) {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
}

describe('planShip', () => {
  it('ships a PRD that never raised an outbox item', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/inbox/0042-a/plan.md`]: 'y' } });
    const plan = planShip(ctx, 42, { files: tracked(root), read });
    expect(plan).toEqual({ ok: true, moves: [{ from: `${D}/inbox/0042-a`, to: `${D}/shipped/0042-a` }], rewrites: [] });
  });

  it('moves the outbox inside the shipped folder and rewrites links, but never settled.md', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: {
      [`${D}/inbox/0042-a/spec.md`]: 'x',
      [`${D}/outbox/0042-a/settled.md`]: agreed('s1-01-x'),
      'README.md': `Spec: ${D}/inbox/0042-a/spec.md and ${D}/outbox/0042-a/settled.md\n`,
    } });
    const plan = planShip(ctx, 42, { files: tracked(root), read });
    expect(plan.moves).toEqual([
      { from: `${D}/inbox/0042-a`, to: `${D}/shipped/0042-a` },
      { from: `${D}/outbox/0042-a`, to: `${D}/shipped/0042-a/outbox` },
    ]);
    expect(plan.rewrites).toEqual([{ file: 'README.md', text: `Spec: ${D}/shipped/0042-a/spec.md and ${D}/shipped/0042-a/outbox/settled.md\n` }]);
  });

  it('refuses while an item is open or a drift is unreworked', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: {
      [`${D}/inbox/0042-a/spec.md`]: 'x',
      [`${D}/outbox/0042-a/s1-02-y.md`]: 'an open item',
      [`${D}/outbox/0042-a/settled.md`]: [m.settledOpen('s1-01-x'), '## s1-01-x — drifted', '- Verdict: drifted', '- Closed: no — x', m.settledClose('s1-01-x'), ''].join('\n'),
    } });
    const plan = planShip(ctx, 42, { files: tracked(root), read });
    expect(plan.ok).toBe(false);
    expect(plan.reasons).toEqual([`open outbox item: ${D}/outbox/0042-a/s1-02-y.md`, 'drifted, not reworked: s1-01-x']);
  });

  it('refuses a PRD that is not in the inbox', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: { [`${D}/shipped/0042-a/spec.md`]: 'x' } });
    expect(planShip(ctx, 42, { files: tracked(root), read }).reasons).toEqual(['PRD 42 is not in the inbox (shipped)']);
    expect(planShip(ctx, 9, { files: tracked(root), read }).reasons).toEqual(['PRD 9 is not in the inbox (nowhere)']);
  });
});

describe('applyShip', () => {
  it('moves with git and leaves settled.md byte-identical', () => {
    const { root, ctx } = makeRepo({ git: true, files: {
      [`${D}/inbox/0042-a/spec.md`]: 'x',
      [`${D}/outbox/0042-a/settled.md`]: agreed('s1-01-x'),
    } });
    applyShip(ctx, 42);
    expect(existsSync(join(root, `${D}/inbox/0042-a`))).toBe(false);
    expect(readFileSync(join(root, `${D}/shipped/0042-a/outbox/settled.md`), 'utf8')).toBe(agreed('s1-01-x'));
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })).toMatch(/^R /m);
  });

  it('throws with every reason when the plan refuses', () => {
    const { ctx } = makeRepo({ git: true, files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/outbox/0042-a/s1-02-y.md`]: 'open' } });
    expect(() => applyShip(ctx, 42)).toThrow(/open outbox item/);
  });
});

describe('whereIs', () => {
  it('describes a PRD in flight', () => {
    const { ctx } = makeRepo({ files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/outbox/0042-a/s1-01-x.md`]: 'y' } });
    expect(whereIs(ctx, '42')).toEqual({
      prd: 42, name: '0042-a', state: 'inbox', dir: `${D}/inbox/0042-a`,
      files: [`${D}/inbox/0042-a/spec.md`],
      outboxDir: `${D}/outbox/0042-a`,
      openItems: [`${D}/outbox/0042-a/s1-01-x.md`],
    });
  });
  it('is null for an unknown PRD', () => {
    expect(whereIs(makeRepo().ctx, 1)).toBeNull();
  });
});
```
- [ ] **Step 2: Run** — FAIL, modules missing.
- [ ] **Step 3: Implement `kit/lib/delivery/ship.mjs`**

```js
// The ship step: on the feature branch, before the feature pull request leaves draft, the PRD's
// inbox folder becomes its shipped folder and its outbox moves inside it. The human merge is what
// ships it — no bot writes to the default branch. settled.md is append-only and never rewritten.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { trackedFiles } from '../check-report.mjs';
import { openItemFiles, unreworkedDrift } from '../outbox/status.mjs';

const REWRITTEN = /\.(md|html|yml|yaml|json)$/;

export function planShip(ctx, prd, { files, read }) {
  const where = ctx.layout.whereIs(prd);
  if (where?.state !== 'inbox') {
    return { ok: false, reasons: [`PRD ${Number(prd)} is not in the inbox (${where ? where.state : 'nowhere'})`] };
  }
  const reasons = [
    ...openItemFiles(prd, { ctx }).map((file) => `open outbox item: ${file}`),
    ...unreworkedDrift(prd, { ctx }).map((entry) => `drifted, not reworked: ${entry.id}`),
  ];
  if (reasons.length) return { ok: false, reasons };

  const { dirs } = ctx.layout;
  const shipped = `${dirs.shipped}/${where.name}`;
  const outbox = `${dirs.outbox}/${where.name}`;
  const moves = [{ from: where.dir, to: shipped }];
  const hasOutbox = existsSync(join(ctx.root, outbox));
  if (hasOutbox) moves.push({ from: outbox, to: `${shipped}/outbox` });

  const rewrites = [];
  for (const file of files) {
    if (!REWRITTEN.test(file) || basename(file) === 'settled.md') continue;
    const before = read(file);
    let after = before.split(where.dir).join(shipped);
    if (hasOutbox) after = after.split(outbox).join(`${shipped}/outbox`);
    if (after !== before) rewrites.push({ file, text: after });
  }
  return { ok: true, moves, rewrites };
}

export function applyShip(ctx, prd, { exec = execFileSync } = {}) {
  const read = (file) => readFileSync(join(ctx.root, file), 'utf8');
  const plan = planShip(ctx, prd, { files: trackedFiles(ctx), read });
  if (!plan.ok) throw new Error(`Cannot ship PRD ${Number(prd)}:\n${plan.reasons.map((r) => `  - ${r}`).join('\n')}`);
  for (const { from, to } of plan.moves) {
    exec('git', ['mv', from, to], { cwd: ctx.root, stdio: 'ignore' });
  }
  for (const { file, text } of plan.rewrites) {
    const moved = plan.moves.reduce((path, { from, to }) => (path.startsWith(`${from}/`) ? to + path.slice(from.length) : path), file);
    writeFileSync(join(ctx.root, moved), text);
  }
  return plan;
}
```
Note: the second move's `from` (`outbox/<name>`) and the first move's `to` (`shipped/<name>`) are
disjoint, so the order is safe; `git mv` into `shipped/<name>/outbox` works because the first move
created `shipped/<name>`. `trackedFiles(ctx)` must return paths relative to `ctx.root`.

`kit/lib/delivery/prd.mjs`:
```js
// One lookup an agent runs before following any delivery path: where PRD <n> lives today.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { openItemFiles } from '../outbox/status.mjs';

export function whereIs(ctx, prd) {
  const where = ctx.layout.whereIs(prd);
  if (!where) return null;
  const absolute = join(ctx.root, where.dir);
  const files = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${where.dir}/${entry.name}`)
    .sort();
  const outboxDir = ctx.layout.outboxDir(prd);
  return {
    prd: Number(prd),
    name: where.name,
    state: where.state,
    dir: where.dir,
    files,
    outboxDir,
    openItems: openItemFiles(prd, { ctx }),
  };
}
```
- [ ] **Step 4: Run** — `pnpm vitest run kit/lib/delivery` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(kit): the ship step and the prd lookup`.

---

### Task 15: The `omni` CLI and its bundle

**Files:**
- Create: `kit/bin/omni.mjs` (dispatcher), `kit/bin/github.mjs` (the `gh` client, from upstream
  `ghClient` in `outbox-comment.mjs` plus the replies client), `kit/bin/commands/*.mjs`
- Create: `kit/build.mjs`, `kit/bin/omni.test.mjs`
- Modify: `.gitignore` (add `kit/dist/`)

**Interfaces:**
- Consumes: everything above.
- Produces: `main(argv: string[], { cwd, stdout, stderr, exec }) → Promise<number>` (exit code) in
  `kit/bin/omni.mjs`, and the subcommands:

| Command | Does | Rebuilt from upstream CLI half of |
|---|---|---|
| `omni config [key.path]` | prints the resolved config (JSON) or one value | — |
| `omni prd <n>` | `whereIs` as text | — |
| `omni status <prd> [--labels a,b] [--changes]` | gate report; exit 0 green / 1 red | `outbox-status.mjs` |
| `omni settle <item> --by --at --channel --number (--answer\|--answer-file) [--url] [--verdict]` | `settleItem` | `outbox-settle.mjs` |
| `omni adopt <item>` | `adoptItem` | `outbox-settle.mjs` |
| `omni replies --prd --pr [--post]` | `readReplies` with the `gh` client | `outbox-replies.mjs` |
| `omni comment --prd [--pr] [--branch] [--result f] [--pr-comment f] [--title] [--owner-slack-id]` | the two comments + Slack note file | `outbox-comment.mjs` |
| `omni ship <prd>` | `applyShip` | — |
| `omni check [inbox\|outbox\|knowledge\|coverage\|all]` | the guards; exit 1 on any violation | the `check-*.mjs` halves |
| `omni knowledge <id>` | `describeEntry` | `knowledge.mjs` |

  Exit codes: 0 ok, 1 a check/gate is red, 2 usage or config error (`ConfigError` → its message on
  one line to stderr, no stack).

- [ ] **Step 1: Write the failing tests** (`kit/bin/omni.test.mjs`) — each runs `main` against a
  `makeRepo({ git: true, files })` fixture that includes `.omni-loop/config.yml`:
```js
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

describe('omni', () => {
  it('exits 2 with one line outside a git repository', async () => {
    const s = io();
    expect(await main(['status', '1'], { cwd: mkdtempSync(join(tmpdir(), 'x-')), ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/^.*not inside a git repository\.\n$/);
  });

  it('exits 2 in a repository that is not terraformed', async () => {
    const { root } = makeRepo({ git: true });
    const s = io();
    expect(await main(['status', '1'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/not terraformed/);
  });

  it('prints one config value', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['config', 'labels.outboxGo'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toBe('outbox:go\n');
  });

  it('status is 0 with nothing open and 1 with an open item', async () => {
    const { root, write } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(0);
    write('.omni-loop/delivery/outbox/0042-a/s1-01-x.md', 'open');
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(1);
  });

  it('prints usage and exits 2 for an unknown command', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['nope'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/usage: omni <command>/);
  });
});
```
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement the dispatcher**

```js
#!/usr/bin/env node
// omni — the kit's one entry point. Installed into a repository as .omni-loop/bin/omni.mjs (bundled),
// called by the skills and by the outbox workflow. Exit 0 ok, 1 red, 2 usage or configuration.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ConfigError } from '../lib/config.mjs';
import { loadContext } from '../lib/context.mjs';
import { COMMAND_TABLE } from './commands/index.mjs';

const USAGE = `usage: omni <command> [args]\ncommands: ${Object.keys(COMMAND_TABLE).join(', ')}\n`;

export async function main(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, exec = execFileSync } = {}) {
  const [name, ...rest] = argv;
  const command = COMMAND_TABLE[name];
  if (!command) {
    stderr.write(USAGE);
    return 2;
  }
  try {
    const ctx = loadContext(cwd, { exec });
    return await command.run(rest, { ctx, stdout, stderr, exec });
  } catch (error) {
    if (error instanceof ConfigError || error?.name === 'UsageError') {
      stderr.write(`${error.message.split('\n')[0]}\n`);
      return 2;
    }
    throw error;
  }
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exit(1);
  });
}
```
  The "one line" rule prints only the first line of a `ConfigError`; Task 1's `parseConfig` already
  puts the file and the first offending key on that line.

  `kit/bin/commands/index.mjs` exports `COMMAND_TABLE = { config, prd, status, settle, adopt, replies, comment, ship, check, knowledge }`,
  each `{ run(args, { ctx, stdout, stderr, exec }) → Promise<number> }` in its own file. Each file's
  flag parsing is re-fetched from the upstream module's CLI half named in the table above
  (`git -C ../vertuo-ai-domain show c4a210122:scripts/<module>.mjs`), with `--repo` defaulting to
  `ctx.config.repo.slug` and every path argument resolved against `ctx.root`. Throw
  `Object.assign(new Error(msg), { name: 'UsageError' })` for a bad flag. `kit/bin/github.mjs`
  holds upstream's `ghClient` (from `outbox-comment.mjs`) and the replies client, both taking `exec`
  and, when `ctx.config.github.user` is set, prefixing calls with
  `GH_TOKEN=$(gh auth token --user <user>)` via the `env` option of `exec`.

- [ ] **Step 4: Run** — `pnpm vitest run kit/bin` — Expected: PASS.
- [ ] **Step 5: The bundle, test first.** Append to `kit/bin/omni.test.mjs`:
```js
import { cpSync, existsSync as exists, mkdirSync as mkdir } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

it('the bundle runs in a repository with no node_modules', () => {
  const kitRoot = fileURLToPath(new URL('..', import.meta.url));
  execFileSync('node', [join(kitRoot, 'build.mjs')], { stdio: 'ignore' });
  const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
  mkdir(join(root, '.omni-loop/bin'), { recursive: true });
  cpSync(join(kitRoot, 'dist/omni.mjs'), join(root, '.omni-loop/bin/omni.mjs'));
  expect(exists(join(root, 'node_modules'))).toBe(false);
  const out = execFileSync('node', ['.omni-loop/bin/omni.mjs', 'prd', '42'], { cwd: root, encoding: 'utf8' });
  expect(out).toMatch(/0042-a/);
});
```
  `kit/build.mjs`:
```js
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const kit = fileURLToPath(new URL('.', import.meta.url));
await build({
  entryPoints: [`${kit}bin/omni.mjs`],
  outfile: `${kit}dist/omni.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  legalComments: 'none',
});
```
  (The `#!` line in `omni.mjs` is preserved by esbuild as the first line; the banner goes after it.)
  Run: PASS. Add `kit/dist/` to `.gitignore`.
- [ ] **Step 6: Gate** — `pnpm vitest run kit` all green. **Commit** — `feat(kit): the omni CLI and its dependency-free bundle`.

---

### Task 16: Three profiles, end to end

**Files:**
- Create: `kit/test/profiles.test.mjs`

**Interfaces:** Consumes `main` (Task 15) and `makeRepo`. Produces nothing new — this is the phase's
acceptance test (spec §13 phase 1: "fixture tests green for three profiles").

- [ ] **Step 1: Write the test.** One `describe.each` over three profiles; each builds a git fixture
  with a config, one PRD in the inbox, one open `high` item, and runs the loop through `main`:

```js
import { describe, expect, it } from 'vitest';
import { makeRepo } from './fixture.mjs';
import { main } from '../bin/omni.mjs';

const quiet = () => ({ stdout: { write() {} }, stderr: { write() {} } });
const D = '.omni-loop/delivery';

const PROFILES = [
  {
    name: 'knowledge',
    config: 'kit: 1\nrepo:\n  slug: acme/a\nlaws:\n  source: knowledge\n',
    extra: { '.omni-loop/knowledge/product/principles.md': PRINCIPLE_P_PRODUCT_1 },
    bearsOn: 'P-PRODUCT-1',
  },
  {
    name: 'claudeMdInvariants',
    config: 'kit: 1\nrepo:\n  slug: acme/b\npaths:\n  adr: docs/adr\nlaws:\n  source: claudeMdInvariants\n',
    extra: { 'CLAUDE.md': '## Invariants\n\n- x (ADR-0004)\n', 'docs/adr/0004-tenants.md': '# 4\n' },
    bearsOn: 'ADR-0004',
  },
  { name: 'none', config: 'kit: 1\nrepo:\n  slug: acme/c\n', extra: {}, bearsOn: 'none' },
];

describe.each(PROFILES)('profile $name', ({ config, extra, bearsOn }) => {
  it('checks clean, goes red on an item, settles, goes green, ships', async () => {
    const { root } = makeRepo({ git: true, files: {
      '.omni-loop/config.yml': config,
      [`${D}/inbox/0042-a/spec.md`]: SPEC_42,
      [`${D}/outbox/0042-a/s1-01-x.md`]: itemText({ prd: 42, bearsOn, rank: 'high' }),
      ...extra,
    } });
    expect(await main(['check', 'all'], { cwd: root, ...quiet() })).toBe(0);
    expect(await main(['status', '42'], { cwd: root, ...quiet() })).toBe(1);
    expect(await main(['settle', `${D}/outbox/0042-a/s1-01-x.md`, '--by', 'pm', '--at', '2026-09-24',
      '--channel', 'feature-pull-request', '--number', '7', '--answer', 'Yes, keep it.'], { cwd: root, ...quiet() })).toBe(0);
    expect(await main(['status', '42'], { cwd: root, ...quiet() })).toBe(0);
    expect(await main(['ship', '42'], { cwd: root, ...quiet() })).toBe(0);
    expect(await main(['prd', '42'], { cwd: root, ...quiet() })).toBe(0);
  });
});
```
  Define at the top of the file: `SPEC_42` (a valid `spec.md` for PRD 42 per Task 12's schema),
  `PRINCIPLE_P_PRODUCT_1` (the principle fixture from Task 4), and `itemText({ prd, bearsOn, rank })`
  (the valid item fixture from Task 5's ported test, parameterised on those three front-matter
  fields). Copy them — do not import from other test files.
- [ ] **Step 2: Run** — `pnpm vitest run kit/test/profiles.test.mjs` — Expected: PASS for all
  three. A failure here is a real integration bug: fix it in the owning module, with a unit test
  there, before re-running.
- [ ] **Step 3: Full suite** — `pnpm test` (game and kit) — Expected: all green.
- [ ] **Step 4: Commit** — `test(kit): the loop end to end under three law profiles`.

---

## Self-review notes

- Spec coverage for phase 1: config (§4) T1; layout and folder-is-status (§3, §5) T2, T12, T14;
  knowledge and laws (§6) T3, T4; outbox items, adopted, settled, accounts (§7) T5, T6, T8; drift
  stays red and `Became:` resolves (§7 changes) T9, T7; replies, comments, Slack opt-in (§8) T10,
  T11; policies (§9, "policy stays tested code") T13; bundled Node-only bin (§11) T15; three
  profiles (§13) T16. Out of this phase by design: the workflow template (phase 2), skills (phase 3),
  `omni-loop init/doctor/remove` (phase 4), the game's path change (phase 5).
- Review Focus → owning tests: typo'd key T1; PRD width T2; ambiguous ADR T4; ship with no outbox /
  settled.md untouched T14; bundle without `node_modules` and outside git / untracked config T15.
