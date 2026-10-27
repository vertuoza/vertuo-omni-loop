// apps/omni-app/src/env.ts
import { z as z3 } from "zod";

// kit/lib/env/group.ts
import "zod";
var EnvError = class extends Error {
  problems;
  constructor(problems) {
    super(`environment: ${problems.map((problem) => problem.reason).join("; ")}`);
    this.name = "EnvError";
    this.problems = problems;
  }
};
function envGroup(group) {
  return group;
}
var listOf = (names) => typeof names === "string" ? [names] : names;
function nameOf(names) {
  const [first, ...rest] = listOf(names);
  return rest.length ? `${first} (or ${rest.join(" or ")})` : `${first}`;
}
var sentence = (names) => names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
var verb = (names) => names.length === 1 ? "is" : "are";
function variablesOf(groups) {
  return [...new Set(groups.flatMap((group) => Object.values(group.variables).flatMap(listOf)))];
}
function requiredVariables(group) {
  return members(group).filter((member) => member.required).map((member) => member.name);
}
function members(group) {
  const shape = group.schema.shape;
  return Object.entries(group.variables).map(([key, names]) => ({
    key,
    names,
    name: nameOf(names),
    required: shape[key]?.safeParse(void 0).success !== true
  }));
}
function valueOf(source, names) {
  for (const name of listOf(names)) {
    const value = source[name];
    if (value !== void 0 && value !== "") return value;
  }
  return void 0;
}
function readGroup(source, group, production) {
  const all = members(group);
  const raw = {};
  for (const member of all) {
    const value = valueOf(source, member.names);
    if (value !== void 0) raw[member.key] = value;
  }
  const set = all.filter((member) => Object.hasOwn(raw, member.key));
  if (set.length === 0) {
    if (group.required === "production" && production) {
      const names = requiredVariables(group);
      return { value: null, problems: [{ variables: names, reason: `${sentence(names)} must be set in production (${group.label})` }] };
    }
    return { value: null, problems: [] };
  }
  const missing = all.filter((member) => member.required && !Object.hasOwn(raw, member.key));
  if (missing.length) {
    const unset = missing.map((member) => member.name);
    const given = set.map((member) => member.name);
    return {
      value: null,
      problems: [{
        variables: [...given, ...unset],
        reason: `${sentence(unset)} ${verb(unset)} not set while ${sentence(given)} ${verb(given)} (${group.label}: set all of them, or none)`
      }]
    };
  }
  const parsed = group.schema.safeParse(raw);
  if (parsed.success) return { value: parsed.data, problems: [] };
  const byKey = new Map(all.map((member) => [member.key, member.name]));
  return {
    value: null,
    problems: parsed.error.issues.map((issue) => {
      const name = byKey.get(String(issue.path[0] ?? "")) ?? group.label;
      return { variables: [name], reason: `${name} is not valid: ${issue.message}` };
    })
  };
}
function envReader(source, { production = false } = {}) {
  const problems = [];
  return {
    group(group) {
      const read = readGroup(source, group, production);
      problems.push(...read.problems);
      return read.value;
    },
    done() {
      if (problems.length) throw new EnvError(problems);
    }
  };
}

// kit/lib/openrouter.ts
import { z as z2 } from "zod";

// kit/lib/schema/messages.ts
var NAMED_CLASSES = [
  [Date, "date"],
  [Map, "map"],
  [Set, "set"],
  [Promise, "promise"]
];
function receivedType(value) {
  if (value === void 0) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isNaN(value) ? "nan" : "number";
  return NAMED_CLASSES.find(([type]) => value instanceof type)?.[1] ?? typeof value;
}
var quoted = (values) => values.map((value) => `'${String(value)}'`).join(" | ");
var MEASURES = /* @__PURE__ */ new Map([
  ["string", "string"],
  ["array", "array"],
  ["set", "array"],
  ["number", "number"],
  ["int", "number"],
  ["bigint", "number"]
]);
var SENTENCES = {
  string: (words, limit) => `String must contain ${words} ${limit} character(s)`,
  array: (words, limit) => `Array must contain ${words} ${limit} element(s)`,
  number: (words, limit) => `Number must be ${words} ${limit}`
};
var TOO_SMALL = {
  string: { exact: "exactly", inclusive: "at least", exclusive: "over" },
  array: { exact: "exactly", inclusive: "at least", exclusive: "more than" },
  number: { exact: "exactly equal to", inclusive: "greater than or equal to", exclusive: "greater than" }
};
var TOO_BIG = {
  string: { exact: "exactly", inclusive: "at most", exclusive: "under" },
  array: { exact: "exactly", inclusive: "at most", exclusive: "less than" },
  number: { exact: "exactly", inclusive: "less than or equal to", exclusive: "less than" }
};
function boundOf(inclusive, exact) {
  if (exact) return "exact";
  return inclusive ? "inclusive" : "exclusive";
}
function sizeMessage(words, origin, limit, bound) {
  const measure = MEASURES.get(origin);
  return measure === void 0 ? void 0 : SENTENCES[measure](words[measure][bound], limit);
}
function invalidType(issue) {
  if (issue.input === void 0) return "Required";
  const received = receivedType(issue.input);
  if (issue.expected === "int") return `Expected integer, received ${received === "number" ? "float" : received}`;
  return `Expected ${issue.expected}, received ${received}`;
}
function invalidValue(issue) {
  if (issue.values.length === 1) return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
  return `Invalid enum value. Expected ${quoted(issue.values)}, received '${String(issue.input)}'`;
}
function invalidUnion(issue) {
  const options = "options" in issue && Array.isArray(issue.options) ? issue.options : null;
  return options && "discriminator" in issue ? `Invalid discriminator value. Expected ${quoted(options)}` : "Invalid input";
}
var BY_CODE = {
  invalid_type: invalidType,
  too_small: (issue) => sizeMessage(TOO_SMALL, issue.origin, issue.minimum, boundOf(issue.inclusive, issue.exact)),
  too_big: (issue) => sizeMessage(TOO_BIG, issue.origin, issue.maximum, boundOf(issue.inclusive, issue.exact)),
  invalid_value: invalidValue,
  unrecognized_keys: (issue) => `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(", ")}`,
  invalid_format: (issue) => issue.format === "regex" ? "Invalid" : `Invalid ${issue.format}`,
  invalid_union: invalidUnion,
  not_multiple_of: (issue) => `Number must be a multiple of ${issue.divisor}`,
  custom: () => "Invalid input"
};
function wordIssue(issue) {
  const words = BY_CODE[issue.code];
  return words?.(issue);
}
var KIT_MESSAGES = (issue) => wordIssue(issue);

// kit/lib/openrouter.ts
var KEY_VAR = "OPENROUTER_API_KEY";
var MODEL_VAR = "OPENROUTER_MODEL";
var MODEL_CALL = Object.freeze({
  attempts: 3,
  backoffMs: Object.freeze([1e3, 4e3]),
  budgetMs: 24e4,
  maxTokens: 4096
});
var SECRETS = Object.freeze([
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}/g,
  /\bwhsec_[A-Za-z0-9+/=]{16,}/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/g
]);
var Text = z2.string().optional().catch(void 0);
var ModelBody = z2.object({
  error: z2.unknown().optional(),
  choices: z2.array(
    z2.object({
      message: z2.object({ content: Text }).catch({ content: void 0 }),
      delta: z2.object({ content: Text }).catch({ content: void 0 })
    }).catch({ message: { content: void 0 }, delta: { content: void 0 } })
  ).catch([])
}).catch({ error: void 0, choices: [] });
var ErrorCode = z2.object({ code: z2.union([z2.string(), z2.number()]).optional().catch(void 0) }).catch({ code: void 0 });
var Thrown = z2.object({ name: z2.unknown().optional(), message: z2.unknown().optional() }).catch({ name: void 0, message: void 0 });

// apps/omni-app/src/env.ts
var DEFAULT_GALAXY_URL = "https://www.omni-loop.xyz";
var VERCEL = envGroup({
  label: "the Vercel environment",
  schema: z3.object({ name: z3.string().optional(), commit: z3.string().optional() }),
  variables: { name: "VERCEL_ENV", commit: "VERCEL_GIT_COMMIT_SHA" }
});
var secretGroup = (label, variable, required) => envGroup({ label, schema: z3.object({ secret: z3.string() }), variables: { secret: variable }, ...required ? { required } : {} });
var WEBHOOK = secretGroup("the webhook secret", "GITHUB_WEBHOOK_SECRET", "production");
var GITHUB_APP = envGroup({
  label: "the GitHub App",
  schema: z3.object({
    id: z3.string().regex(/^\d+$/, "must be a number"),
    // A key pasted with literal `\n` sequences is accepted (README, "Setup").
    privateKey: z3.string().transform((pem) => pem.replace(/\\n/g, "\n"))
  }),
  variables: { id: "GITHUB_APP_ID", privateKey: "GITHUB_APP_PRIVATE_KEY" },
  required: "production"
});
var SUPABASE = envGroup({
  label: "the Supabase pair",
  schema: z3.object({ url: z3.url(), key: z3.string() }),
  variables: { url: "SUPABASE_URL", key: "SUPABASE_SERVICE_ROLE_KEY" }
});
var OPENROUTER = envGroup({ label: "OpenRouter", schema: z3.object({ key: z3.string(), model: z3.string().optional() }), variables: { key: KEY_VAR, model: MODEL_VAR } });
var STAGE_EVENTS = secretGroup("the stage events", "STAGE_EVENT_SECRET");
var CONSTITUENT_JUDGE = secretGroup("the constituent judge", "CONSTITUENT_JUDGE_SECRET");
var LAW_JUDGE = secretGroup("the law judge", "LAW_JUDGE_SECRET");
var GALAXY = envGroup({
  label: "galaxy",
  schema: z3.object({ url: z3.url().optional() }),
  variables: { url: "GALAXY_URL" }
});
var VARIABLES = variablesOf([WEBHOOK, GITHUB_APP, SUPABASE, OPENROUTER, STAGE_EVENTS, CONSTITUENT_JUDGE, LAW_JUDGE, GALAXY]);
var PLATFORM_VARIABLES = variablesOf([VERCEL]);
function readEnv(source) {
  const production = envReader(source).group(VERCEL)?.name === "production";
  const reader = envReader(source, { production });
  const env = {
    production,
    webhook: reader.group(WEBHOOK),
    githubApp: reader.group(GITHUB_APP),
    supabase: reader.group(SUPABASE),
    openrouter: reader.group(OPENROUTER),
    stageEvents: reader.group(STAGE_EVENTS),
    constituentJudge: reader.group(CONSTITUENT_JUDGE),
    lawJudge: reader.group(LAW_JUDGE),
    galaxyUrl: (reader.group(GALAXY)?.url ?? DEFAULT_GALAXY_URL).replace(/\/+$/, "")
  };
  reader.done();
  return env;
}
function processEnv() {
  return process.env;
}

// kit/lib/log/log.ts
var LOG_FIELDS = [
  "level",
  "event",
  "outcome",
  "ms",
  "repo",
  "prd",
  "deliveryId",
  "runId",
  "fn",
  "status",
  "error",
  "message",
  "repos",
  "dropped"
];
var MAX_TEXT = 500;
var MASK = "***";
var ALLOWED = new Set(LOG_FIELDS.filter((field) => field !== "level" && field !== "dropped"));
var CUT = /* @__PURE__ */ new Set(["message"]);
var CREDENTIALS = [
  [/github_pat_[A-Za-z0-9_]+/g, MASK],
  [/gh[pousr]_[A-Za-z0-9_]+/g, MASK],
  [/omk_[A-Za-z0-9_-]+/g, MASK],
  [/\bsk-[A-Za-z0-9_-]+/g, MASK],
  [/\b(bearer)\s+[^\s"',;]+/gi, `$1 ${MASK}`],
  [/([?&][^=&#\s"']*(?:key|token|secret|code|signature)[^=&#\s"']*=)[^&#\s"']*/gi, `$1${MASK}`]
];
function maskCredentials(text3) {
  return CREDENTIALS.reduce((masked, [shape, replacement]) => masked.replace(shape, replacement), text3);
}
var cut = (text3) => text3.length > MAX_TEXT ? text3.slice(0, MAX_TEXT) : text3;
function errorOf(value) {
  if (value instanceof Error) {
    return { name: maskCredentials(value.name), message: cut(maskCredentials(value.message)) };
  }
  return { name: "Error", message: cut(maskCredentials(typeof value === "string" ? value : String(value))) };
}
function scalarOf(field, value) {
  if (typeof value === "string") {
    const masked = maskCredentials(value);
    return CUT.has(field) ? cut(masked) : masked;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
  if (typeof value === "boolean" || value === null) return value;
  return void 0;
}
function lineOf(level, entry) {
  const line = { level };
  let dropped = 0;
  for (const [field, value] of Object.entries(entry)) {
    if (value === void 0) continue;
    if (!ALLOWED.has(field)) {
      dropped += 1;
      continue;
    }
    if (field === "error") {
      line.error = errorOf(value);
      continue;
    }
    const scalar = scalarOf(field, value);
    if (scalar === void 0) dropped += 1;
    else line[field] = scalar;
  }
  if (dropped > 0) line.dropped = dropped;
  return JSON.stringify(line);
}
var stdout = (line) => {
  process.stdout.write(`${line}
`);
};
function createLogger({ sink = stdout, clock = Date.now } = {}) {
  const write2 = (level, entry) => {
    try {
      sink(lineOf(level, entry));
    } catch {
    }
  };
  const now2 = () => {
    try {
      return clock();
    } catch {
      return Number.NaN;
    }
  };
  return {
    info: (entry) => {
      write2("info", entry);
    },
    warn: (entry) => {
      write2("warn", entry);
    },
    error: (entry) => {
      write2("error", entry);
    },
    timer: () => {
      const start = now2();
      return () => Math.max(0, Math.round(now2() - start)) || 0;
    }
  };
}
var log = createLogger();

// apps/omni-app/src/inngest-client.ts
import { Inngest } from "inngest";
import { z as z5 } from "zod";

// kit/lib/ids.ts
import { z as z4 } from "zod";
var IssueNumberSchema = z4.number().int().positive().brand();
var PrdNumberSchema = IssueNumberSchema.brand();
var PRODUCT_SEQ_MAX = 2 ** 31 - 1;
var PRODUCT_PRD = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([1-9]\d{0,9})$/;
var ProductPrdIdSchema = z4.string().regex(PRODUCT_PRD).refine((id) => {
  const cut2 = id.lastIndexOf("-");
  return cut2 <= 40 && Number(id.slice(cut2 + 1)) <= PRODUCT_SEQ_MAX;
}).brand();
var PRODUCT_ROADMAP = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-R([1-9]\d{0,9})$/;
var ProductRoadmapIdSchema = z4.string().regex(PRODUCT_ROADMAP).refine((id) => {
  const cut2 = id.lastIndexOf("-R");
  return cut2 <= 40 && Number(id.slice(cut2 + 2)) <= PRODUCT_SEQ_MAX;
}).brand();
var PRODUCT_BUG = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-B([1-9]\d{0,9})$/;
var ProductBugIdSchema = z4.string().regex(PRODUCT_BUG).refine((id) => {
  const cut2 = id.lastIndexOf("-B");
  return cut2 <= 40 && Number(id.slice(cut2 + 2)) <= PRODUCT_SEQ_MAX;
}).brand();
var PrNumberSchema = z4.number().int().positive().brand();
var CommentIdSchema = z4.number().int().positive().brand();
var WorkSliceIdSchema = z4.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).brand();
var SliceIdSchema = z4.string().regex(/^s\d+$/).brand().brand();
var OutboxItemIdSchema = z4.string().regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?s\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/).brand();

// apps/omni-app/src/inngest-client.ts
var APP_ID = "omni-loop";
var OUTBOX_CHECK_EVENT = "omni-loop/outbox.check.requested";
var INBOX_CHECK_EVENT = "omni-loop/inbox.check.requested";
var INBOX_EXTERNAL_ID = "omni-loop/inbox";
var APPROVED_CHECK_EVENT = "omni-loop/approved.check.requested";
var APPROVED_EXTERNAL_ID = "omni-loop/approved";
var APPROVED_LABEL_EVENT = "omni-loop/approved.label.changed";
var BUDGETS_CHECK_EVENT = "omni-loop/budgets.check.requested";
var BUDGETS_EXTERNAL_ID = "omni-loop/budgets";
var RETRO_EVENT = "omni-loop/retro.requested";
var HARVEST_EVENT = "omni-loop/knowledge.harvest.requested";
var inngest = new Inngest({ id: APP_ID });
var SourceSchema = z5.looseObject({
  installationId: z5.number(),
  owner: z5.string(),
  repo: z5.string(),
  repository: z5.string()
});
var CheckRequestDataSchema = SourceSchema.extend({
  prNumber: PrNumberSchema,
  headSha: z5.string(),
  trigger: z5.string().optional()
});
var ApprovedLabelDataSchema = SourceSchema.extend({
  prd: PrdNumberSchema,
  trigger: z5.string().optional()
});
var CanonFactsSchema = z5.object({
  prd: PrdNumberSchema,
  persona: z5.string().nullable(),
  claims: z5.array(z5.string())
});
var CanonActionRequestDataSchema = SourceSchema.extend({
  prNumber: PrNumberSchema,
  headSha: z5.string().optional(),
  checkRunId: z5.number().optional(),
  action: z5.string(),
  facts: CanonFactsSchema
});
var FailureEventDataSchema = z5.looseObject({
  event: z5.looseObject({ data: z5.unknown() }),
  error: z5.looseObject({ message: z5.unknown() }).nullish()
});

// apps/omni-app/src/stage-forward/stage-forward.ts
import { createHmac } from "node:crypto";
import { z as z9 } from "zod";

// kit/lib/config.ts
import { existsSync as existsSync2, readFileSync } from "node:fs";
import { join as join2 } from "node:path";
import { parse } from "yaml";
import { z as z7 } from "zod";

// kit/lib/narrow.ts
function isOneOf(values, value) {
  return values.some((member) => member === value);
}
function propertyOf(value, key) {
  return value === null || value === void 0 ? void 0 : Reflect.get(Object(value), key);
}
function messageOf(error) {
  const message = propertyOf(error, "message");
  return typeof message === "string" ? message : String(error);
}

// kit/lib/design/words/selector.ts
var NAME = String.raw`[A-Za-z_][\w-]*`;
var PART = String.raw`(?:#(${NAME})|\.(${NAME})|\[\s*(${NAME})\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s"']+))\s*)?\])`;
var COMPOUND = new RegExp(String.raw`^(\*|${NAME})?((?:${PART})*)$`);
function parseCompound(text3) {
  const compound = COMPOUND.exec(text3.trim());
  if (!compound || compound[0] === "") return null;
  const [, tag, parts = ""] = compound;
  const matched = [...parts.matchAll(new RegExp(PART, "g"))];
  return {
    tag: tag === void 0 || tag === "*" ? null : tag.toLowerCase(),
    ids: matched.flatMap(([, id]) => id === void 0 ? [] : [id]),
    classes: matched.flatMap(([, , className]) => className === void 0 ? [] : [className]),
    attributes: matched.flatMap(([, , , name, doubled, single, bare]) => name === void 0 ? [] : [{ name: name.toLowerCase(), value: doubled ?? single ?? bare ?? null }])
  };
}
function parseSelector(source) {
  const compounds = [];
  for (const piece of source.split(",")) {
    const compound = parseCompound(piece);
    if (!compound) return null;
    compounds.push(compound);
  }
  return { source, compounds };
}

// kit/lib/flow/schema.ts
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z as z6 } from "zod";

// kit/lib/flow/points.ts
var HOOK_MODES = Object.freeze(["before", "after", "replace"]);
var EXTEND = Object.freeze(["before", "after"]);
var ANY = HOOK_MODES;
var SLICE_INPUTS = Object.freeze(["prd", "slice", "territory", "branch"]);
var FLOW_POINTS = Object.freeze([
  { point: "plan.slice", skills: ["plan", "mega-brainstorm"], modes: EXTEND, inputs: ["prd", "slice", "territory"], outputs: [] },
  { point: "plan.done", skills: ["plan"], modes: EXTEND, inputs: ["prd", "plan"], outputs: [] },
  { point: "do-work.start", skills: ["do-work"], modes: EXTEND, inputs: SLICE_INPUTS, outputs: [] },
  { point: "do-work.test", skills: ["do-work"], modes: ANY, inputs: SLICE_INPUTS, outputs: ["the verdict line"] },
  { point: "do-work.review", skills: ["do-work"], modes: EXTEND, inputs: SLICE_INPUTS, outputs: [] },
  { point: "do-work.ready", skills: ["do-work"], modes: EXTEND, inputs: SLICE_INPUTS, outputs: [] },
  {
    point: "pr.open",
    skills: ["pr"],
    modes: ANY,
    inputs: ["base", "head", "title", "body", "draft"],
    outputs: ["the PR's URL as its last line before the verdict", "the verdict line"]
  },
  { point: "wave.merge", skills: ["wave", "ultra-wave"], modes: ANY, inputs: ["prd", "slice", "pr"], outputs: ["the merged PR's number in the verdict"] },
  { point: "yolo.ready", skills: ["yolo", "ultra-yolo"], modes: EXTEND, inputs: ["prd", "pr"], outputs: [] }
]);
function flowPoint(name) {
  return FLOW_POINTS.find(({ point }) => point === name);
}

// kit/lib/flow/schema.ts
var CLAUDE_ALIAS = "claude";
var DEFAULT_AREA = "default";
var text = z6.string().min(1);
var regexSource = z6.string().refine((source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}, "not a valid regular expression");
var hookRef = z6.union([text, z6.object({ path: text, alias: z6.literal(CLAUDE_ALIAS) }).strict()]);
var hookRefs = z6.union([hookRef, z6.array(hookRef).min(1)]);
var pointHooks = z6.union([
  hookRef,
  z6.object({ before: hookRefs.optional(), after: hookRefs.optional(), replace: hookRef.optional() }).strict()
]);
function hookRefProblem(ref) {
  const path = typeof ref === "string" ? ref : ref.path;
  const claude = typeof ref !== "string";
  if (claude && /^\/[\w.:-]+$/.test(path)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return `${path} is a URL \u2014 name a file of this repository by its path`;
  if (path.startsWith("/") || path.startsWith("\\")) return `${path} is an absolute path \u2014 name a file of this repository by its path from the root`;
  if (path.split(/[\\/]/).includes("..")) return `${path} holds .. \u2014 name a file of this repository by its path from the root`;
  if (!claude && (path === ".claude" || path.startsWith(".claude/"))) {
    return `${path} sits under .claude/, which only Claude Code reads \u2014 move it to .agents/hooks/, or mark it { path: ${path}, alias: claude }`;
  }
  return null;
}
var asList = (refs) => refs === void 0 ? [] : Array.isArray(refs) ? refs : [refs];
var isBare = (value) => typeof value === "string" || "path" in value;
function hooksByMode(value) {
  if (typeof value === "string" || "path" in value) return { before: [], after: [value], replace: null };
  return { before: asList(value.before), after: asList(value.after), replace: value.replace ?? null };
}
function eachHook(point, value) {
  const { before, after, replace } = hooksByMode(value);
  const one = (mode, ref) => ({ key: isBare(value) ? [point] : [point, mode], mode, ref });
  return [
    ...before.map((ref) => one("before", ref)),
    ...replace === null ? [] : [one("replace", replace)],
    ...after.map((ref) => one("after", ref))
  ];
}
var KNOWN_POINTS = FLOW_POINTS.map(({ point }) => point).join(", ");
var hooksSection = z6.record(z6.string(), pointHooks).superRefine((hooks, issues) => {
  for (const [name, value] of Object.entries(hooks)) {
    const point = flowPoint(name);
    if (!point) {
      issues.addIssue({ code: "custom", path: [name], message: `not a point of the catalog (${KNOWN_POINTS})` });
      continue;
    }
    for (const { key, mode, ref } of eachHook(name, value)) {
      if (mode === "replace" && !point.modes.includes("replace")) {
        issues.addIssue({ code: "custom", path: key, message: `${name} takes before and after hooks only: its act is never replaced` });
      }
      const problem = hookRefProblem(ref);
      if (problem) issues.addIssue({ code: "custom", path: key, message: problem });
    }
  }
});
var planRule = z6.union([
  z6.object({ slice: z6.object({ alone: z6.boolean().optional(), maxFiles: z6.number().int().positive().optional() }).strict() }).strict(),
  z6.object({ wave: z6.literal("first") }).strict(),
  z6.object({ blocks: z6.literal("all") }).strict(),
  z6.object({ landing: z6.literal("alone") }).strict()
]);
var MERGE_METHODS = Object.freeze(["squash", "merge", "rebase"]);
var subPrRules = z6.object({
  merge: z6.enum(MERGE_METHODS).optional(),
  requireChecks: z6.array(text).optional(),
  approval: z6.literal("person").optional(),
  territory: z6.enum(["report", "block"]).optional(),
  maxOpen: z6.number().int().positive().optional()
}).strict();
var rulesSection = z6.object({ plan: z6.array(planRule).optional(), subPr: subPrRules.optional() }).strict();
var area = z6.object({
  paths: z6.array(regexSource).min(1, "at least one path pattern"),
  knowledge: text.optional(),
  inherit: z6.boolean().optional(),
  rules: rulesSection.optional(),
  hooks: hooksSection.optional()
}).strict();
var AREA_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
var FlowSchema = z6.object({
  rules: rulesSection.optional(),
  hooks: hooksSection.optional(),
  areas: z6.record(z6.string(), area).optional(),
  // Reserved for events, which a later PRD defines: refused until then, never read.
  on: z6.unknown().optional()
}).strict().superRefine((flow, issues) => {
  if (flow.on !== void 0) {
    issues.addIssue({ code: "custom", path: ["on"], message: "reserved for events, which a later PRD defines \u2014 remove it" });
  }
  for (const name of Object.keys(flow.areas ?? {})) {
    if (name === DEFAULT_AREA) {
      issues.addIssue({ code: "custom", path: ["areas", name], message: `${DEFAULT_AREA} names the root of flow \u2014 call this area something else` });
    } else if (!AREA_NAME.test(name)) {
      issues.addIssue({ code: "custom", path: ["areas", name], message: "an area is named by one kebab-case word, such as kernel" });
    }
  }
});

// kit/lib/layers/layers.ts
var CANONICAL_LAYERS = Object.freeze({
  ui: "screens and components",
  api: "REST or RPC routes and their payloads",
  schema: "GraphQL or other typed contracts callers compile against",
  db: "stored shapes, migrations, row-level security",
  auth: "identity, sign-in, access",
  event: "webhooks, queues, messages between services",
  cli: "commands a person or an agent types",
  job: "cron, workers, background runs",
  infra: "deploy, environments, hosting",
  ci: "pipelines, hooks, checks"
});
var CANONICAL_ROLES = Object.freeze({
  api: "serves routes, data and business rules to other repositories",
  web: "a web application a person opens in a browser",
  mobile: "a mobile application",
  ui: "a shared set of screens, components or design tokens",
  library: "code other repositories install and call",
  infra: "deploy, environments and hosting for the product",
  plan: "holds the product's plans and delivery, and builds no feature itself",
  doc: "documentation, guides and written knowledge",
  monorepo: "several of the roles above in one repository"
});
var ROLE_LAYERS = Object.freeze({
  api: ["api", "schema", "db", "auth", "event", "job"],
  web: ["ui", "auth", "api"],
  mobile: ["ui", "auth", "api"],
  ui: ["ui"],
  library: ["api", "cli"],
  infra: ["infra", "ci"],
  plan: ["cli", "ci"],
  doc: [],
  monorepo: ["ui", "api", "schema", "db", "auth", "event", "cli", "job", "infra", "ci"]
});
var LAYER_ALIASES = Object.freeze({
  rest: "api",
  graphql: "schema",
  database: "db",
  migration: "db"
});
var ROLE_ALIASES = Object.freeze({
  "back-end": "api",
  backend: "api",
  "front-end": "web",
  frontend: "web",
  docs: "doc"
});
var has = (table, word) => Object.hasOwn(table, word);
function layerOf(word) {
  return has(LAYER_ALIASES, word) ? LAYER_ALIASES[word] ?? word : word;
}
var layerList = () => Object.keys(CANONICAL_LAYERS).join(", ");

// kit/lib/config.ts
var CONFIG_FILE = ".omni-loop/config.yml";
var CONFIG_VERSION = 1;
var ConfigError = class extends Error {
  /** True when the file was read and does not hold a valid config, false when there is no file to read. */
  invalid;
  constructor(message, { invalid = false } = {}) {
    super(message);
    this.name = "ConfigError";
    this.invalid = invalid;
  }
};
var text2 = z7.string().min(1);
var nullableText = text2.nullable();
var branchTemplate = z7.string().min(1);
var labelName = z7.string().min(1);
var section = (shape) => z7.preprocess((value) => value === void 0 ? {} : value, z7.object(shape).strict());
var trailerPart = text2.regex(/^[^<>\r\n]+$/, "one line, with no < or >");
var askUrl = z7.string().refine((value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" || url.protocol === "http:" && url.hostname === "127.0.0.1";
}, "an https URL, or http on 127.0.0.1");
var httpsUrl = z7.string().refine((value) => {
  if (/\s/.test(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "an absolute https URL");
var PROOF_GITHUB_DEPLOYMENT = "github-deployment";
var proofUrl = z7.string().refine((value) => {
  if (value === PROOF_GITHUB_DEPLOYMENT) return true;
  if (/\s/.test(value)) return false;
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, `${PROOF_GITHUB_DEPLOYMENT}, or an absolute http(s) URL`);
var envName = z7.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "the name of an environment variable, such as VERCEL_AUTOMATION_BYPASS_SECRET");
var wordSelector = text2.refine((value) => parseSelector(value) !== null, "a selector of tags, #ids, .classes and [attributes], comma-separated, with no combinator");
var lawOwner = z7.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9_.-]+)?$/, "a GitHub login or <org>/<team>, without @");
var personLogin = z7.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/, "a GitHub login, without @, never a team");
var ownerWithDelegate = z7.preprocess(
  (value) => isRecord(value) ? { login: "", delegate: "", ...value } : value,
  z7.object({ login: personLogin, delegate: personLogin }).strict().refine((entry) => entry.login.toLowerCase() !== entry.delegate.toLowerCase(), {
    message: "a delegate other than its own owner",
    path: ["delegate"]
  })
);
var lawOwnerEntry = z7.union([lawOwner, ownerWithDelegate]);
var DEFAULT_CONTRACT_KINDS = Object.freeze(["api", "db"]);
var contractKind = z7.string().regex(/^[a-z][a-z0-9-]*$/, "one lowercase word, such as api or db").refine((kind) => kind !== "none", "none is what a slice declares when it changes nothing \u2014 it is no kind");
var contractKinds = z7.array(contractKind).min(1, "at least one kind, such as api").transform((kinds) => kinds.map(layerOf)).superRefine((kinds, issues) => {
  const twice = kinds.find((kind, index) => kinds.indexOf(kind) !== index);
  if (twice !== void 0) issues.addIssue({ code: "custom", message: `"${twice}" is listed twice` });
});
var layersSection = z7.record(z7.string(), z7.array(regexSource).min(1, "at least one path pattern")).superRefine((layers, issues) => {
  for (const key of Object.keys(layers)) {
    if (!Object.hasOwn(CANONICAL_LAYERS, key)) {
      issues.addIssue({ code: "custom", path: [key], message: `${key} is not a layer (${layerList()})` });
    }
  }
});
var TARGET_KNOWLEDGE = Object.freeze(["own", "imported", "none"]);
var target = z7.object({
  repo: z7.string().regex(/^[\w.-]+\/[\w.-]+$/, "owner/name"),
  role: z7.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "one kebab-case word, such as back-end"),
  knowledge: z7.enum(TARGET_KNOWLEDGE),
  readAt: z7.string().regex(/^[0-9a-f]{40}$/, "the full 40-character commit the copy was read at").nullable().default(null),
  // PRD 1162: no slice and no roadmap row may name a read-only target; it is still read, surveyed
  // and imported.
  readOnly: z7.boolean().optional(),
  // PRD 1162: the short names of the targets whose default-branch packages this one installs.
  consumes: z7.array(z7.string()).optional()
}).strict();
function targetShortName(slug2) {
  return slug2.slice(slug2.indexOf("/") + 1);
}
var planSection = z7.object({
  guide: nullableText.default(null),
  targets: z7.array(target).min(1, "at least one target").optional(),
  product: z7.string().trim().min(1).optional()
}).strict().superRefine(({ targets, product }, issues) => {
  if (targets !== void 0 && product !== void 0) {
    issues.addIssue({
      code: "custom",
      path: [],
      message: "product and targets cannot both be set \u2014 keep product to read the targets from the server, or targets to keep them here"
    });
  }
  if (targets === void 0 && product === void 0) issues.addIssue({ code: "custom", path: ["targets"], message: "at least one target, or a product" });
  checkTargets(targets ?? [], issues);
}).transform(({ targets, ...plan }) => ({ ...plan, targets: targets ?? [] }));
function checkTargets(targets, issues) {
  const seen = /* @__PURE__ */ new Set();
  const names = targets.map(({ repo }) => targetShortName(repo));
  targets.forEach(({ repo, knowledge, readAt, consumes = [] }, index) => {
    const own = targetShortName(repo);
    const others = names.filter((name) => name !== own);
    consumes.forEach((name, at2) => {
      const path = ["targets", index, "consumes", at2];
      if (name === own) issues.addIssue({ code: "custom", path, message: `${name} is this target itself \u2014 a target never consumes itself` });
      else if (!others.includes(name)) {
        issues.addIssue({ code: "custom", path, message: `${name} names no other target of plan.targets by its short name (${others.join(", ") || "none"})` });
      }
    });
    if (seen.has(repo)) issues.addIssue({ code: "custom", path: ["targets", index, "repo"], message: `${repo} is listed twice` });
    seen.add(repo);
    if (knowledge === "imported" && readAt === null) {
      issues.addIssue({ code: "custom", path: ["targets", index, "readAt"], message: "required when knowledge is imported" });
    }
    if (knowledge !== "imported" && readAt !== null) {
      issues.addIssue({ code: "custom", path: ["targets", index, "readAt"], message: `only an imported target has one, and this one is ${knowledge}` });
    }
  });
}
var generatedEntry = z7.object({
  path: text2,
  from: z7.array(text2).min(1, "at least one source prefix"),
  build: z7.string().trim().min(1)
}).strict();
var AGENTS = Object.freeze(["claude", "codex", "cursor", "gemini"]);
var agentList = z7.array(z7.enum(AGENTS, { error: (issue) => `${String(issue.input)} is no agent the kit installs for \u2014 one of ${AGENTS.join(", ")}` })).min(1, "at least one agent").superRefine((agents, issues) => {
  agents.forEach((agent, index) => {
    if (agents.indexOf(agent) !== index) issues.addIssue({ code: "custom", path: [index], message: `${agent} is listed twice` });
  });
}).default(["claude"]);
var TIERS = Object.freeze(["deep", "build", "light"]);
var EFFORTS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);
var tierEntry = z7.object({
  model: text2,
  effort: z7.enum(EFFORTS, { error: (issue) => `${String(issue.input)} is no effort \u2014 one of ${EFFORTS.join(", ")}` }).optional()
}).strict();
var tierRow = z7.record(z7.string(), tierEntry).superRefine((row, issues) => {
  for (const tier of Object.keys(row)) {
    if (!isOneOf(TIERS, tier)) {
      issues.addIssue({ code: "custom", path: [tier], message: `${tier} is no tier \u2014 one of ${TIERS.join(", ")}` });
    }
  }
});
var SYNC_CHECKS = Object.freeze(["main", "kit", "knowledge", "page"]);
var SYNC_LEVELS = Object.freeze(["red", "orange", "off"]);
var SYNC_MAX_HOURS = 720;
var syncCheck = z7.enum(SYNC_CHECKS, { error: (issue) => `${String(issue.input)} is no check \u2014 one of ${SYNC_CHECKS.join(", ")}` });
var syncLevel = z7.enum(SYNC_LEVELS, { error: (issue) => `${String(issue.input)} is no level \u2014 one of ${SYNC_LEVELS.join(", ")}` });
var syncOrder = z7.array(syncCheck).superRefine((order, issues) => {
  const twice = order.find((check, index) => order.indexOf(check) !== index);
  if (twice !== void 0) issues.addIssue({ code: "custom", message: `${twice} is listed twice` });
  for (const check of SYNC_CHECKS) {
    if (!order.includes(check)) issues.addIssue({ code: "custom", message: `${check} is not listed \u2014 the order names ${SYNC_CHECKS.join(", ")}, each once` });
  }
});
var HOURS_MESSAGE = `a whole number of hours, written <n>h from 1h to ${SYNC_MAX_HOURS}h, such as 24h`;
var syncHours = z7.string({ error: HOURS_MESSAGE }).refine((value) => /^[1-9]\d*h$/.test(value) && Number.parseInt(value, 10) <= SYNC_MAX_HOURS, HOURS_MESSAGE);
var CONTEXT_BUDGET_FILE = ".omni-loop/budgets/context.json";
var ConfigSchema = z7.object({
  kit: z7.literal(CONFIG_VERSION),
  repo: section({
    slug: z7.string().regex(/^[\w.-]+\/[\w.-]+$/, "owner/name").nullable().default(null),
    remote: text2.default("origin"),
    defaultBranch: text2.default("main")
  }),
  github: section({ user: nullableText.default(null) }),
  branches: section({
    feature: branchTemplate.default("feat/{topic}"),
    fix: branchTemplate.default("fix/{topic}"),
    phase0: branchTemplate.default("docs/phase-0-{topic}"),
    slice: branchTemplate.default("feat/{topic}--{slice}"),
    // Landings: the branch of each landing of a PRD of more than one, stacked on the one before;
    // `{landing}` and `{landings}` are its number and the count, `{name}` its plan's name for it.
    // A PRD of one landing keeps `feature`.
    landing: branchTemplate.default("feat/{topic}-{landing}of{landings}-{name}"),
    rework: branchTemplate.default("fix-{item}"),
    retro: branchTemplate.default("docs/retro-{topic}"),
    knowledge: branchTemplate.default("docs/knowledge-{topic}"),
    invade: branchTemplate.default("docs/omni-invade"),
    // PRD 347: the branch `omni update` opens its pull request from; `{version}` is `v<x.y.z>`.
    update: branchTemplate.default("chore/omni-update-{version}"),
    // PRD 522: the branch `/omni:mega-invade` opens its one docs-only pull request from.
    megaInvade: branchTemplate.default("docs/omni-mega-invade"),
    // PRD 686: the branch `/omni:think-big` records a concept on; `{topic}` is `<n>-<slug>`.
    concept: branchTemplate.default("docs/concept-{topic}"),
    // PRD 1342: the branch `/omni:enforce` proves a law's test on; `{id}` is the law's register id.
    law: branchTemplate.default("test/law-{id}")
  }),
  worktrees: text2.default(".claude/worktrees"),
  // PRD 1890: which coding agents the repository's people use. `[claude]` by default: a config
  // without the key installs for Claude Code alone, as before.
  agents: agentList,
  // PRD 1934: the model and effort each tier runs on, one row per agent `agents` lists. Optional:
  // a config without it parses with no `tiers` key, and every slice runs on the terminal's model.
  tiers: z7.record(z7.string(), tierRow).optional(),
  paths: section({
    delivery: text2.default(".omni-loop/delivery"),
    knowledge: text2.default(".omni-loop/knowledge"),
    adr: text2.default(".omni-loop/knowledge/adr"),
    playbook: text2.default(".omni-loop/knowledge/playbook"),
    glossary: nullableText.default(null),
    context: z7.array(text2).default(["AGENTS.md", "CLAUDE.md"])
  }),
  labels: section({
    prd: labelName.default("omni:prd"),
    phase0: labelName.default("omni:phase-0"),
    feature: labelName.default("omni:feature"),
    sub: labelName.default("omni:sub"),
    inProgress: labelName.default("omni:in-progress"),
    needsFix: labelName.default("omni:needs-fix"),
    outboxGo: labelName.default("omni:outbox-go"),
    retro: labelName.default("omni:retro"),
    knowledge: labelName.default("omni:knowledge"),
    visual: labelName.default("omni:visual"),
    // PRD 556: the bug-fix lane's labels — the issue and its PR, a regression, and the triage's risk.
    bug: labelName.default("omni:bug"),
    regression: labelName.default("omni:regression"),
    riskCritical: labelName.default("omni:risk-critical"),
    riskHigh: labelName.default("omni:risk-high"),
    riskMedium: labelName.default("omni:risk-medium"),
    riskLow: labelName.default("omni:risk-low"),
    // PRD 686: a concept `/omni:think-big` records — its issue and its pull request.
    concept: labelName.default("omni:concept"),
    // PRD 1299: the label the GitHub App adds to a PRD's issue once it is approved on the server. For
    // display: nothing reads it.
    approved: labelName.default("omni:approved"),
    // PRD 1342: a law issue — a law written `Enforced by: pending #<n>`, waiting for its test.
    law: labelName.default("omni:law"),
    // PRD 2175: the label a runner swaps in for `inProgress` on a claim whose job ended while it held
    // it. The board reads a draft carrying it as `claimed-stale` at once (`kit/lib/board.ts`). Left
    // out, `releasedLabel()` reads `DEFAULT_RELEASED_LABEL`, and a config that does not set it parses
    // exactly as before (so `omni init` does not create it: a person does).
    released: labelName.optional(),
    autoCreate: z7.boolean().default(false)
  }),
  prLinks: section({
    feature: text2.default("Closes #{prd}"),
    sub: text2.default("Part of #{prd}"),
    phase0: text2.default("Refs #{prd}")
  }),
  // How a pull request into the default branch or a landing branch is opened: `openWith` names a
  // slash skill of this repository (`/create-pr`, say) that `/omni:pr` runs with `--base`,
  // `--draft` and `--non-interactive`; `null` keeps the kit's own `gh pr create`. Sub-PRs never use it.
  pr: section({ openWith: nullableText.default(null) }),
  board: section({ matchBy: z7.enum(["base", "label"]).default("base") }),
  ci: section({
    outboxContext: text2.default("outbox"),
    // PRD 675: the name of the check run the omni-loop App posts on a phase-0 PR.
    inboxContext: text2.default("inbox"),
    // PRD 1548 and PRD 1612: the name of the check run the omni-loop App posts on a target feature PR
    // of a product PRD, and on a ◆ PRD's feature PR and its target PRs, saying whether what it builds
    // is what was approved; `null` posts none.
    approvedContext: nullableText.default("omni/approved"),
    aggregateCheck: nullableText.default(null),
    branchProtection: z7.boolean().default(false),
    runner: text2.default("ubuntu-latest")
  }),
  commands: section({
    // PRD 1804: what prepares a fresh checkout to run the preflight (an install). Only the
    // multi-repository skills read it, from a target's default branch; `null` means none.
    setup: nullableText.default(null),
    preflight: nullableText.default(null),
    preflightFull: nullableText.default(null),
    checks: z7.array(text2).default([]),
    test: nullableText.default(null),
    // PRD 556: the command that runs mutation testing on the changed lines; `null` means none here.
    mutation: nullableText.default(null),
    // PRD 1369: a design linter `/omni:pixel-perfect review` runs when it is set; it only reports.
    design: nullableText.default(null),
    // PRD 2275: it builds what the repository ships to production, then runs checks against the
    // built output; only the bug-fix skills run it, when a passing reproduction cannot see the bug.
    smoke: nullableText.default(null)
  }),
  acceptance: z7.object({
    enabled: z7.boolean().default(false),
    dir: nullableText.default(null),
    pendingSuffix: nullableText.default(null),
    run: nullableText.default(null)
  }).strict().refine((a) => !a.enabled || a.dir !== null, {
    message: "acceptance.dir is required when acceptance.enabled is true",
    path: ["dir"]
  }).prefault({}),
  laws: section({
    source: z7.enum(["knowledge", "claudeMdInvariants", "none"]).default("none"),
    // The heading under which the context files (`paths.context`, in order) list the ADRs that are
    // law when `source` is `claudeMdInvariants`. Both names are kept from when CLAUDE.md alone was
    // read (PRD 1739), so every config that sets them still reads.
    claudeMdHeading: text2.default("## Invariants"),
    // PRD 1342: whether every rule and invariant must name its proof — a test's path, or
    // `pending #<n>` — so `omni check knowledge` refuses `Enforced by: unenforced`. Off by default:
    // a repository turns it on with the knowledge PR of its sweep (`omni knowledge judge`).
    requireProof: z7.boolean().default(false),
    // PRD 1726: at most this many locked laws (`Locked:` entries); `omni check knowledge` refuses more.
    max: z7.number().int().positive().default(20),
    // PRD 1726: who may lock a law and approve a change to one, as CODEOWNERS names them — GitHub
    // logins and `<org>/<team>`s, written without `@`. Empty, `omni check knowledge` refuses any lock.
    // PRD 1794: an entry may be `{ login, delegate }` instead; the delegate is a CODEOWNER too.
    owners: z7.array(lawOwnerEntry).default([]),
    // PRD 1794: product leadership, GitHub logins asked last about what still waits on a person.
    // Never written into CODEOWNERS, so its approval never clears a law.
    leadership: z7.array(personLogin).default([])
  }),
  risk: section({
    storedShape: z7.array(regexSource).default([]),
    sharedContract: z7.array(text2).default([])
  }),
  // Landings: the paths that must reach the default branch in a landing of their own (a
  // repository's migrations directories, say). Regex sources over repository paths, compiled once
  // by `omni plan check`; empty, no plan is refused for what it puts together.
  landings: section({ alone: z7.array(regexSource).default([]) }),
  // PRD 2346: the repository's map from canonical layers to the paths that hold them: regular
  // expressions over repository paths, as a flow area's `paths`. A file may be in several layers.
  // Optional: a config without it parses with no `layers` key, and no entry is narrowed by layer.
  layers: layersSection.optional(),
  // PRD 1870: whether every slice that lands in this repository must declare, in its plan's
  // `contract` column, what it changes for the repository's callers — one or more of `kinds`, or
  // `none`. Off by default. `kinds` are this repository's own words, `DEFAULT_CONTRACT_KINDS` when
  // it names none; `omni plan check` refuses a word outside them.
  contracts: section({
    declare: z7.boolean().default(false),
    kinds: contractKinds.default(() => [...DEFAULT_CONTRACT_KINDS])
  }),
  notify: section({
    slack: z7.object({ channelVar: text2.default("OMNI_SLACK_CHANNEL"), tokenSecret: text2.default("SLACK_BOT_TOKEN") }).strict().nullable().default(null)
  }),
  limits: section({
    stallDays: z7.number().int().positive().default(5),
    attempts: z7.number().int().positive().default(3),
    claimStaleMinutes: z7.number().int().positive().default(60),
    // PRD 2175: how long a draft still on `labels.inProgress` may go with no commit and no update
    // before the board reads its claim as stale: the fallback for a claim no runner saw die. Left
    // out, `DEFAULT_CLAIM_DEAD_MINUTES` applies, and a config that does not set it parses exactly as before.
    claimDeadMinutes: z7.number().int().positive().optional(),
    beforeAfterMaxBytes: z7.number().int().positive().default(512e3),
    // PRD 1205: how many loop steps run at once, counting those already running. 1 is the loop as it
    // was before, one step at a time.
    parallelSteps: z7.number().int().min(1).max(6).default(3),
    // PRD 1089: the size a flow hook file may reach. Left out, `DEFAULT_HOOK_MAX_BYTES` applies,
    // and a config that does not set it parses exactly as before.
    hookMaxBytes: z7.number().int().positive().optional(),
    // PRD 1794: how many working days (Monday to Friday, UTC) a thing waits on a person before the
    // next people are asked. Its own setting: `stallDays` is unchanged.
    escalationWorkingDays: z7.number().int().min(1).max(10).default(2)
  }),
  // Issue 1722: a PRD whose plan has fewer slices than `inlineBelow` is built on its feature branch
  // itself, one slice after the other, with no sub-PR per slice (`/omni:wave`, `inlineWave` in
  // `kit/lib/board.ts`). 0, the default, never does: every slice is a sub-PR, as it always was.
  wave: section({ inlineBelow: z7.number().int().min(0).default(0) }),
  ask: section({ url: askUrl.nullable().default(null) }),
  // PRD 216: whether `omni dossier` uploads this repository's PRD folders to the server `ask.url`
  // names. Off by default: a repository opts in. `dossierSwitch()` reads it with `ask.url`.
  dossier: section({ enabled: z7.boolean().default(false) }),
  // PRD 262: whether a PRD ships with a release note (`<folder>/release.md`, `kit/lib/releases/`).
  // Off by default: a repository opts in. When it is on, `omni ship` refuses a PRD whose folder has
  // no note, or whose note `omni check releases` would fail.
  releaseNotes: section({ enabled: z7.boolean().default(false) }),
  // PRD 251: whether an outbox may be answered outside the pull request — at the end of
  // `/omni:yolo` (`omni answers`) and on the page `ask.url` names. On by default: a repository
  // opts out. The pull request takes replies either way.
  answers: section({ enabled: z7.boolean().default(true) }),
  // PRD 2338: whether `/omni:retro-apply` writes the guard test a kept lesson is worth, proved red
  // then green, beside the rule it appends. Off by default: the retro PR stays documents only, and a
  // lesson worth a guard names it for a person to take up. A repository opts in.
  retro: section({ guards: z7.boolean().default(false) }),
  // PRD 2410: whether the GitHub App watches main for seven days after a feature PR merges, marking
  // the PRD broke on a red job on the merge commit, a revert or a traced regression, and queueing
  // `/omni:rewind` on the first break. On by default; read at the merge commit, so `false` there
  // opens no watch and queues no rewind.
  mainWatch: section({ enabled: z7.boolean().default(true) }),
  // PRD 798: how `/omni:prove` records a PRD's acceptance criteria. Off while `url` is null.
  // `setup` is a command that writes a Playwright storageState to `PROOF_STORAGE_STATE`;
  // `bypassEnv` names the variable holding the Vercel protection-bypass secret; `maxSeconds` caps a clip.
  // `deployment` names the GitHub deployment environment to film when a commit has several previews.
  proof: section({
    url: proofUrl.nullable().default(null),
    deployment: nullableText.default(null),
    setup: nullableText.default(null),
    bypassEnv: envName.nullable().default(null),
    maxSeconds: z7.number().int().positive().default(60)
  }),
  // PRD 1233 (beta): how `/omni:validate-e2e` keeps a PRD's acceptance criteria as e2e tests. Off by
  // default. `url`, `deployment`, `setup` and `bypassEnv` mean what they mean under `proof`; `dir` is
  // where the tests and their recordings live; `model` is the goal steps' OpenRouter id.
  e2e: section({
    enabled: z7.boolean().default(false),
    url: proofUrl.nullable().default(null),
    deployment: nullableText.default(null),
    setup: nullableText.default(null),
    bypassEnv: envName.nullable().default(null),
    dir: text2.default("e2e"),
    model: text2.default("anthropic/claude-sonnet-5.5")
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
    enabled: z7.boolean().default(false),
    paths: z7.array(text2).default([]),
    ignore: z7.array(text2).optional(),
    screens: nullableText.default(null),
    words: section({
      sentence: z7.number().int().positive().default(7),
      screen: wordSelector.default("[data-screen]"),
      primary: wordSelector.default("[data-primary]"),
      content: wordSelector.optional(),
      avoid: z7.array(text2).default([])
    })
  }),
  markers: section({ prefix: z7.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, digits and hyphens").default("omni-outbox") }),
  // Who co-signs the loop's commits, pull requests and issues (`kit/lib/signature.ts`). By
  // default the omni-loop GitHub App's bot account; `null` switches signing off. `footer` is a
  // template: `{name}` and `{home}` are filled from the keys they name, anything else is printed
  // as written. `home` defaults to the Omni Loop home page (ADR-0047, ADR-0055).
  signature: z7.object({
    name: trailerPart.default("Omni-man"),
    email: trailerPart.default("333776611+omni-loop-invader[bot]@users.noreply.github.com"),
    home: httpsUrl.default("https://www.omni-loop.xyz"),
    footer: text2.default("\u{1F9B8} {name} by [Omni Loop]({home}) \xA9")
  }).strict().nullable().prefault({}),
  plan: planSection.optional(),
  // PRD 1089: the repository's flow — its rules, its areas and its hooks (`kit/lib/flow/`).
  // Optional: a config without it runs the loop as the kit defines it, and parses with no `flow` key.
  flow: FlowSchema.optional(),
  // PRD 1138: the repository's generated outputs (`kit/lib/generated/`). Optional: a config without
  // it has none, and parses with no `generated` key.
  generated: z7.array(generatedEntry).optional(),
  // PRD 1679: budgets on what the repository's agents read. `context` measures what a session loads
  // (`omni budget measure context`, `kit/lib/budgets/`) against the ceilings in `file`. Off by
  // default: a repository opts in. Optional: a config without it parses with no `budgets` key, and
  // `contextBudget()` reads it as off. Shaped `budgets.<name>` so a later budget is a key beside it.
  budgets: z7.object({ context: section({ enabled: z7.boolean().default(false), file: text2.default(CONTEXT_BUDGET_FILE) }) }).strict().optional(),
  // PRD 1990: how `omni sync` weighs its checks. `order` decides the headline (the heaviest check
  // first), `levels` the highest colour each check may show (`off` gathers nothing), `mainRedAfter`
  // how old a missing commit of the default branch may be before the main check is red.
  sync: section({
    order: syncOrder.default(() => [...SYNC_CHECKS]),
    levels: section({
      main: syncLevel.default("red"),
      kit: syncLevel.default("orange"),
      knowledge: syncLevel.default("orange"),
      page: syncLevel.default("orange")
    }),
    mainRedAfter: syncHours.default("24h")
  })
}).strict().superRefine(({ pr, flow, agents, tiers }, issues) => {
  for (const agent of Object.keys(tiers ?? {})) {
    if (!isOneOf(agents, agent)) {
      issues.addIssue({ code: "custom", path: ["tiers", agent], message: `${agent} is not in agents (${agents.join(", ")})` });
    }
  }
  const hooks = flow?.hooks?.["pr.open"];
  if (pr.openWith !== null && hooks !== void 0 && hooksByMode(hooks).replace !== null) {
    issues.addIssue({
      code: "custom",
      path: ["flow", "hooks", "pr.open", "replace"],
      message: "pr.openWith already replaces how a pull request opens \u2014 keep one of the two"
    });
  }
});
function designScreensDir({ paths, design }) {
  return design.screens ?? `${paths.knowledge.replace(/\/+$/, "")}/design/screens/`;
}
var isRecord = (value) => value !== null && typeof value === "object";
var RENAMED = Object.freeze([{ section: "branches", from: "terraform", to: "invade" }]);
function renamedKey(raw) {
  return RENAMED.find(({ section: name, from }) => {
    const value = isRecord(raw) ? raw[name] : void 0;
    return value !== null && typeof value === "object" && Object.hasOwn(value, from);
  });
}
function describeIssue(issue) {
  const path = issue.path.join(".") || "(top level)";
  const keys = issue.code === "unrecognized_keys" ? ` (unrecognized: ${issue.keys.join(", ")})` : "";
  return `${path}: ${issue.message}${keys}`;
}
var MIGRATIONS = Object.freeze([]);
function migrateConfig(raw, migrations = MIGRATIONS) {
  let current = raw;
  for (const { from, migrate } of migrations) {
    if (isRecord(current) && current.kit === from) current = migrate(current);
  }
  return current;
}
function dropUnrecognized(raw, issues) {
  let dropped = false;
  for (const issue of issues) {
    if (issue.code !== "unrecognized_keys") continue;
    let at2 = raw;
    for (const step of issue.path) at2 = isRecord(at2) ? at2[String(step)] : void 0;
    if (!isRecord(at2)) continue;
    for (const key of issue.keys) {
      if (Object.hasOwn(at2, key)) {
        Reflect.deleteProperty(at2, key);
        dropped = true;
      }
    }
  }
  return dropped;
}
function checkConfig(raw, ignoreUnknownKeys) {
  const result = ConfigSchema.safeParse(raw, { error: KIT_MESSAGES });
  if (result.success || !ignoreUnknownKeys) return result;
  const copy = structuredClone(raw);
  return dropUnrecognized(copy, result.error.issues) ? ConfigSchema.safeParse(copy, { error: KIT_MESSAGES }) : result;
}
function parseConfig(source, file = CONFIG_FILE, { migrate = false, ignoreUnknownKeys = false } = {}) {
  let raw;
  try {
    raw = parse(source) ?? {};
  } catch (error) {
    throw new ConfigError(`${file}: not valid YAML \u2014 ${messageOf(error).split("\n")[0]}`, { invalid: true });
  }
  if (migrate) raw = migrateConfig(raw);
  const renamed = renamedKey(raw);
  if (renamed) {
    const { section: name, from, to } = renamed;
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${name}.${from} was renamed \u2014 call it ${name}.${to}`, { invalid: true });
  }
  const result = checkConfig(raw, ignoreUnknownKeys);
  if (!result.success) {
    const [first, ...others] = result.error.issues.map(describeIssue);
    const more = others.length ? `
${others.map((line) => `  - ${line}`).join("\n")}` : "";
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${first}${more}`, { invalid: true });
  }
  const config = result.data;
  return { ...config, design: { ...config.design, screens: designScreensDir(config) } };
}

// apps/omni-app/src/outbox-check/github-schema.ts
import { z as z8 } from "zod";
var Label = z8.union([z8.string(), z8.looseObject({ name: z8.string().nullish() })]);
var PullSchema = z8.looseObject({
  base: z8.looseObject({ ref: z8.string(), sha: z8.string() }),
  head: z8.looseObject({ ref: z8.string(), sha: z8.string() }),
  labels: z8.array(Label).nullish(),
  body: z8.string().nullish()
});
var PullsPageSchema = z8.array(z8.looseObject({ number: z8.number(), body: z8.string().nullish() }));
var PullHeadSchema = z8.looseObject({ head: z8.looseObject({ sha: z8.string() }) });
var IssueSchema = z8.looseObject({
  state: z8.string(),
  labels: z8.array(Label).nullish(),
  pull_request: z8.unknown().optional()
});
var CreatedSchema = z8.looseObject({ id: z8.number() });
var CommentWrittenSchema = z8.looseObject({ id: CommentIdSchema });
var CommentsPageSchema = z8.array(z8.looseObject({ id: CommentIdSchema, body: z8.string().nullish() }));
var ComparePageSchema = z8.looseObject({
  files: z8.array(z8.looseObject({ filename: z8.string(), status: z8.string() })).nullish(),
  commits: z8.array(z8.looseObject({ sha: z8.string(), commit: z8.looseObject({ message: z8.string().nullish() }).nullish() })).nullish()
});
var ReviewsPageSchema = z8.array(
  z8.looseObject({
    user: z8.looseObject({ login: z8.string() }).nullish(),
    state: z8.string(),
    commit_id: z8.string().nullish()
  })
);
var CheckRunsSchema = z8.looseObject({
  check_runs: z8.array(z8.looseObject({ id: z8.number(), status: z8.string().nullish() })).nullish()
});
var TreeEntrySchema = z8.looseObject({
  path: z8.string(),
  mode: z8.string(),
  type: z8.string(),
  sha: z8.string(),
  size: z8.number().nullish()
});
var TreeSchema = z8.looseObject({ truncated: z8.boolean().nullish(), tree: z8.array(TreeEntrySchema) });
var BlobSchema = z8.looseObject({ content: z8.string(), encoding: z8.string().nullish() });
var RefSchema = z8.looseObject({ object: z8.looseObject({ sha: z8.string() }) });
var GitCommitSchema = z8.looseObject({ tree: z8.looseObject({ sha: z8.string() }) });
var ShaSchema = z8.looseObject({ sha: z8.string() });
var PullWrittenSchema = z8.looseObject({ number: PrNumberSchema, html_url: z8.string() });
var PullsSchema = z8.array(
  z8.looseObject({
    number: PrNumberSchema,
    html_url: z8.string(),
    state: z8.string(),
    merged_at: z8.string().nullish(),
    head: z8.looseObject({ sha: z8.string().nullish() }).nullish()
  })
);
var FailureSchema = z8.looseObject({ status: z8.unknown(), message: z8.unknown() }).partial();
function messageField(error) {
  const read = FailureSchema.safeParse(error);
  return read.success ? read.data.message : void 0;
}
function messageOf2(error) {
  return messageField(error) ?? error;
}

// apps/omni-app/src/run-log/run-log.ts
function outcomeOfStatus(status) {
  if (status < 400) return "ok";
  return status < 500 ? "refused" : "failed";
}
function write(logger, line) {
  const entry = { event: line.event };
  for (const [field, value] of Object.entries(line)) {
    if (value !== void 0) Object.assign(entry, { [field]: value });
  }
  try {
    if (line.outcome === "ok") logger.info(entry);
    else if (line.outcome === "refused") logger.warn(entry);
    else logger.error(entry);
  } catch {
  }
}
function stopwatch(logger) {
  try {
    const elapsed = logger.timer();
    return () => {
      try {
        return elapsed();
      } catch {
        return void 0;
      }
    };
  } catch {
    return () => void 0;
  }
}
async function loggedRun(logger, event, run, outcomeOf) {
  const elapsed = stopwatch(logger);
  const fields = {};
  const note = (more) => {
    Object.assign(fields, more);
  };
  let value;
  try {
    value = await run(note);
  } catch (error) {
    write(logger, { event, outcome: "failed", ms: elapsed(), ...fields, error });
    throw error;
  }
  let outcome;
  try {
    outcome = outcomeOf(value);
  } catch {
    outcome = "ok";
  }
  write(logger, { event, outcome, ms: elapsed(), ...fields });
  return value;
}
function loggedHandler(logger, event, handler) {
  return (request) => loggedRun(
    logger,
    event,
    async (note) => {
      const response = await handler(request, note);
      note({ status: response.status });
      return response;
    },
    (response) => outcomeOfStatus(response.status)
  );
}
function noteTo(fn, logger = log) {
  return (line) => {
    try {
      logger.warn({ event: "note", fn, message: line });
    } catch {
    }
  };
}

// apps/omni-app/src/stage-forward/stage-forward.ts
var STAGE_SIGNATURE_HEADER = "x-omni-signature-256";
var DEFAULT_SHAPES = (() => {
  const { branches, prLinks, labels } = parseConfig("kit: 1");
  return Object.freeze({ branches, prLinks, approved: labels.approved });
})();
var PullEventSchema = z9.looseObject({
  action: z9.unknown(),
  repository: z9.looseObject({ full_name: z9.string().min(1), default_branch: z9.string().nullish() }),
  pull_request: z9.looseObject({
    head: z9.looseObject({ ref: z9.string() }),
    base: z9.looseObject({ ref: z9.string() }),
    merged: z9.unknown(),
    merged_at: z9.string().nullish(),
    created_at: z9.string().nullish(),
    updated_at: z9.string().nullish(),
    body: z9.unknown()
  })
});
var LabeledEventSchema = z9.looseObject({
  action: z9.literal("labeled"),
  repository: z9.looseObject({ full_name: z9.string().min(1) }),
  label: z9.looseObject({ name: z9.string() }),
  issue: z9.looseObject({ number: PrdNumberSchema, updated_at: z9.string().min(1), pull_request: z9.unknown().optional() })
});
function approvedStage(payload, approved) {
  const read = LabeledEventSchema.safeParse(payload);
  if (!read.success) return null;
  const { repository, label, issue } = read.data;
  if (label.name !== approved || issue.pull_request !== void 0) return null;
  return { repository: repository.full_name, topic: String(issue.number), prd: issue.number, stage: "inbox", at: issue.updated_at };
}
function toStageEvent(event, payload, shapes = DEFAULT_SHAPES) {
  if (event === "issues") return approvedStage(payload, shapes.approved ?? DEFAULT_SHAPES.approved);
  const read = event === "pull_request" ? PullEventSchema.safeParse(payload) : null;
  if (!read?.success) return null;
  const pull = pullOf(read.data);
  const { action } = read.data;
  const recognise = typeof action === "string" ? RECOGNISERS.get(action) : void 0;
  const seen = recognise ? recognise(pull, shapes.branches) : null;
  if (!seen?.topic || !seen.at) return null;
  return { repository: pull.repository, topic: seen.topic, prd: prdOf(pull.pr.body, shapes.prLinks), stage: seen.stage, at: seen.at };
}
function pullOf({ pull_request: pr, repository }) {
  return { pr, repository: repository.full_name, head: pr.head.ref, base: pr.base.ref, defaultBranch: repository.default_branch ?? "main" };
}
var seenAt = (stage, topic, at2) => ({ stage, topic, at: at2 });
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var mergedStage = ({ pr, head, base, defaultBranch }, branches) => {
  if (pr.merged !== true) return null;
  const phase0 = match(branches.phase0, head);
  if (phase0) return seenAt("inbox", phase0.topic, pr.merged_at);
  const slice = match(branches.slice, head);
  if (slice) return base === fill(branches.feature, slice.topic) ? seenAt("building", slice.topic, pr.merged_at) : null;
  const feature = match(branches.feature, head);
  return feature && base === defaultBranch ? seenAt("shipped", feature.topic, pr.merged_at) : null;
};
var readyStage = ({ pr, head, base, defaultBranch }, branches) => {
  if (match(branches.slice, head)) return null;
  const feature = match(branches.feature, head);
  return feature && base === defaultBranch ? seenAt("outbox", feature.topic, pr.updated_at ?? now()) : null;
};
var openedStage = ({ pr, head }, branches) => {
  const retro = match(branches.retro, head);
  return retro ? seenAt("retro", retro.topic, pr.created_at ?? now()) : null;
};
var RECOGNISERS = /* @__PURE__ */ new Map([
  ["closed", mergedStage],
  ["ready_for_review", readyStage],
  ["opened", openedStage]
]);
function signStageEvent(secret, body) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}
function stageEventUrl(galaxyUrl) {
  return `${galaxyUrl.replace(/\/+$/, "")}/api/stages/event`;
}
function forwardStageEvent(stageEvent, post) {
  const what = `${stageEvent.stage} of ${stageEvent.repository} ${stageEvent.prd ? `#${stageEvent.prd}` : stageEvent.topic}`;
  return postSigned(stageEvent, post, { name: "stage event", what });
}
async function postSigned(payload, { url, secret, fetch: post = fetch, log: log2 = noteTo("stage-forward") }, { name, what }) {
  if (!secret) {
    log2(`${name}: STAGE_EVENT_SECRET is not set, the ${what} is left to the sync`);
    return;
  }
  const body = JSON.stringify(payload);
  try {
    const response = await post(url, {
      method: "POST",
      body,
      headers: { "content-type": "application/json", [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, body) },
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) log2(`${name}: galaxy answered ${response.status} to the ${what}`);
  } catch (error) {
    log2(`${name}: the ${what} could not be sent \u2014 ${String(messageOf2(error))}`);
  }
}
function prdOf(body, prLinks) {
  if (typeof body !== "string") return null;
  for (const template of Object.values(prLinks)) {
    if (!template.includes("{prd}")) continue;
    const [before, after] = template.split("{prd}").map(escape);
    const found = new RegExp(`(?:^|\\s)${before}(\\d+)${after}(?!\\d)`, "im").exec(body);
    const prd = PrdNumberSchema.safeParse(Number(found?.[1]));
    if (prd.success) return prd.data;
  }
  return null;
}
function match(template, ref) {
  if (!template?.includes("{topic}")) return null;
  const names = [];
  const pattern = template.split(/(\{topic\}|\{slice\})/).map((part) => {
    if (part === "{topic}" || part === "{slice}") {
      names.push(part.slice(1, -1));
      return "([^/]+?)";
    }
    return escape(part);
  }).join("");
  const found = new RegExp(`^${pattern}$`).exec(ref);
  if (!found) return null;
  return Object.fromEntries(names.map((name, i) => [name, found[i + 1]]));
}
function fill(template, topic) {
  return template.replace("{topic}", String(topic));
}
function escape(text3) {
  return text3.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// apps/omni-app/src/stage-forward/touch.ts
import { posix as posix2 } from "node:path";
import { z as z11 } from "zod";

// kit/lib/layout.ts
import { existsSync as existsSync4, readdirSync } from "node:fs";
import { join as join4, posix } from "node:path";

// kit/lib/playbook/forms.ts
import { existsSync as existsSync3, readFileSync as readFileSync2 } from "node:fs";
import { join as join3 } from "node:path";
import { parse as parse2 } from "yaml";
import { z as z10 } from "zod";
var req = (id) => Object.freeze({ id, required: true });
var opt = (id) => Object.freeze({ id, required: false });
var form = (id, kind, slots, { pointerOnly = false } = {}) => Object.freeze({ id, kind, pointerOnly, slots: Object.freeze(slots) });
var FORMS = Object.freeze([
  form("briefing", "core", [req("never"), opt("hooks"), opt("links"), opt("agents"), opt("next")]),
  form("setup", "core", [req("prerequisites"), req("install"), opt("run"), opt("env")]),
  form("architecture", "core", [req("layout"), req("boundaries"), opt("patterns")]),
  form("testing", "core", [req("commands"), req("layout"), opt("levels"), req("never"), opt("data")]),
  form("verification", "core", [req("preflight"), opt("before-push"), opt("checks")]),
  form("ci", "core", [req("workflows"), req("gating"), opt("known-reds"), opt("rerun"), opt("budgets")]),
  form("pull-requests", "core", [req("body"), opt("title"), opt("labels"), opt("reviewers")]),
  form("decisions", "core", [req("where"), req("format"), opt("numbering")]),
  form("definition-of-done", "extended", [req("done"), opt("docs"), opt("commits")]),
  form("conventions", "extended", [opt("naming"), opt("formatting"), opt("commits")]),
  form("releasing", "extended", [req("publishes"), opt("how"), opt("rollback"), opt("notes")]),
  form("bug-fixing", "extended", [req("steps"), opt("guard")]),
  form("review", "extended", [req("fix"), req("push-back"), req("ask")]),
  form("design", "extended", [req("product"), req("system"), opt("deliberate"), opt("review"), opt("language")]),
  form("glossary", "extended", [req("where")], { pointerOnly: true })
]);
var FORM_IDS = Object.freeze(FORMS.map((entry) => entry.id));
var FORM_STATES = ["blank", "filled", "pointer"];
var OLD_DATE_KEY = "terraformed";
var DATE = /^\d{4}-\d{2}-\d{2}$/;
var EVIDENCE = /^(.+)@([0-9a-f]{7,40})$/;
var FrontMatterSchema = z10.object({
  form: z10.enum(FORM_IDS),
  "form-version": z10.number().int().positive(),
  state: z10.enum(FORM_STATES),
  "points-to": z10.string().min(1).nullable(),
  evidence: z10.array(z10.string().regex(EVIDENCE, "each entry is <path>@<hex>, the file at its git hash-object")).nullable(),
  invaded: z10.string().regex(DATE, "a YYYY-MM-DD date").nullable().optional(),
  [OLD_DATE_KEY]: z10.string().regex(DATE, "a YYYY-MM-DD date").nullable().optional(),
  index: z10.string().min(1).optional()
}).strict().superRefine((fm, context) => {
  if (fm.invaded === void 0 && fm[OLD_DATE_KEY] === void 0) {
    context.addIssue({ code: "custom", path: ["invaded"], message: "missing \u2014 a YYYY-MM-DD date, or null" });
  }
  if (fm.invaded !== void 0 && fm[OLD_DATE_KEY] !== void 0) {
    context.addIssue({ code: "custom", path: [OLD_DATE_KEY], message: "is the old spelling of invaded \u2014 keep invaded only" });
  }
  const pointer = fm.state === "pointer";
  if (pointer && fm["points-to"] === null) {
    context.addIssue({ code: "custom", path: ["points-to"], message: "a pointer form names the path it points to" });
  }
  if (!pointer && fm["points-to"] !== null) {
    context.addIssue({ code: "custom", path: ["points-to"], message: "only a pointer form points to a path; null otherwise" });
  }
  if (!pointer && fm.index !== void 0) {
    context.addIssue({ code: "custom", path: ["index"], message: "only a pointer form carries an index" });
  }
});

// kit/lib/layout.ts
var FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
function parseFolderName(name) {
  const match2 = FOLDER.exec(name);
  if (!match2) return null;
  const [, digits = "", topic = ""] = match2;
  const prd = PrdNumberSchema.safeParse(Number(digits));
  return prd.success ? { prd: prd.data, topic } : null;
}

// apps/omni-app/src/stage-forward/touch.ts
var TOUCH_EVENTS = Object.freeze(["issues", "issue_comment", "pull_request", "pull_request_review", "check_suite", "push"]);
var DEFAULTS = (() => {
  const { paths, branches } = parseConfig("kit: 1");
  return Object.freeze({ delivery: posix2.normalize(paths.delivery).replace(/\/+$/, ""), branches });
})();
var Repository = z11.looseObject({ repository: z11.looseObject({ full_name: z11.string().min(1) }) });
var IssueEvent = z11.looseObject({ issue: z11.looseObject({ number: IssueNumberSchema, pull_request: z11.unknown().optional() }) });
var PullEvent = z11.looseObject({ pull_request: z11.looseObject({ number: PrNumberSchema, head: z11.looseObject({ ref: z11.string().min(1) }) }) });
var CheckSuiteEvent = z11.looseObject({
  check_suite: z11.looseObject({ head_branch: z11.string().min(1).nullish(), pull_requests: z11.array(z11.looseObject({ number: PrNumberSchema })).nullish() })
});
var Files = z11.array(z11.string()).nullish();
var PushEvent = z11.looseObject({
  ref: z11.string(),
  commits: z11.array(z11.looseObject({ added: Files, modified: Files, removed: Files })).nullish()
});
var issueTouches = (repository, payload) => {
  const read = IssueEvent.safeParse(payload);
  if (!read.success) return [];
  const { number, pull_request: pull } = read.data.issue;
  if (pull === void 0 || pull === null) return [{ repository, issue: number }];
  const pr = PrNumberSchema.safeParse(number);
  return pr.success ? [{ repository, pr: pr.data }] : [];
};
var pullTouches = (repository, payload) => {
  const read = PullEvent.safeParse(payload);
  return read.success ? [{ repository, pr: read.data.pull_request.number, branch: read.data.pull_request.head.ref }] : [];
};
var checkSuiteTouches = (repository, payload) => {
  const read = CheckSuiteEvent.safeParse(payload);
  const branch = read.success ? read.data.check_suite.head_branch : null;
  if (!read.success || !branch) return [];
  const pulls = read.data.check_suite.pull_requests ?? [];
  return pulls.length === 0 ? [{ repository, branch }] : pulls.map(({ number }) => ({ repository, pr: number, branch }));
};
function isFeatureOrPhase0(branch) {
  const { branches } = DEFAULTS;
  if (match(branches.slice, branch)) return false;
  return Boolean(match(branches.feature, branch) ?? match(branches.phase0, branch));
}
function prdsIn(paths) {
  const prds = paths.flatMap((path) => {
    const [, folder, ...file] = path.slice(DEFAULTS.delivery.length + 1).split("/");
    const prd = file.length > 0 ? parseFolderName(folder ?? "")?.prd : void 0;
    return prd === void 0 ? [] : [prd];
  });
  return [...new Set(prds)];
}
var pushTouches = (repository, payload) => {
  const read = PushEvent.safeParse(payload);
  if (!read.success || !read.data.ref.startsWith("refs/heads/")) return [];
  const branch = read.data.ref.slice("refs/heads/".length);
  const inDelivery = (read.data.commits ?? []).flatMap(({ added, modified, removed }) => [added, modified, removed].flatMap((files) => files ?? [])).filter((path) => path.startsWith(`${DEFAULTS.delivery}/`));
  const prds = prdsIn(inDelivery);
  if (prds.length > 0) return prds.map((issue) => ({ repository, issue, branch }));
  return inDelivery.length > 0 || isFeatureOrPhase0(branch) ? [{ repository, branch }] : [];
};
var READERS = /* @__PURE__ */ new Map([
  ["issues", issueTouches],
  ["issue_comment", issueTouches],
  ["pull_request", pullTouches],
  ["pull_request_review", pullTouches],
  ["check_suite", checkSuiteTouches],
  ["push", pushTouches]
]);
function toTouches(event, payload) {
  const reader = READERS.get(event);
  const source = Repository.safeParse(payload);
  if (!reader || !source.success) return [];
  return reader(source.data.repository.full_name, payload);
}
function touchedUrl(galaxyUrl) {
  return `${galaxyUrl.replace(/\/+$/, "")}/api/github/touched`;
}
function forwardTouch(touch, post) {
  const what = `touch of ${touch.repository}${touch.issue ? ` #${touch.issue}` : ""}${touch.pr ? ` pull request #${touch.pr}` : ""}${touch.branch ? ` on ${touch.branch}` : ""}`;
  return postSigned(touch, post, { name: "touch", what });
}

// apps/omni-app/src/webhook/webhook.ts
import { Webhooks } from "@octokit/webhooks";
import { z as z16 } from "zod";

// kit/lib/signature.ts
var SIGNED_MARKER = "<!-- omni-loop:signed -->";
var NOREPLY = /^(?:\d+\+)?([^\s@+]+)@users\.noreply\.github\.com$/i;
function isSignedBody(body) {
  return typeof body === "string" && body.includes(SIGNED_MARKER);
}
function botLogin(email) {
  const match2 = typeof email === "string" ? NOREPLY.exec(email.trim()) : null;
  return match2?.[1] ?? null;
}

// apps/omni-app/src/fix-rows/fix-stamp.ts
import { z as z12 } from "zod";

// apps/omni-app/src/evaluate/prose-lines.ts
var OPENING = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/;
function proseLines(body) {
  const out = [];
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    if (fence !== null) {
      const closing = new RegExp(`^ {0,3}${fence[0] === "`" ? "`" : "~"}{${fence.length},}[ \\t]*$`);
      if (closing.test(line)) fence = null;
      continue;
    }
    const opening = OPENING.exec(line);
    if (opening) fence = opening[1] ?? null;
    else out.push(line);
  }
  return out;
}

// apps/omni-app/src/fix-rows/fix-stamp.ts
var FIX_STAMP_EVENT = "omni-loop/fix.stamp.requested";
var FixStampKindSchema = z12.enum(["merged", "closed", "reopened"]);
var at = z12.string().refine((value) => !Number.isNaN(Date.parse(value)), "a time");
var FixStampDataSchema = z12.looseObject({
  installationId: z12.number(),
  repository: z12.string().regex(/^[^/\s]+\/[^/\s]+$/, "owner/name"),
  prNumber: PrNumberSchema,
  kind: FixStampKindSchema,
  at,
  bug: ProductBugIdSchema.nullable()
});
var FIXES = /^ {0,3}Fixes ([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-B[1-9]\d{0,9})(?![\w-])/;
function fixedRecordOf(body) {
  for (const line of proseLines(body ?? "")) {
    const id = FIXES.exec(line)?.[1];
    const parsed = id === void 0 ? null : ProductBugIdSchema.safeParse(id);
    if (parsed?.success) return parsed.data;
  }
  return null;
}
function fixStampId({ repository, prNumber, kind, at: when }) {
  return `fix-stamp:${repository.toLowerCase()}#${String(prNumber)}:${kind}:${when}`;
}

// apps/omni-app/src/fleet-board/events.ts
import { z as z13 } from "zod";
var FLEET_BOARD_EVENT = "omni-loop/fleet-board.requested";
var FleetBoardDataSchema = z13.looseObject({
  installationId: z13.number(),
  owner: z13.string().min(1),
  repo: z13.string().min(1),
  repository: z13.string().regex(/^[^/\s]+\/[^/\s]+$/, "owner/name"),
  prNumber: PrNumberSchema,
  /** The pull request's GraphQL node id, the card's content. */
  nodeId: z13.string().min(1),
  /** The pull request's link, as a runner's job lists it. */
  url: z13.string().min(1),
  /** The GitHub login of its author. */
  author: z13.string().min(1)
});
function fleetBoardId({ repository, prNumber, action, at: at2 }) {
  return `fleet-board:${repository.toLowerCase()}#${String(prNumber)}:${action}:${at2}`;
}

// apps/omni-app/src/pr-stats/signed.ts
var DEFAULT_SIGNATURE = parseConfig("kit: 1\n").signature;
if (!DEFAULT_SIGNATURE) throw new Error("the kit's default config signs as Omni-man");
var SIGNATURE = DEFAULT_SIGNATURE;
var OMNI_LOGIN = botLogin(SIGNATURE.email);

// apps/omni-app/src/main-watch/events.ts
import { z as z14 } from "zod";
var MAIN_WATCH_EVENT = "omni-loop/main-watch.requested";
var MAIN_WATCH_CI_EVENT = "omni-loop/main-watch.ci-red";
var slug = z14.string().regex(/^[^/\s]+\/[^/\s]+$/, "owner/name");
var MainWatchDataSchema = z14.looseObject({
  installationId: z14.number(),
  owner: z14.string().min(1),
  repo: z14.string().min(1),
  repository: slug,
  prNumber: PrNumberSchema,
  mergeSha: z14.string().min(1),
  mergedAt: z14.string().nullish()
});
function mainWatchId({ repository, prNumber, mergeSha }) {
  return `main-watch:${repository.toLowerCase()}#${String(prNumber)}:${mergeSha}`;
}
function mainWatchCiId({ repository, suite }) {
  return `main-watch-ci:${repository.toLowerCase()}:${String(suite)}`;
}

// apps/omni-app/src/inbox-check/canon-actions.ts
import { z as z15 } from "zod";
var CANON_ACTION_EVENT = "omni-loop/canon.action.requested";
var CANON_ACTION = Object.freeze({ rewrite: "canon-rewrite", claim: "canon-claim" });
var FACTS = /<!--\s*omni-canon\s+(\{[^\n]*?\})\s*-->/;
var MarkerSchema = z15.looseObject({ prd: z15.unknown(), persona: z15.unknown(), claims: z15.unknown() });
function readCanonMarker(summary) {
  const match2 = FACTS.exec(summary === void 0 || summary === null ? "" : printed(summary));
  if (!match2) return null;
  let parsed;
  try {
    parsed = JSON.parse(match2[1] ?? "");
  } catch {
    return null;
  }
  const read = MarkerSchema.safeParse(parsed);
  if (!read.success) return null;
  const facts = read.data;
  const prd = PrdNumberSchema.safeParse(facts.prd);
  if (!prd.success || !Array.isArray(facts.claims)) return null;
  const claims = facts.claims;
  return {
    prd: prd.data,
    persona: typeof facts.persona === "string" && facts.persona ? facts.persona : null,
    claims: claims.filter((id) => typeof id === "string")
  };
}
var printed = (value) => String(value);

// apps/omni-app/src/webhook/webhook.ts
var CHECK_ACTIONS = Object.freeze({
  pull_request: Object.freeze(["opened", "synchronize", "reopened", "ready_for_review", "labeled", "unlabeled", "edited"]),
  pull_request_review: Object.freeze(["submitted", "dismissed"]),
  check_run: Object.freeze(["rerequested"])
});
var RETRO_ACTIONS = Object.freeze({
  pull_request: Object.freeze(["closed"])
});
var CANON_ACTIONS = Object.freeze({
  check_run: Object.freeze(["requested_action"])
});
var APPROVED_LABEL_ACTIONS = Object.freeze({
  issues: Object.freeze(["labeled", "unlabeled"])
});
var FIX_STAMP_ACTIONS = Object.freeze({
  pull_request: Object.freeze(["closed", "reopened"])
});
var FLEET_BOARD_ACTIONS = Object.freeze({
  pull_request: Object.freeze(["opened", "reopened", "ready_for_review", "edited"])
});
var MAIN_WATCH_CI_ACTIONS = Object.freeze({
  check_suite: Object.freeze(["completed"])
});
var RED_SUITE = /* @__PURE__ */ new Set(["failure", "timed_out", "startup_failure"]);
var APPROVED_LABEL = parseConfig("kit: 1").labels.approved;
var HANDLED = Object.freeze({
  pull_request: Object.freeze([...CHECK_ACTIONS.pull_request, ...RETRO_ACTIONS.pull_request]),
  pull_request_review: CHECK_ACTIONS.pull_request_review,
  check_run: Object.freeze([...CHECK_ACTIONS.check_run, ...CANON_ACTIONS.check_run])
});
var SUBSCRIBED = Object.freeze([.../* @__PURE__ */ new Set([...Object.keys(HANDLED), ...TOUCH_EVENTS])]);
var PullRefSchema = z16.looseObject({
  number: PrNumberSchema.nullish(),
  head: z16.looseObject({ sha: z16.string().nullish() }).nullish(),
  base: z16.looseObject({ ref: z16.string().nullish() }).nullish()
});
var PayloadSchema = z16.looseObject({
  action: z16.unknown(),
  number: PrNumberSchema.nullish(),
  installation: z16.looseObject({ id: z16.number().nullish() }).nullish(),
  repository: z16.looseObject({
    name: z16.string(),
    full_name: z16.string().nullish(),
    owner: z16.looseObject({ login: z16.string().nullish() }).nullish(),
    default_branch: z16.string().nullish()
  }).nullish(),
  pull_request: PullRefSchema.extend({
    node_id: z16.string().nullish(),
    html_url: z16.string().nullish(),
    state: z16.string().nullish(),
    user: z16.looseObject({ login: z16.string().nullish() }).nullish(),
    body: z16.string().nullish(),
    merged: z16.boolean().nullish(),
    merge_commit_sha: z16.string().nullish(),
    merged_at: z16.string().nullish(),
    closed_at: z16.string().nullish(),
    updated_at: z16.string().nullish()
  }).nullish(),
  check_run: z16.looseObject({
    id: z16.number().nullish(),
    external_id: z16.string().nullish(),
    head_sha: z16.string().nullish(),
    pull_requests: z16.array(PullRefSchema).nullish(),
    output: z16.looseObject({ summary: z16.unknown() }).nullish()
  }).nullish(),
  requested_action: z16.looseObject({ identifier: z16.unknown() }).nullish(),
  check_suite: z16.looseObject({
    id: z16.number().nullish(),
    head_branch: z16.string().nullish(),
    head_sha: z16.string().nullish(),
    conclusion: z16.string().nullish()
  }).nullish()
});
async function receiveWebhook({
  body,
  headers,
  secret,
  send,
  sendApproved = () => Promise.resolve(),
  sendStamps = () => Promise.resolve(),
  sendWatch = () => Promise.resolve(),
  sendBoard = () => Promise.resolve(),
  forward,
  touch = () => Promise.resolve(),
  log: log2 = noteTo("webhook")
}) {
  if (!secret) return reply(500, "webhook secret is not configured");
  const signature = header(headers, "x-hub-signature-256");
  if (!signature || !await verified(secret, body, signature)) return reply(401, "bad signature");
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return reply(400, "body is not JSON");
  }
  const event = header(headers, "x-github-event") ?? "";
  const stageEvent = toStageEvent(event, payload);
  if (stageEvent) {
    try {
      await forward(stageEvent);
    } catch (error) {
      log2(`stage event: could not forward \u2014 ${String(messageOf2(error))}`);
    }
  }
  await Promise.all(toTouches(event, payload).map(async (one) => {
    try {
      await touch(one);
    } catch (error) {
      log2(`touch: could not forward \u2014 ${String(messageOf2(error))}`);
    }
  }));
  const events = toEvents(event, payload);
  const approved = toApprovedLabelRequests(event, payload);
  const stamps = toFixStampRequests(event, payload);
  const watch = toMainWatchRequests(event, payload);
  const board = toFleetBoardRequests(event, payload);
  const total = events.length + approved.length + stamps.length + watch.length + board.length;
  if (total === 0) return reply(200, "ignored");
  try {
    if (events.length > 0) await send(events);
    if (approved.length > 0) await sendApproved(approved);
    if (stamps.length > 0) await sendStamps(stamps);
    if (watch.length > 0) await sendWatch(watch);
    if (board.length > 0) await sendBoard(board);
  } catch (error) {
    return reply(502, `could not send the event: ${String(messageOf2(error))}`);
  }
  return reply(200, `sent ${total}`);
}
function toEvents(event, payload) {
  const action = readPayload(payload)?.action;
  if (handles(RETRO_ACTIONS, event, action)) {
    return [...toRetroRequests(event, payload), ...toHarvestRequests(event, payload)];
  }
  if (handles(CANON_ACTIONS, event, action)) return toCanonActionRequests(event, payload);
  return toCheckRequests(event, payload);
}
function toCheckRequests(event, delivery) {
  const payload = readPayload(delivery);
  if (!payload || !handles(CHECK_ACTIONS, event, payload.action)) return [];
  const source = sourceOf(payload);
  if (!source) return [];
  const trigger = `${event}.${String(payload.action)}`;
  const name = event === "check_run" ? rerunEventOf(payload.check_run?.external_id) : OUTBOX_CHECK_EVENT;
  const pulls = event !== "check_run" ? [{ number: payload.pull_request?.number ?? payload.number, sha: payload.pull_request?.head?.sha, base: payload.pull_request?.base?.ref }] : (payload.check_run?.pull_requests ?? []).map((pull) => ({
    number: pull.number,
    sha: pull.head?.sha ?? payload.check_run?.head_sha,
    base: pull.base?.ref
  }));
  const defaultBranch = payload.repository?.default_branch;
  const intoDefault = (pull) => !defaultBranch || pull.base === defaultBranch;
  return pulls.filter(intoDefault).filter(isNamed).map((pull) => ({
    name,
    data: { ...source, prNumber: pull.number, headSha: pull.sha, trigger }
  }));
}
function rerunEventOf(externalId) {
  if (externalId === INBOX_EXTERNAL_ID) return INBOX_CHECK_EVENT;
  if (externalId === APPROVED_EXTERNAL_ID) return APPROVED_CHECK_EVENT;
  if (externalId === BUDGETS_EXTERNAL_ID) return BUDGETS_CHECK_EVENT;
  return OUTBOX_CHECK_EVENT;
}
function toRetroRequests(event, delivery) {
  const payload = readPayload(delivery);
  if (!payload || !handles(RETRO_ACTIONS, event, payload.action)) return [];
  const source = sourceOf(payload);
  const pull = payload.pull_request;
  if (!source || pull?.merged !== true) return [];
  const defaultBranch = payload.repository?.default_branch;
  if (defaultBranch && pull.base?.ref !== defaultBranch) return [];
  const prNumber = pull.number ?? payload.number ?? void 0;
  if (prNumber === void 0 || !pull.merge_commit_sha || !pull.merged_at) return [];
  return [
    {
      name: RETRO_EVENT,
      data: { ...source, prNumber, mergeSha: pull.merge_commit_sha, mergedAt: pull.merged_at }
    }
  ];
}
function toHarvestRequests(event, payload) {
  return toRetroRequests(event, payload).map(({ data: { installationId, owner, repo, repository, prNumber } }) => ({
    name: HARVEST_EVENT,
    data: { installationId, owner, repo, repository, prNumber }
  }));
}
function toFixStampRequests(event, delivery) {
  const payload = readPayload(delivery);
  if (!payload || !handles(FIX_STAMP_ACTIONS, event, payload.action)) return [];
  const source = sourceOf(payload);
  const pull = payload.pull_request;
  const prNumber = pull?.number ?? payload.number;
  if (!source || !pull || prNumber === null || prNumber === void 0) return [];
  const bug = fixedRecordOf(pull.body);
  const defaultBranch = payload.repository?.default_branch;
  if (bug === null && defaultBranch && pull.base?.ref !== defaultBranch) return [];
  const kind = payload.action === "reopened" ? "reopened" : pull.merged === true ? "merged" : "closed";
  const at2 = { merged: pull.merged_at, closed: pull.closed_at, reopened: pull.updated_at }[kind];
  if (!at2) return [];
  const data = { installationId: source.installationId, repository: source.repository, prNumber, kind, at: at2, bug };
  return [{ name: FIX_STAMP_EVENT, id: fixStampId(data), data }];
}
function toMainWatchRequests(event, delivery) {
  const merged = toRetroRequests(event, delivery).map(({ data }) => ({ name: MAIN_WATCH_EVENT, id: mainWatchId(data), data }));
  const payload = readPayload(delivery);
  if (merged.length > 0 || !payload || !handles(MAIN_WATCH_CI_ACTIONS, event, payload.action)) return merged;
  const source = sourceOf(payload);
  const suite = payload.check_suite;
  if (!source || !suite?.id || !suite.head_sha || !RED_SUITE.has(suite.conclusion)) return [];
  const defaultBranch = payload.repository?.default_branch;
  if (defaultBranch && suite.head_branch !== defaultBranch) return [];
  return [
    {
      name: MAIN_WATCH_CI_EVENT,
      id: mainWatchCiId({ repository: source.repository, suite: suite.id }),
      data: { installationId: source.installationId, repository: source.repository, sha: suite.head_sha }
    }
  ];
}
function toFleetBoardRequests(event, delivery) {
  const payload = readPayload(delivery);
  if (!payload || !handles(FLEET_BOARD_ACTIONS, event, payload.action)) return [];
  const source = sourceOf(payload);
  const pull = payload.pull_request;
  const defaultBranch = payload.repository?.default_branch;
  if (!source || !pull || !defaultBranch || pull.base?.ref !== defaultBranch || pull.state !== "open") return [];
  const author = pull.user?.login;
  if (!author || !(isSignedBody(pull.body) || author === OMNI_LOGIN)) return [];
  const prNumber = pull.number ?? payload.number;
  if (prNumber === null || prNumber === void 0 || !pull.node_id || !pull.html_url || !pull.updated_at) return [];
  const action = String(payload.action);
  return [
    {
      name: FLEET_BOARD_EVENT,
      id: fleetBoardId({ repository: source.repository, prNumber, action, at: pull.updated_at }),
      data: { ...source, prNumber, nodeId: pull.node_id, url: pull.html_url, author }
    }
  ];
}
var LabelEventSchema = z16.looseObject({
  label: z16.looseObject({ name: z16.string() }),
  issue: z16.looseObject({ number: PrdNumberSchema, pull_request: z16.unknown().optional() })
});
function toApprovedLabelRequests(event, delivery) {
  const payload = readPayload(delivery);
  if (!payload || !handles(APPROVED_LABEL_ACTIONS, event, payload.action)) return [];
  const source = sourceOf(payload);
  const read = LabelEventSchema.safeParse(delivery);
  if (!source || !read.success) return [];
  const { label, issue } = read.data;
  if (label.name !== APPROVED_LABEL || issue.pull_request !== void 0) return [];
  return [{ name: APPROVED_LABEL_EVENT, data: { ...source, prd: issue.number, trigger: `${event}.${String(payload.action)}` } }];
}
var BUTTONS = Object.values(CANON_ACTION);
function toCanonActionRequests(event, delivery) {
  const payload = readPayload(delivery);
  if (!payload || !handles(CANON_ACTIONS, event, payload.action)) return [];
  const run = payload.check_run;
  const action = payload.requested_action?.identifier;
  if (!run || run.external_id !== INBOX_EXTERNAL_ID || typeof action !== "string" || !BUTTONS.includes(action)) return [];
  const source = sourceOf(payload);
  const facts = readCanonMarker(run.output?.summary);
  if (!source || !facts) return [];
  return (run.pull_requests ?? []).map((pull) => ({ number: pull.number, sha: pull.head?.sha ?? run.head_sha })).filter(isNamed).map((pull) => ({
    name: CANON_ACTION_EVENT,
    data: { ...source, prNumber: pull.number, headSha: pull.sha, checkRunId: run.id ?? void 0, action, facts }
  }));
}
function readPayload(payload) {
  const read = PayloadSchema.safeParse(payload);
  return read.success ? read.data : null;
}
function handles(table, event, action) {
  if (typeof action !== "string" || !Object.hasOwn(table, event)) return false;
  return table[event]?.includes(action) ?? false;
}
function isNamed(pull) {
  return pull.number !== null && pull.number !== void 0 && Boolean(pull.sha);
}
function sourceOf(payload) {
  const installationId = payload.installation?.id;
  const repository = payload.repository;
  if (!installationId || !repository?.full_name) return null;
  return {
    installationId,
    owner: repository.owner?.login ?? repository.full_name.split("/")[0] ?? "",
    repo: repository.name,
    repository: repository.full_name
  };
}
async function verified(secret, body, signature) {
  try {
    return await new Webhooks({ secret }).verify(body, signature);
  } catch {
    return false;
  }
}
function header(headers, name) {
  if (headers instanceof Headers) return headers.get(name) ?? void 0;
  const fields = headers ?? {};
  const key = Object.keys(fields).find((k) => k.toLowerCase() === name);
  return key === void 0 ? void 0 : fields[key];
}
function reply(status, body) {
  return { status, body };
}

// apps/omni-app/src/webhook/github-route.ts
function repositoryOf(body) {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || !("repository" in parsed)) return void 0;
    const { repository } = parsed;
    if (typeof repository !== "object" || repository === null || !("full_name" in repository)) return void 0;
    return typeof repository.full_name === "string" ? repository.full_name : void 0;
  } catch {
    return void 0;
  }
}
function githubRoute(env, {
  send = (events) => inngest.send(events),
  logger = log
} = {}) {
  const stage = { url: stageEventUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  const touched = { url: touchedUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  return {
    POST: loggedHandler(logger, "webhook", async (request, note) => {
      note({ deliveryId: request.headers.get("x-github-delivery") ?? void 0, fn: request.headers.get("x-github-event") ?? void 0 });
      const text3 = await request.text();
      const { status, body } = await receiveWebhook({
        body: text3,
        headers: request.headers,
        secret: env.webhook?.secret,
        send,
        sendApproved: send,
        sendStamps: send,
        sendWatch: send,
        sendBoard: send,
        forward: (stageEvent) => forwardStageEvent(stageEvent, stage),
        touch: (touch) => forwardTouch(touch, touched)
      });
      if (env.webhook?.secret && status !== 401) note({ repo: repositoryOf(text3) });
      return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
    }),
    GET: loggedHandler(logger, "webhook", () => new Response("method not allowed", { status: 405, headers: { allow: "POST" } }))
  };
}

// apps/omni-app/entries/github.ts
var { POST, GET } = githubRoute(readEnv(processEnv()));
export {
  GET,
  POST
};
