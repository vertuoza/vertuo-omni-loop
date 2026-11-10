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
function envGroup(group2) {
  return group2;
}
var listOf = (names) => typeof names === "string" ? [names] : names;
function nameOf(names) {
  const [first, ...rest] = listOf(names);
  return rest.length ? `${first} (or ${rest.join(" or ")})` : `${first}`;
}
var sentence = (names) => names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
var verb = (names) => names.length === 1 ? "is" : "are";
function variablesOf(groups) {
  return [...new Set(groups.flatMap((group2) => Object.values(group2.variables).flatMap(listOf)))];
}
function requiredVariables(group2) {
  return members(group2).filter((member) => member.required).map((member) => member.name);
}
function members(group2) {
  const shape = group2.schema.shape;
  return Object.entries(group2.variables).map(([key, names]) => ({
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
function readGroup(source, group2, production) {
  const all = members(group2);
  const raw = {};
  for (const member of all) {
    const value = valueOf(source, member.names);
    if (value !== void 0) raw[member.key] = value;
  }
  const set = all.filter((member) => Object.hasOwn(raw, member.key));
  if (set.length === 0) {
    if (group2.required === "production" && production) {
      const names = requiredVariables(group2);
      return { value: null, problems: [{ variables: names, reason: `${sentence(names)} must be set in production (${group2.label})` }] };
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
        reason: `${sentence(unset)} ${verb(unset)} not set while ${sentence(given)} ${verb(given)} (${group2.label}: set all of them, or none)`
      }]
    };
  }
  const parsed = group2.schema.safeParse(raw);
  if (parsed.success) return { value: parsed.data, problems: [] };
  const byKey = new Map(all.map((member) => [member.key, member.name]));
  return {
    value: null,
    problems: parsed.error.issues.map((issue) => {
      const name = byKey.get(String(issue.path[0] ?? "")) ?? group2.label;
      return { variables: [name], reason: `${name} is not valid: ${issue.message}` };
    })
  };
}
function envReader(source, { production = false } = {}) {
  const problems = [];
  return {
    group(group2) {
      const read = readGroup(source, group2, production);
      problems.push(...read.problems);
      return read.value;
    },
    done() {
      if (problems.length) throw new EnvError(problems);
    }
  };
}
function requireGroup(value, group2, need) {
  if (value !== null) return value;
  const names = requiredVariables(group2);
  throw new EnvError([{ variables: names, reason: `${sentence(names)} ${verb(names)} not set: ${need}` }]);
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
var secretGroup = (label2, variable, required) => envGroup({ label: label2, schema: z3.object({ secret: z3.string() }), variables: { secret: variable }, ...required ? { required } : {} });
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
var BUSINESS_LAWS_JUDGE = secretGroup("the business laws judge", "BUSINESS_LAWS_JUDGE_SECRET");
var CRON = secretGroup("the cron secret", "CRON_SECRET");
var GALAXY = envGroup({
  label: "galaxy",
  schema: z3.object({ url: z3.url().optional() }),
  variables: { url: "GALAXY_URL" }
});
var VARIABLES = variablesOf([WEBHOOK, GITHUB_APP, SUPABASE, OPENROUTER, STAGE_EVENTS, CONSTITUENT_JUDGE, LAW_JUDGE, BUSINESS_LAWS_JUDGE, CRON, GALAXY]);
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
    businessLawsJudge: reader.group(BUSINESS_LAWS_JUDGE),
    cron: reader.group(CRON),
    galaxyUrl: (reader.group(GALAXY)?.url ?? DEFAULT_GALAXY_URL).replace(/\/+$/, "")
  };
  reader.done();
  return env;
}
function processEnv() {
  return process.env;
}

// apps/omni-app/src/jobs/sweep.ts
import { timingSafeEqual } from "node:crypto";

// packages/github/src/client.ts
var BACKGROUND_FLOOR = 0.2;
var DEFAULT_PAUSE_MS = 6e4;
var SECONDARY = /secondary rate limit/i;
var BUDGET_STEP = 0.02;
var BUDGET_FRESH_MS = 6e4;
var TOUCH_EVERY_MS = 24 * 36e5;
var MAX_STORED_BODY = 512 * 1024;
var GithubDeferred = class extends Error {
  until;
  constructor(until) {
    super(`GitHub budget below its background floor until ${new Date(until).toISOString()}`);
    this.name = "GithubDeferred";
    this.until = until;
  }
};
var GithubPaused = class extends Error {
  until;
  constructor(until) {
    super(`GitHub paused until ${new Date(until).toISOString()}`);
    this.name = "GithubPaused";
    this.until = until;
  }
};
function resourceOf(url) {
  return new URL(url).pathname.replace(/\/+$/, "").endsWith("/graphql") ? "graphql" : "core";
}
function plainHeaders(init) {
  const plain = {};
  new Headers(init).forEach((value, name) => {
    plain[name] = value;
  });
  return plain;
}
function budgetOf(headers) {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (!headers.has("x-ratelimit-limit") || !Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(reset)) return null;
  return { limit, remaining, resetAt: reset * 1e3 };
}
async function pauseOf(res, now) {
  if (res.status !== 403 && res.status !== 429) return null;
  const retryAfter = Number(res.headers.get("retry-after"));
  if (res.headers.has("retry-after") && Number.isFinite(retryAfter)) return now + retryAfter * 1e3;
  const until = resetOf(res.headers, now);
  return await saysSpent(res) ? until : null;
}
function resetOf(headers, now) {
  const reset = Number(headers.get("x-ratelimit-reset")) * 1e3;
  return Number.isFinite(reset) && reset > now ? reset : now + DEFAULT_PAUSE_MS;
}
async function saysSpent(res) {
  if (res.headers.get("x-ratelimit-remaining") === "0" || res.status === 429) return true;
  return SECONDARY.test(await res.clone().text().catch(() => ""));
}
function worthWriting(known, reported, at) {
  if (!known || known.limit !== reported.limit || known.resetAt !== reported.resetAt) return true;
  const step = reported.limit * BUDGET_STEP;
  return at - known.updatedAt >= BUDGET_FRESH_MS || Math.abs(known.remaining - reported.remaining) >= step || reported.remaining < reported.limit * BACKGROUND_FLOOR + step;
}
function refusal(budget, priority, now) {
  if (!budget) return null;
  if (budget.pausedUntil !== null && budget.pausedUntil > now) return new GithubPaused(budget.pausedUntil);
  const belowFloor = budget.resetAt > now && budget.remaining < budget.limit * BACKGROUND_FLOOR;
  return priority === "background" && belowFloor ? new GithubDeferred(budget.resetAt) : null;
}
function fromStore(res, kept) {
  const out = new Headers(res.headers);
  out.set("content-type", kept.contentType ?? "application/json");
  out.set("etag", kept.etag);
  return new Response(kept.body, { status: 200, headers: out });
}
function githubClient({ store, fetch: send = (url, init) => globalThis.fetch(url, init), clock = Date.now, log: log2 = (line) => {
  console.error(line);
} }) {
  let storeDown = false;
  async function stored(run) {
    if (!store) return null;
    try {
      const value = await run(store);
      storeDown = false;
      return value;
    } catch (error) {
      if (!storeDown) log2(`GitHub budget store failed, calling GitHub without it: ${error instanceof Error ? error.message : String(error)}`);
      storeDown = true;
      return null;
    }
  }
  async function record(installation, resource, known, res, at) {
    const reported = budgetOf(res.headers);
    const answeredResource = res.headers.get("x-ratelimit-resource") || resource;
    const stale = answeredResource === resource ? known : null;
    if (reported?.limit && worthWriting(stale, reported, at)) await stored((s) => s.saveBudget(installation, answeredResource, { ...reported, at }));
    const pauseUntil = await pauseOf(res, at);
    if (pauseUntil === null) return;
    await stored((s) => s.pause(installation, answeredResource, pauseUntil, at));
    log2(`GitHub paused installation ${installation} (${answeredResource}) until ${new Date(pauseUntil).toISOString()}: answered ${res.status}, rate limit spent`);
    throw new GithubPaused(pauseUntil);
  }
  async function conditionalOf(installation, url, resource, method) {
    const conditional = (method ?? "GET").toUpperCase() === "GET" && resource === "core";
    return { conditional, kept: conditional ? await stored((s) => s.etag(installation, url)) : null };
  }
  async function answerOf(installation, url, res, { conditional, kept }, at) {
    if (res.status === 304 && kept) {
      if (at - kept.readAt >= TOUCH_EVERY_MS) await stored((s) => s.touchEtag(installation, url, at));
      return fromStore(res, kept);
    }
    const etag = res.headers.get("etag");
    if (!conditional || res.status !== 200 || !etag) return res;
    const body = await res.clone().text();
    if (body.length > MAX_STORED_BODY) return res;
    await stored((s) => s.saveEtag(installation, url, { etag, body, contentType: res.headers.get("content-type"), at }));
    return res;
  }
  async function githubFetch(url, init) {
    const { installation, priority, ...rest } = init;
    if (!Number.isInteger(installation) || installation < 1) throw new Error(`githubFetch needs the installation whose budget it spends, not ${JSON.stringify(installation)}`);
    const resource = resourceOf(url);
    const known = await stored((s) => s.budget(installation, resource));
    const refused4 = refusal(known, priority, clock());
    if (refused4) throw refused4;
    const etag = await conditionalOf(installation, url, resource, rest.method);
    const headers = etag.kept ? { ...plainHeaders(rest.headers), "if-none-match": etag.kept.etag } : rest.headers;
    const res = await send(url, headers === void 0 ? rest : { ...rest, headers });
    const answered = clock();
    await record(installation, resource, known, res, answered);
    return answerOf(installation, url, res, etag, answered);
  }
  const stripPriority = (init) => {
    const rest = { ...init };
    delete rest.priority;
    return rest;
  };
  return {
    fetch: githubFetch,
    /** A plain `fetch(url, init)` spending `installation`'s budget at `priority`: Octokit's `request.fetch`. */
    bound({ installation, priority }) {
      return (url, init) => githubFetch(url, { ...stripPriority(init), installation, priority });
    }
  };
}

// packages/github/src/supabase-store.ts
import { z as z4 } from "zod";
var ETAG_COLUMNS = "etag, body, content_type, read_at";
var StoredEtagRow = z4.strictObject({ etag: z4.string(), body: z4.string(), content_type: z4.string().nullable(), read_at: z4.string() });
var BUDGET_COLUMNS = "limit, remaining, reset_at, paused_until, updated_at";
var StoredBudgetRow = z4.strictObject({
  limit: z4.number(),
  remaining: z4.number(),
  reset_at: z4.string(),
  paused_until: z4.string().nullable(),
  updated_at: z4.string()
});
var PausedRows = z4.array(z4.strictObject({ resource: z4.string() }));
var ms = (value) => Date.parse(value);
var iso = (value) => new Date(value).toISOString();
function refused(what, error) {
  if (error) throw new Error(`Supabase refused to ${what}: ${error.message}`);
}
function rowOf(schema, data, table) {
  if (data === null) return null;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${table} answered an unexpected row (${parsed.error.issues.map((issue) => `${issue.path.join(".") || "(the row)"} ${issue.code}`).join("; ")})`);
  return parsed.data;
}
function supabaseGithubStore(db) {
  return {
    async etag(installation, url) {
      const { data, error } = await db.etags().select(ETAG_COLUMNS).eq("installation_id", installation).eq("url", url).maybeSingle();
      refused("read an ETag", error);
      const row = rowOf(StoredEtagRow, data, "github_etags");
      return row ? { etag: row.etag, body: row.body, contentType: row.content_type, readAt: ms(row.read_at) } : null;
    },
    async saveEtag(installation, url, { etag, body, contentType = null, at }) {
      const { error } = await db.etags().upsert(
        { installation_id: installation, url, etag, body, content_type: contentType, read_at: iso(at) },
        { onConflict: "installation_id,url" }
      );
      refused("store an ETag", error);
    },
    async touchEtag(installation, url, at) {
      const { error } = await db.etags().update({ read_at: iso(at) }).eq("installation_id", installation).eq("url", url).select("url");
      refused("mark an ETag read", error);
    },
    async budget(installation, resource) {
      const { data, error } = await db.budget().select(BUDGET_COLUMNS).eq("installation_id", installation).eq("resource", resource).maybeSingle();
      refused("read the GitHub budget", error);
      const row = rowOf(StoredBudgetRow, data, "github_budget");
      return row ? { limit: row.limit, remaining: row.remaining, resetAt: ms(row.reset_at), pausedUntil: row.paused_until === null ? null : ms(row.paused_until), updatedAt: ms(row.updated_at) } : null;
    },
    /** What an answer reported; the columns it leaves out (paused_until) keep their value. */
    async saveBudget(installation, resource, { limit, remaining, resetAt, at }) {
      const { error } = await db.budget().upsert(
        { installation_id: installation, resource, limit, remaining, reset_at: iso(resetAt), updated_at: iso(at) },
        { onConflict: "installation_id,resource" }
      );
      refused("store the GitHub budget", error);
    },
    async pause(installation, resource, until, at) {
      const { data, error } = await db.budget().update({ paused_until: iso(until), updated_at: iso(at) }).eq("installation_id", installation).eq("resource", resource).select("resource");
      refused("pause the GitHub budget", error);
      if ((rowOf(PausedRows, data, "github_budget") ?? []).length > 0) return;
      const inserted = await db.budget().upsert(
        { installation_id: installation, resource, limit: 0, remaining: 0, reset_at: iso(until), paused_until: iso(until), updated_at: iso(at) },
        { onConflict: "installation_id,resource" }
      );
      refused("pause the GitHub budget", inserted.error);
    }
  };
}

// apps/omni-app/src/jobs/sweep.ts
import { z as z30 } from "zod";

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
function maskCredentials(text5) {
  return CREDENTIALS.reduce((masked, [shape, replacement]) => masked.replace(shape, replacement), text5);
}
var cut = (text5) => text5.length > MAX_TEXT ? text5.slice(0, MAX_TEXT) : text5;
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
  const now = () => {
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
      const start = now();
      return () => Math.max(0, Math.round(now() - start)) || 0;
    }
  };
}
var log = createLogger();

// apps/omni-app/src/knowledge-pack/store.ts
import { z as z6 } from "zod";

// apps/omni-app/src/server-event/service-db.ts
import { createClient } from "@supabase/supabase-js";
import { z as z5 } from "zod";
function serviceDb({ url, key, fetch }) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...fetch ? { global: { fetch } } : {}
  });
}
function rowsOf(schema, answer) {
  if (answer.error) throw new Error(`the database refused: ${answer.error.message}${answer.error.code ? ` (${answer.error.code})` : ""}`);
  return z5.array(schema).parse(answer.data ?? []);
}

// apps/omni-app/src/knowledge-pack/store.ts
var KeptSchema = z6.object({
  workspace: z6.string().min(1),
  packId: z6.string().min(1),
  created: z6.boolean(),
  newest: z6.boolean(),
  files: z6.number().int().nonnegative()
});
var PutAnswerSchema = z6.object({
  repository: z6.string().min(1),
  sha: z6.string().regex(/^[0-9a-f]{40}$/),
  packs: z6.array(KeptSchema)
});
var HolderSchema = z6.object({ product_id: z6.string().min(1) });
var refused2 = (error) => new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ""}`);
function knowledgePackStore(connection) {
  const db = serviceDb(connection);
  return {
    held: async (repository) => {
      const answer = await db.from("product_repositories").select("product_id").eq("repository", repository.toLowerCase()).limit(1);
      return rowsOf(HolderSchema, answer).length > 0;
    },
    put: async ({ repository, sha, committedAt, files }) => {
      const { data, error } = await db.rpc("knowledge_pack_put", {
        p_repo: repository,
        p_sha: sha,
        p_committed_at: committedAt,
        p_files: files.map(({ path, content, sha256 }) => ({ path, content, sha256 }))
      });
      if (error) throw refused2(error);
      return PutAnswerSchema.parse(data);
    }
  };
}

// apps/omni-app/src/octokit-for.ts
import { App } from "@octokit/app";
import { createClient as createClient2 } from "@supabase/supabase-js";
var APP_CALL = /^(\/api\/v3)?\/app(\/|$)/;
function installationOctokitFor(githubApp, github) {
  let app;
  return async (installationId) => {
    const { id, privateKey } = requireGroup(githubApp, GITHUB_APP, "the app reads GitHub as an installation");
    app ??= new App({ appId: id, privateKey });
    const octokit = await app.getInstallationOctokit(installationId);
    const budgeted = github.bound({ installation: installationId, priority: "background" });
    const fetch = (url, init) => APP_CALL.test(new URL(url).pathname) ? globalThis.fetch(url, init) : budgeted(url, init);
    octokit.hook.before("request", (options) => {
      options.request = { ...options.request, fetch };
    });
    return octokit;
  };
}
function appOctokitFor(githubApp) {
  let app;
  return () => {
    const { id, privateKey } = requireGroup(githubApp, GITHUB_APP, "the app looks up its installations as the App");
    app ??= new App({ appId: id, privateKey });
    return app.octokit;
  };
}
function githubStoreOf(supabase) {
  if (!supabase) return null;
  const db = createClient2(supabase.url, supabase.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return supabaseGithubStore({ etags: () => db.from("github_etags"), budget: () => db.from("github_budget") });
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

// apps/omni-app/src/jobs/delayed.ts
import { z as z9 } from "zod";

// kit/lib/config.ts
import { existsSync as existsSync2, readFileSync } from "node:fs";
import { join as join2 } from "node:path";
import { parse } from "yaml";
import { z as z8 } from "zod";

// kit/lib/narrow.ts
function isOneOf(values, value) {
  return values.some((member) => member === value);
}
function group(match, index) {
  const value = match?.[index];
  if (value === void 0) throw new Error(`group ${index} did not match`);
  return value;
}
function propertyOf(value, key) {
  return value === null || value === void 0 ? void 0 : Reflect.get(Object(value), key);
}
function messageOf(error) {
  const message = propertyOf(error, "message");
  return typeof message === "string" ? message : String(error);
}
function keysOf(record) {
  return Object.keys(record).filter((key) => Object.hasOwn(record, key));
}

// kit/lib/design/words/selector.ts
var NAME = String.raw`[A-Za-z_][\w-]*`;
var PART = String.raw`(?:#(${NAME})|\.(${NAME})|\[\s*(${NAME})\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s"']+))\s*)?\])`;
var COMPOUND = new RegExp(String.raw`^(\*|${NAME})?((?:${PART})*)$`);
function parseCompound(text5) {
  const compound = COMPOUND.exec(text5.trim());
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
import { z as z7 } from "zod";

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
  { point: "bug-fix.reproduce", skills: ["bug-fix", "mega-bug-fix"], modes: EXTEND, inputs: ["issue", "branch", "suspect", "boundary"], outputs: [] },
  { point: "bug-fix.review", skills: ["bug-fix", "mega-bug-fix"], modes: EXTEND, inputs: ["issue", "branch", "base"], outputs: [] },
  {
    point: "bug-fix.proof",
    skills: ["bug-fix", "mega-bug-fix"],
    modes: ANY,
    inputs: ["issue", "base", "head", "pr", "targets", "reproduction", "out"],
    outputs: ["before.* and after.* in {out}, the two recordings omni bug film reads", "an env: line, the preview environment's URL and lifetime", "the verdict line"]
  },
  { point: "yolo.ready", skills: ["yolo", "ultra-yolo"], modes: EXTEND, inputs: ["prd", "pr"], outputs: [] }
]);
function flowPoint(name) {
  return FLOW_POINTS.find(({ point }) => point === name);
}

// kit/lib/flow/schema.ts
var CLAUDE_ALIAS = "claude";
var DEFAULT_AREA = "default";
var text = z7.string().min(1);
var regexSource = z7.string().refine((source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}, "not a valid regular expression");
var hookRef = z7.union([text, z7.object({ path: text, alias: z7.literal(CLAUDE_ALIAS) }).strict()]);
var hookRefs = z7.union([hookRef, z7.array(hookRef).min(1)]);
var pointHooks = z7.union([
  hookRef,
  z7.object({ before: hookRefs.optional(), after: hookRefs.optional(), replace: hookRef.optional() }).strict()
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
var hooksSection = z7.record(z7.string(), pointHooks).superRefine((hooks, issues) => {
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
var planRule = z7.union([
  z7.object({ slice: z7.object({ alone: z7.boolean().optional(), maxFiles: z7.number().int().positive().optional() }).strict() }).strict(),
  z7.object({ wave: z7.literal("first") }).strict(),
  z7.object({ blocks: z7.literal("all") }).strict(),
  z7.object({ landing: z7.literal("alone") }).strict()
]);
var MERGE_METHODS = Object.freeze(["squash", "merge", "rebase"]);
var subPrRules = z7.object({
  merge: z7.enum(MERGE_METHODS).optional(),
  requireChecks: z7.array(text).optional(),
  approval: z7.literal("person").optional(),
  territory: z7.enum(["report", "block"]).optional(),
  maxOpen: z7.number().int().positive().optional()
}).strict();
var rulesSection = z7.object({ plan: z7.array(planRule).optional(), subPr: subPrRules.optional() }).strict();
var area = z7.object({
  paths: z7.array(regexSource).min(1, "at least one path pattern"),
  knowledge: text.optional(),
  inherit: z7.boolean().optional(),
  rules: rulesSection.optional(),
  hooks: hooksSection.optional()
}).strict();
var AREA_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
var FlowSchema = z7.object({
  rules: rulesSection.optional(),
  hooks: hooksSection.optional(),
  areas: z7.record(z7.string(), area).optional(),
  // Reserved for events, which a later PRD defines: refused until then, never read.
  on: z7.unknown().optional()
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
var text2 = z8.string().min(1);
var nullableText = text2.nullable();
var branchTemplate = z8.string().min(1);
var labelName = z8.string().min(1);
var section = (shape) => z8.preprocess((value) => value === void 0 ? {} : value, z8.object(shape).strict());
var trailerPart = text2.regex(/^[^<>\r\n]+$/, "one line, with no < or >");
var askUrl = z8.string().refine((value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" || url.protocol === "http:" && url.hostname === "127.0.0.1";
}, "an https URL, or http on 127.0.0.1");
var httpsUrl = z8.string().refine((value) => {
  if (/\s/.test(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "an absolute https URL");
var PROOF_GITHUB_DEPLOYMENT = "github-deployment";
var proofUrl = z8.string().refine((value) => {
  if (value === PROOF_GITHUB_DEPLOYMENT) return true;
  if (/\s/.test(value)) return false;
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, `${PROOF_GITHUB_DEPLOYMENT}, or an absolute http(s) URL`);
var envName = z8.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "the name of an environment variable, such as VERCEL_AUTOMATION_BYPASS_SECRET");
var wordSelector = text2.refine((value) => parseSelector(value) !== null, "a selector of tags, #ids, .classes and [attributes], comma-separated, with no combinator");
var lawOwner = z8.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9_.-]+)?$/, "a GitHub login or <org>/<team>, without @");
var personLogin = z8.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/, "a GitHub login, without @, never a team");
var ownerWithDelegate = z8.preprocess(
  (value) => isRecord(value) ? { login: "", delegate: "", ...value } : value,
  z8.object({ login: personLogin, delegate: personLogin }).strict().refine((entry) => entry.login.toLowerCase() !== entry.delegate.toLowerCase(), {
    message: "a delegate other than its own owner",
    path: ["delegate"]
  })
);
var lawOwnerEntry = z8.union([lawOwner, ownerWithDelegate]);
var DEFAULT_CONTRACT_KINDS = Object.freeze(["api", "db"]);
var contractKind = z8.string().regex(/^[a-z][a-z0-9-]*$/, "one lowercase word, such as api or db").refine((kind) => kind !== "none", "none is what a slice declares when it changes nothing \u2014 it is no kind");
var contractKinds = z8.array(contractKind).min(1, "at least one kind, such as api").transform((kinds) => kinds.map(layerOf)).superRefine((kinds, issues) => {
  const twice = kinds.find((kind, index) => kinds.indexOf(kind) !== index);
  if (twice !== void 0) issues.addIssue({ code: "custom", message: `"${twice}" is listed twice` });
});
var layersSection = z8.record(z8.string(), z8.array(regexSource).min(1, "at least one path pattern")).superRefine((layers, issues) => {
  for (const key of Object.keys(layers)) {
    if (!Object.hasOwn(CANONICAL_LAYERS, key)) {
      issues.addIssue({ code: "custom", path: [key], message: `${key} is not a layer (${layerList()})` });
    }
  }
});
var TARGET_KNOWLEDGE = Object.freeze(["own", "imported", "none"]);
var target = z8.object({
  repo: z8.string().regex(/^[\w.-]+\/[\w.-]+$/, "owner/name"),
  role: z8.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "one kebab-case word, such as back-end"),
  knowledge: z8.enum(TARGET_KNOWLEDGE),
  readAt: z8.string().regex(/^[0-9a-f]{40}$/, "the full 40-character commit the copy was read at").nullable().default(null),
  // PRD 1162: no slice and no roadmap row may name a read-only target; it is still read, surveyed
  // and imported.
  readOnly: z8.boolean().optional(),
  // PRD 1162: the short names of the targets whose default-branch packages this one installs.
  consumes: z8.array(z8.string()).optional()
}).strict();
function targetShortName(slug) {
  return slug.slice(slug.indexOf("/") + 1);
}
var planSection = z8.object({
  guide: nullableText.default(null),
  targets: z8.array(target).min(1, "at least one target").optional(),
  product: z8.string().trim().min(1).optional()
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
    consumes.forEach((name, at) => {
      const path = ["targets", index, "consumes", at];
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
var generatedEntry = z8.object({
  path: text2,
  from: z8.array(text2).min(1, "at least one source prefix"),
  build: z8.string().trim().min(1)
}).strict();
var AGENTS = Object.freeze(["claude", "codex", "cursor", "gemini"]);
var agentList = z8.array(z8.enum(AGENTS, { error: (issue) => `${String(issue.input)} is no agent the kit installs for \u2014 one of ${AGENTS.join(", ")}` })).min(1, "at least one agent").superRefine((agents, issues) => {
  agents.forEach((agent, index) => {
    if (agents.indexOf(agent) !== index) issues.addIssue({ code: "custom", path: [index], message: `${agent} is listed twice` });
  });
}).default(["claude"]);
var TIERS = Object.freeze(["deep", "build", "light"]);
var EFFORTS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);
var tierEntry = z8.object({
  model: text2,
  effort: z8.enum(EFFORTS, { error: (issue) => `${String(issue.input)} is no effort \u2014 one of ${EFFORTS.join(", ")}` }).optional()
}).strict();
var tierRow = z8.record(z8.string(), tierEntry).superRefine((row, issues) => {
  for (const tier of Object.keys(row)) {
    if (!isOneOf(TIERS, tier)) {
      issues.addIssue({ code: "custom", path: [tier], message: `${tier} is no tier \u2014 one of ${TIERS.join(", ")}` });
    }
  }
});
var SYNC_CHECKS = Object.freeze(["main", "kit", "knowledge", "page"]);
var SYNC_LEVELS = Object.freeze(["red", "orange", "off"]);
var SYNC_MAX_HOURS = 720;
var syncCheck = z8.enum(SYNC_CHECKS, { error: (issue) => `${String(issue.input)} is no check \u2014 one of ${SYNC_CHECKS.join(", ")}` });
var syncLevel = z8.enum(SYNC_LEVELS, { error: (issue) => `${String(issue.input)} is no level \u2014 one of ${SYNC_LEVELS.join(", ")}` });
var syncOrder = z8.array(syncCheck).superRefine((order, issues) => {
  const twice = order.find((check, index) => order.indexOf(check) !== index);
  if (twice !== void 0) issues.addIssue({ code: "custom", message: `${twice} is listed twice` });
  for (const check of SYNC_CHECKS) {
    if (!order.includes(check)) issues.addIssue({ code: "custom", message: `${check} is not listed \u2014 the order names ${SYNC_CHECKS.join(", ")}, each once` });
  }
});
var HOURS_MESSAGE = `a whole number of hours, written <n>h from 1h to ${SYNC_MAX_HOURS}h, such as 24h`;
var syncHours = z8.string({ error: HOURS_MESSAGE }).refine((value) => /^[1-9]\d*h$/.test(value) && Number.parseInt(value, 10) <= SYNC_MAX_HOURS, HOURS_MESSAGE);
var CONTEXT_BUDGET_FILE = ".omni-loop/budgets/context.json";
var ConfigSchema = z8.object({
  kit: z8.literal(CONFIG_VERSION),
  repo: section({
    slug: z8.string().regex(/^[\w.-]+\/[\w.-]+$/, "owner/name").nullable().default(null),
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
  tiers: z8.record(z8.string(), tierRow).optional(),
  paths: section({
    delivery: text2.default(".omni-loop/delivery"),
    knowledge: text2.default(".omni-loop/knowledge"),
    adr: text2.default(".omni-loop/knowledge/adr"),
    playbook: text2.default(".omni-loop/knowledge/playbook"),
    glossary: nullableText.default(null),
    context: z8.array(text2).default(["AGENTS.md", "CLAUDE.md"])
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
    autoCreate: z8.boolean().default(false)
  }),
  prLinks: section({
    feature: text2.default("Closes #{prd}"),
    sub: text2.default("Part of #{prd}"),
    phase0: text2.default("Refs #{prd}")
  }),
  // How a pull request into the default branch or a landing branch is opened: `openWith` names a
  // slash skill of this repository (`/create-pr`, say) that `/omni:pr` runs with `--base`,
  // `--draft` and `--non-interactive`; `null` keeps the kit's own `gh pr create`. Sub-PRs never use it.
  // PRD 2648: `ref` is how a pull request carries its issue's external reference (`omni ref`): `title`
  // holds `{ref}` and `{title}`, `none` (an issue with no marker) holds `{title}` or is null, `link`
  // is an `https://` URL holding `{ref}` or null. `null` changes nothing.
  pr: section({
    openWith: nullableText.default(null),
    ref: z8.object({
      title: text2.refine((value) => value.includes("{ref}") && value.includes("{title}"), "a title with {ref} and {title}"),
      none: text2.refine((value) => value.includes("{title}"), "a title with {title}").nullable().default(null),
      link: text2.refine((value) => value.startsWith("https://") && !/\s/.test(value) && value.includes("{ref}"), "an https:// URL with {ref}").nullable().default(null)
    }).strict().nullable().optional()
  }),
  board: section({ matchBy: z8.enum(["base", "label"]).default("base") }),
  ci: section({
    outboxContext: text2.default("outbox"),
    // PRD 675: the name of the check run the omni-loop App posts on a phase-0 PR.
    inboxContext: text2.default("inbox"),
    // PRD 1548 and PRD 1612: the name of the check run the omni-loop App posts on a target feature PR
    // of a product PRD, and on a ◆ PRD's feature PR and its target PRs, saying whether what it builds
    // is what was approved; `null` posts none.
    approvedContext: nullableText.default("omni/approved"),
    aggregateCheck: nullableText.default(null),
    branchProtection: z8.boolean().default(false),
    runner: text2.default("ubuntu-latest")
  }),
  commands: section({
    // PRD 1804: what prepares a fresh checkout to run the preflight (an install). Only the
    // multi-repository skills read it, from a target's default branch; `null` means none.
    setup: nullableText.default(null),
    preflight: nullableText.default(null),
    preflightFull: nullableText.default(null),
    checks: z8.array(text2).default([]),
    test: nullableText.default(null),
    // PRD 556: the command that runs mutation testing on the changed lines; `null` means none here.
    mutation: nullableText.default(null),
    // PRD 1369: a design linter `/omni:pixel-perfect review` runs when it is set; it only reports.
    design: nullableText.default(null),
    // PRD 2275: it builds what the repository ships to production, then runs checks against the
    // built output; only the bug-fix skills run it, when a passing reproduction cannot see the bug.
    smoke: nullableText.default(null)
  }),
  acceptance: z8.object({
    enabled: z8.boolean().default(false),
    dir: nullableText.default(null),
    pendingSuffix: nullableText.default(null),
    run: nullableText.default(null)
  }).strict().refine((a) => !a.enabled || a.dir !== null, {
    message: "acceptance.dir is required when acceptance.enabled is true",
    path: ["dir"]
  }).prefault({}),
  laws: section({
    source: z8.enum(["knowledge", "claudeMdInvariants", "none"]).default("none"),
    // The heading under which the context files (`paths.context`, in order) list the ADRs that are
    // law when `source` is `claudeMdInvariants`. Both names are kept from when CLAUDE.md alone was
    // read (PRD 1739), so every config that sets them still reads.
    claudeMdHeading: text2.default("## Invariants"),
    // PRD 1342: whether every rule and invariant must name its proof — a test's path, or
    // `pending #<n>` — so `omni check knowledge` refuses `Enforced by: unenforced`. Off by default:
    // a repository turns it on with the knowledge PR of its sweep (`omni knowledge judge`).
    requireProof: z8.boolean().default(false),
    // PRD 1726: at most this many locked laws (`Locked:` entries); `omni check knowledge` refuses more.
    max: z8.number().int().positive().default(20),
    // PRD 1726: who may lock a law and approve a change to one, as CODEOWNERS names them — GitHub
    // logins and `<org>/<team>`s, written without `@`. Empty, `omni check knowledge` refuses any lock.
    // PRD 1794: an entry may be `{ login, delegate }` instead; the delegate is a CODEOWNER too.
    owners: z8.array(lawOwnerEntry).default([]),
    // PRD 1794: product leadership, GitHub logins asked last about what still waits on a person.
    // Never written into CODEOWNERS, so its approval never clears a law.
    leadership: z8.array(personLogin).default([])
  }),
  risk: section({
    storedShape: z8.array(regexSource).default([]),
    sharedContract: z8.array(text2).default([])
  }),
  // Landings: the paths that must reach the default branch in a landing of their own (a
  // repository's migrations directories, say). Regex sources over repository paths, compiled once
  // by `omni plan check`; empty, no plan is refused for what it puts together.
  landings: section({ alone: z8.array(regexSource).default([]) }),
  // PRD 2346: the repository's map from canonical layers to the paths that hold them: regular
  // expressions over repository paths, as a flow area's `paths`. A file may be in several layers.
  // Optional: a config without it parses with no `layers` key, and no entry is narrowed by layer.
  layers: layersSection.optional(),
  // PRD 1870: whether every slice that lands in this repository must declare, in its plan's
  // `contract` column, what it changes for the repository's callers — one or more of `kinds`, or
  // `none`. Off by default. `kinds` are this repository's own words, `DEFAULT_CONTRACT_KINDS` when
  // it names none; `omni plan check` refuses a word outside them.
  contracts: section({
    declare: z8.boolean().default(false),
    kinds: contractKinds.default(() => [...DEFAULT_CONTRACT_KINDS])
  }),
  notify: section({
    slack: z8.object({ channelVar: text2.default("OMNI_SLACK_CHANNEL"), tokenSecret: text2.default("SLACK_BOT_TOKEN") }).strict().nullable().default(null)
  }),
  limits: section({
    stallDays: z8.number().int().positive().default(5),
    attempts: z8.number().int().positive().default(3),
    claimStaleMinutes: z8.number().int().positive().default(60),
    // PRD 2175: how long a draft still on `labels.inProgress` may go with no commit and no update
    // before the board reads its claim as stale: the fallback for a claim no runner saw die. Left
    // out, `DEFAULT_CLAIM_DEAD_MINUTES` applies, and a config that does not set it parses exactly as before.
    claimDeadMinutes: z8.number().int().positive().optional(),
    beforeAfterMaxBytes: z8.number().int().positive().default(512e3),
    // PRD 1205: how many loop steps run at once, counting those already running. 1 is the loop as it
    // was before, one step at a time.
    parallelSteps: z8.number().int().min(1).max(6).default(3),
    // PRD 1089: the size a flow hook file may reach. Left out, `DEFAULT_HOOK_MAX_BYTES` applies,
    // and a config that does not set it parses exactly as before.
    hookMaxBytes: z8.number().int().positive().optional(),
    // PRD 1794: how many working days (Monday to Friday, UTC) a thing waits on a person before the
    // next people are asked. Its own setting: `stallDays` is unchanged.
    escalationWorkingDays: z8.number().int().min(1).max(10).default(2)
  }),
  // Issue 1722: a PRD whose plan has fewer slices than `inlineBelow` is built on its feature branch
  // itself, one slice after the other, with no sub-PR per slice (`/omni:wave`, `inlineWave` in
  // `kit/lib/board.ts`). 0, the default, never does: every slice is a sub-PR, as it always was.
  wave: section({ inlineBelow: z8.number().int().min(0).default(0) }),
  ask: section({ url: askUrl.nullable().default(null) }),
  // PRD 216: whether `omni dossier` uploads this repository's PRD folders to the server `ask.url`
  // names. Off by default: a repository opts in. `dossierSwitch()` reads it with `ask.url`.
  dossier: section({ enabled: z8.boolean().default(false) }),
  // PRD 262: whether a PRD ships with a release note (`<folder>/release.md`, `kit/lib/releases/`).
  // Off by default: a repository opts in. When it is on, `omni ship` refuses a PRD whose folder has
  // no note, or whose note `omni check releases` would fail.
  releaseNotes: section({ enabled: z8.boolean().default(false) }),
  // PRD 251: whether an outbox may be answered outside the pull request — at the end of
  // `/omni:yolo` (`omni answers`) and on the page `ask.url` names. On by default: a repository
  // opts out. The pull request takes replies either way.
  answers: section({ enabled: z8.boolean().default(true) }),
  // PRD 2338: whether `/omni:retro-apply` writes the guard test a kept lesson is worth, proved red
  // then green, beside the rule it appends. Off by default: the retro PR stays documents only, and a
  // lesson worth a guard names it for a person to take up. A repository opts in.
  retro: section({ guards: z8.boolean().default(false) }),
  // PRD 2410: whether the GitHub App watches main for seven days after a feature PR merges, marking
  // the PRD broke on a red job on the merge commit, a revert or a traced regression, and queueing
  // `/omni:rewind` on the first break. On by default; read at the merge commit, so `false` there
  // opens no watch and queues no rewind.
  mainWatch: section({ enabled: z8.boolean().default(true) }),
  // PRD 798: how `/omni:prove` records a PRD's acceptance criteria. Off while `url` is null.
  // `setup` is a command that writes a Playwright storageState to `PROOF_STORAGE_STATE`;
  // `bypassEnv` names the variable holding the Vercel protection-bypass secret; `maxSeconds` caps a clip.
  // `deployment` names the GitHub deployment environment to film when a commit has several previews.
  proof: section({
    url: proofUrl.nullable().default(null),
    deployment: nullableText.default(null),
    setup: nullableText.default(null),
    bypassEnv: envName.nullable().default(null),
    maxSeconds: z8.number().int().positive().default(60)
  }),
  // PRD 1233 (beta): how `/omni:validate-e2e` keeps a PRD's acceptance criteria as e2e tests. Off by
  // default. `url`, `deployment`, `setup` and `bypassEnv` mean what they mean under `proof`; `dir` is
  // where the tests and their recordings live; `model` is the goal steps' OpenRouter id.
  e2e: section({
    enabled: z8.boolean().default(false),
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
    enabled: z8.boolean().default(false),
    paths: z8.array(text2).default([]),
    ignore: z8.array(text2).optional(),
    screens: nullableText.default(null),
    words: section({
      sentence: z8.number().int().positive().default(7),
      screen: wordSelector.default("[data-screen]"),
      primary: wordSelector.default("[data-primary]"),
      content: wordSelector.optional(),
      avoid: z8.array(text2).default([])
    })
  }),
  markers: section({ prefix: z8.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, digits and hyphens").default("omni-outbox") }),
  // Who co-signs the loop's commits, pull requests and issues (`kit/lib/signature.ts`). By
  // default the omni-loop GitHub App's bot account; `null` switches signing off. `footer` is a
  // template: `{name}` and `{home}` are filled from the keys they name, anything else is printed
  // as written. `home` defaults to the Omni Loop home page (ADR-0047, ADR-0055).
  signature: z8.object({
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
  generated: z8.array(generatedEntry).optional(),
  // PRD 1679: budgets on what the repository's agents read. `context` measures what a session loads
  // (`omni budget measure context`, `kit/lib/budgets/`) against the ceilings in `file`. Off by
  // default: a repository opts in. Optional: a config without it parses with no `budgets` key, and
  // `contextBudget()` reads it as off. Shaped `budgets.<name>` so a later budget is a key beside it.
  budgets: z8.object({ context: section({ enabled: z8.boolean().default(false), file: text2.default(CONTEXT_BUDGET_FILE) }) }).strict().optional(),
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
    let at = raw;
    for (const step of issue.path) at = isRecord(at) ? at[String(step)] : void 0;
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

// apps/omni-app/src/jobs/delayed.ts
var DELAYED_AFTER_MINUTES = 10;
var DELAYED_SUMMARY = "Delayed: Omni is retrying this check";
var DEFAULTS = ConfigSchema.parse({ kit: 1 }).ci;
var DELAYED_CHECKS = {
  "pr-outbox": DEFAULTS.outboxContext,
  "pr-inbox": DEFAULTS.inboxContext,
  "pr-approved": DEFAULTS.approvedContext ?? "omni/approved",
  "pr-budgets": "omni / budgets"
};
var DueRowSchema = z9.object({ kind: z9.string().min(1), key: z9.string().min(1), payload: z9.record(z9.string(), z9.unknown()) });
function delayedStore(connection) {
  const db = serviceDb(connection);
  return {
    due: async ({ kinds, before }) => rowsOf(
      DueRowSchema,
      await db.from("background_jobs").select("kind, key, payload").eq("state", "queued").in("kind", kinds).lte("run_after", before).order("run_after")
    )
  };
}
var TargetSchema = z9.object({
  installationId: z9.number(),
  owner: z9.string().min(1),
  repo: z9.string().min(1),
  headSha: z9.string().regex(/^[0-9a-f]{40}$/)
});
var budgetRefused = (error) => error instanceof GithubDeferred || error instanceof GithubPaused || error instanceof Error && budgetRefused(error.cause);
var firstLine = (error) => (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
async function postDelayed({
  store,
  octokitFor,
  clock = Date.now,
  log: log2 = noteTo("jobs")
}) {
  const before = new Date(clock() - DELAYED_AFTER_MINUTES * 6e4).toISOString();
  const jobs = await store.due({ kinds: Object.keys(DELAYED_CHECKS), before });
  const summary = { due: jobs.length, posted: 0, skipped: 0, failed: 0, stopped: false };
  for (const { kind, key, payload } of jobs) {
    const name = DELAYED_CHECKS[kind];
    const target2 = TargetSchema.safeParse(payload);
    if (name === void 0 || !target2.success) {
      summary.skipped += 1;
      log2(`a ${kind} job is delayed but holds no commit to show it on: left alone`);
      continue;
    }
    const { installationId, owner, repo, headSha } = target2.data;
    try {
      const octokit = await octokitFor(installationId);
      await octokit.request("POST /repos/{owner}/{repo}/check-runs", {
        owner,
        repo,
        name,
        head_sha: headSha,
        status: "queued",
        output: { title: "Delayed", summary: DELAYED_SUMMARY }
      });
      summary.posted += 1;
    } catch (error) {
      if (budgetRefused(error)) {
        summary.stopped = true;
        log2("the delayed checks stopped: GitHub's budget is low, the rest waits for the next sweep");
        break;
      }
      summary.failed += 1;
      log2(`the delayed check of ${key} could not be posted: ${firstLine(error)}`);
    }
  }
  return summary;
}

// apps/omni-app/src/jobs/gaps.ts
import { z as z28 } from "zod";

// apps/omni-app/src/knowledge-pack/github.ts
import { mkdtempSync as mkdtempSync3, readdirSync, readFileSync as readFileSync3, rmSync as rmSync2, statSync as statSync2 } from "node:fs";
import { tmpdir as tmpdir3 } from "node:os";
import { join as join5 } from "node:path";
import { z as z13 } from "zod";

// apps/omni-app/src/retro/github.ts
import { mkdtempSync as mkdtempSync2, readFileSync as readFileSync2, rmSync } from "node:fs";
import { tmpdir as tmpdir2 } from "node:os";
import { join as join4 } from "node:path";

// apps/omni-app/src/snapshot/snapshot.ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join as join3 } from "node:path";

// apps/omni-app/src/outbox-check/github-schema.ts
import { z as z11 } from "zod";

// kit/lib/ids.ts
import { z as z10 } from "zod";

// kit/lib/schema/parse-or-throw.ts
function parseOrThrow(schema, value, shape) {
  const parsed = schema.safeParse(value, { error: KIT_MESSAGES });
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue && issue.path.length ? `${issue.path.join(".")}: ` : "";
  throw new Error(`${shape}: ${field}${issue?.message ?? "invalid"}`);
}

// kit/lib/ids.ts
var IssueNumberSchema = z10.number().int().positive().brand();
var PrdNumberSchema = IssueNumberSchema.brand();
var PRODUCT_SEQ_MAX = 2 ** 31 - 1;
var PRODUCT_PRD = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([1-9]\d{0,9})$/;
var ProductPrdIdSchema = z10.string().regex(PRODUCT_PRD).refine((id) => {
  const cut2 = id.lastIndexOf("-");
  return cut2 <= 40 && Number(id.slice(cut2 + 1)) <= PRODUCT_SEQ_MAX;
}).brand();
var PRODUCT_ROADMAP = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-R([1-9]\d{0,9})$/;
var ProductRoadmapIdSchema = z10.string().regex(PRODUCT_ROADMAP).refine((id) => {
  const cut2 = id.lastIndexOf("-R");
  return cut2 <= 40 && Number(id.slice(cut2 + 2)) <= PRODUCT_SEQ_MAX;
}).brand();
var PRODUCT_BUG = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-B([1-9]\d{0,9})$/;
var ProductBugIdSchema = z10.string().regex(PRODUCT_BUG).refine((id) => {
  const cut2 = id.lastIndexOf("-B");
  return cut2 <= 40 && Number(id.slice(cut2 + 2)) <= PRODUCT_SEQ_MAX;
}).brand();
var PrNumberSchema = z10.number().int().positive().brand();
var CommentIdSchema = z10.number().int().positive().brand();
var WorkSliceIdSchema = z10.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).brand();
var SliceIdSchema = z10.string().regex(/^s\d+$/).brand().brand();
var OutboxItemIdSchema = z10.string().regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?s\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/).brand();
var DIGITS = /^\d+$/;
function numeric(value) {
  return typeof value === "string" && DIGITS.test(value) ? Number(value) : value;
}
function parseId(schema, value, what, given) {
  return parseOrThrow(schema, value, `${what} ${JSON.stringify(given)}`);
}
function parseIssue(value) {
  return parseId(IssueNumberSchema, numeric(value), "issue number", value);
}

// apps/omni-app/src/outbox-check/github-schema.ts
var Label = z11.union([z11.string(), z11.looseObject({ name: z11.string().nullish() })]);
var PullSchema = z11.looseObject({
  base: z11.looseObject({ ref: z11.string(), sha: z11.string() }),
  head: z11.looseObject({ ref: z11.string(), sha: z11.string() }),
  labels: z11.array(Label).nullish(),
  body: z11.string().nullish()
});
var PullsPageSchema = z11.array(z11.looseObject({ number: z11.number(), body: z11.string().nullish() }));
var PullHeadSchema = z11.looseObject({ head: z11.looseObject({ sha: z11.string() }) });
var IssueSchema = z11.looseObject({
  state: z11.string(),
  labels: z11.array(Label).nullish(),
  pull_request: z11.unknown().optional()
});
var CreatedSchema = z11.looseObject({ id: z11.number() });
var CommentWrittenSchema = z11.looseObject({ id: CommentIdSchema });
var CommentsPageSchema = z11.array(z11.looseObject({ id: CommentIdSchema, body: z11.string().nullish() }));
var ComparePageSchema = z11.looseObject({
  files: z11.array(z11.looseObject({ filename: z11.string(), status: z11.string() })).nullish(),
  commits: z11.array(z11.looseObject({ sha: z11.string(), commit: z11.looseObject({ message: z11.string().nullish() }).nullish() })).nullish()
});
var ReviewsPageSchema = z11.array(
  z11.looseObject({
    user: z11.looseObject({ login: z11.string() }).nullish(),
    state: z11.string(),
    commit_id: z11.string().nullish()
  })
);
var CheckRunsSchema = z11.looseObject({
  check_runs: z11.array(z11.looseObject({ id: z11.number(), status: z11.string().nullish() })).nullish()
});
var TreeEntrySchema = z11.looseObject({
  path: z11.string(),
  mode: z11.string(),
  type: z11.string(),
  sha: z11.string(),
  size: z11.number().nullish()
});
var TreeSchema = z11.looseObject({ truncated: z11.boolean().nullish(), tree: z11.array(TreeEntrySchema) });
var BlobSchema = z11.looseObject({ content: z11.string(), encoding: z11.string().nullish() });
var RefSchema = z11.looseObject({ object: z11.looseObject({ sha: z11.string() }) });
var GitCommitSchema = z11.looseObject({ tree: z11.looseObject({ sha: z11.string() }) });
var ShaSchema = z11.looseObject({ sha: z11.string() });
var PullWrittenSchema = z11.looseObject({ number: PrNumberSchema, html_url: z11.string() });
var PullsSchema = z11.array(
  z11.looseObject({
    number: PrNumberSchema,
    html_url: z11.string(),
    state: z11.string(),
    merged_at: z11.string().nullish(),
    head: z11.looseObject({ sha: z11.string().nullish() }).nullish()
  })
);
var FailureSchema = z11.looseObject({ status: z11.unknown(), message: z11.unknown() }).partial();

// apps/omni-app/src/snapshot/snapshot.ts
var MAX_FILES = 2e3;
var MAX_BYTES = 20 * 1024 * 1024;
var BLOB_CONCURRENCY = 16;
var TREE = "GET /repos/{owner}/{repo}/git/trees/{tree_sha}";
var BLOB = "GET /repos/{owner}/{repo}/git/blobs/{file_sha}";
var SnapshotBoundError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SnapshotBoundError";
  }
};
async function snapshot(octokit, {
  owner,
  repo,
  ref,
  paths,
  dest,
  fetchIf = () => true
}) {
  const segmentsOf = paths.map(repositoryPath);
  const trees = /* @__PURE__ */ new Map();
  const tree = async (treeSha, recursive = false) => {
    const key = `${treeSha}${recursive ? ":r" : ""}`;
    const known = trees.get(key);
    if (known) return known;
    const params = { owner, repo, tree_sha: treeSha, ...recursive ? { recursive: "1" } : {} };
    const { data: answer } = await octokit.request(TREE, params);
    const data = TreeSchema.parse(answer);
    if (data.truncated) {
      throw new SnapshotBoundError(`The tree under ${treeSha} is too large for GitHub to list whole.`);
    }
    trees.set(key, data.tree);
    return data.tree;
  };
  const files = /* @__PURE__ */ new Map();
  for (const segments of segmentsOf) {
    for (const file of await filesUnder(tree, ref, segments)) files.set(file.path, file);
  }
  const listed = [...files.values()];
  const list = listed.filter((file) => fetchIf(file.path));
  if (list.length > MAX_FILES) {
    throw new SnapshotBoundError(
      `The snapshot holds ${list.length.toLocaleString("en-US")} files, over the bound of ${MAX_FILES.toLocaleString("en-US")} files.`
    );
  }
  const bytes = list.reduce((sum, file) => sum + (file.size ?? 0), 0);
  if (bytes > MAX_BYTES) {
    throw new SnapshotBoundError(
      `The snapshot holds ${bytes.toLocaleString("en-US")} bytes, over the bound of 20 MB.`
    );
  }
  const folder = dest ?? mkdtempSync(join3(tmpdir(), "omni-snapshot-"));
  for (const file of listed) {
    if (fetchIf(file.path)) continue;
    const target2 = join3(folder, ...repositoryPath(file.path));
    mkdirSync(dirname(target2), { recursive: true });
    writeFileSync(target2, "");
  }
  const queue = [...list];
  const fetchNext = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const { data: answer } = await octokit.request(BLOB, { owner, repo, file_sha: file.sha });
      const data = BlobSchema.parse(answer);
      const target2 = join3(folder, ...repositoryPath(file.path));
      mkdirSync(dirname(target2), { recursive: true });
      writeFileSync(target2, Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8"));
    }
  };
  await Promise.all(Array.from({ length: Math.min(BLOB_CONCURRENCY, queue.length) }, fetchNext));
  return folder;
}
function repositoryPath(path) {
  const segments = path.split("/").filter((segment) => segment !== "");
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`snapshot: "${path}" is not a repository path.`);
  }
  return segments;
}
async function filesUnder(tree, ref, segments) {
  let entries = await tree(ref);
  for (const [index, name] of segments.entries()) {
    const entry = entries.find((candidate) => candidate.path === name);
    if (!entry) return [];
    const path = segments.slice(0, index + 1).join("/");
    const last = index === segments.length - 1;
    if (entry.type === "blob") {
      return last && isRegular(entry) ? [{ path, sha: entry.sha, size: entry.size }] : [];
    }
    if (entry.type !== "tree") return [];
    if (last) {
      return (await tree(entry.sha, true)).filter((child) => child.type === "blob" && isRegular(child)).map((child) => ({ path: `${path}/${child.path}`, sha: child.sha, size: child.size }));
    }
    entries = await tree(entry.sha);
  }
  return [];
}
var isRegular = (entry) => entry.mode === "100644" || entry.mode === "100755";

// apps/omni-app/src/retro/github.schema.ts
import { z as z12 } from "zod";
var label = z12.union([z12.string(), z12.object({ name: z12.string() })]);
var PullSchema2 = z12.object({
  number: PrNumberSchema,
  title: z12.string().nullish(),
  html_url: z12.string().nullish(),
  state: z12.string().nullish(),
  draft: z12.boolean().nullish(),
  merged: z12.boolean().nullish(),
  base: z12.object({ ref: z12.string() }),
  head: z12.object({ ref: z12.string(), sha: z12.string() }),
  created_at: z12.string().nullish(),
  closed_at: z12.string().nullish(),
  merged_at: z12.string().nullish(),
  merge_commit_sha: z12.string().nullish(),
  labels: z12.array(label).nullish()
});
var ListSchema = z12.array(z12.unknown());
var PullsSchema2 = z12.array(PullSchema2.extend({ state: z12.string(), created_at: z12.string() }));
var RetroPullsSchema = z12.array(z12.object({ number: PrNumberSchema, state: z12.string(), html_url: z12.string() }));
var InstallationSchema = z12.object({ id: z12.number() });
var TreeSchema2 = z12.object({
  tree: z12.array(z12.object({ path: z12.string(), type: z12.string(), sha: z12.string() }))
});
var ContentSchema = z12.union([
  z12.array(z12.unknown()),
  z12.object({ type: z12.string(), content: z12.string().nullish(), encoding: z12.string().nullish() })
]);
var BlobSchema2 = z12.object({ content: z12.string().nullish(), encoding: z12.string().nullish() });
var RefSchema2 = z12.object({ object: z12.object({ sha: z12.string() }) });
var IssuesSchema = z12.array(
  z12.object({
    number: IssueNumberSchema,
    html_url: z12.string(),
    state: z12.string(),
    title: z12.string(),
    body: z12.string().nullish(),
    pull_request: z12.unknown().optional()
  })
);
var CreatedIssueSchema = z12.object({ number: IssueNumberSchema, html_url: z12.string() });
var CreatedCommentSchema = z12.object({ id: CommentIdSchema });
var RetroDocSchema = z12.object({ runs: z12.array(z12.unknown()).catch([]) }).catch({ runs: [] });
var RetroLessonsSchema = z12.object({ lessons: z12.array(z12.object({ text: z12.unknown() }).catch({ text: null })).catch([]) }).catch({ lessons: [] });

// apps/omni-app/src/retro/github.ts
var PER_PAGE = 100;
var MAX_PAGES = 30;
async function paginate(fetchPage) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const items = await fetchPage(page);
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
}

// apps/omni-app/src/knowledge-pack/github.ts
var PullFileSchema = z13.looseObject({ filename: z13.string().min(1), previous_filename: z13.string().nullish() });
async function changedPaths(octokit, { owner, repo, prNumber }) {
  const files = await paginate(async (page) => {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", { owner, repo, pull_number: prNumber, per_page: PER_PAGE, page });
    return z13.array(PullFileSchema).parse(data);
  });
  return files.map((file) => ({ path: file.filename, previous: file.previous_filename ?? null }));
}
function filesIn(root, dir = "") {
  return readdirSync(join5(root, dir)).flatMap((name) => {
    const rel = dir ? `${dir}/${name}` : name;
    return statSync2(join5(root, rel)).isDirectory() ? filesIn(root, rel) : [rel];
  });
}
async function withPathsAt(octokit, { owner, repo, sha, paths }, fn) {
  const root = mkdtempSync3(join5(tmpdir3(), "omni-knowledge-pack-"));
  try {
    await snapshot(octokit, { owner, repo, ref: sha, paths, dest: root });
    return fn(root);
  } finally {
    rmSync2(root, { recursive: true, force: true });
  }
}
async function configAt(octokit, where) {
  return withPathsAt(octokit, { ...where, paths: [CONFIG_FILE] }, (root) => {
    const files = filesIn(root);
    if (!files.includes(CONFIG_FILE)) return { none: `it has no ${CONFIG_FILE}` };
    try {
      return { config: parseConfig(readFileSync3(join5(root, CONFIG_FILE), "utf8"), CONFIG_FILE, { ignoreUnknownKeys: true }) };
    } catch (error) {
      return { none: `its config does not parse: ${(error instanceof Error ? error.message : String(error)).split("\n")[0] ?? ""}` };
    }
  });
}
async function packBytesAt(octokit, { owner, repo, sha, paths }) {
  return withPathsAt(
    octokit,
    { owner, repo, sha, paths: [...paths.folders, ...paths.files] },
    (root) => new Map(filesIn(root).map((path) => [path, readFileSync3(join5(root, path))]))
  );
}

// apps/omni-app/src/knowledge-pack/paths.ts
function repositoryPath2(path) {
  if (path.startsWith("/") || path.includes("\\")) return null;
  const segments = path.split("/").filter((segment) => segment !== "" && segment !== ".");
  if (segments.length === 0 || segments.includes("..")) return null;
  return segments.join("/");
}
var within = (path, folder) => path === folder || path.startsWith(`${folder}/`);
function knowledgeFolders(config) {
  const { knowledge, adr, playbook, glossary } = config.paths;
  const named = [knowledge, adr, playbook, glossary].map((path) => typeof path === "string" ? repositoryPath2(path) : null).filter((path) => path !== null);
  const unique = [...new Set(named)];
  return unique.filter((folder) => !unique.some((other) => other !== folder && within(folder, other))).sort();
}
function hookFiles(hooks) {
  return Object.values(hooks ?? {}).flatMap((value) => {
    const { before, after, replace } = hooksByMode(value);
    return [...before, ...replace === null ? [] : [replace], ...after].flatMap((ref) => {
      const path = typeof ref === "string" ? ref : ref.path;
      if (typeof ref !== "string" && path.startsWith("/")) return [];
      const file = repositoryPath2(path);
      return file === null ? [] : [file];
    });
  });
}
function flowFiles(config) {
  const { flow } = config;
  const hooks = flow ? [...hookFiles(flow.hooks), ...Object.values(flow.areas ?? {}).flatMap((area2) => hookFiles(area2.hooks))] : [];
  return [.../* @__PURE__ */ new Set([CONFIG_FILE, ...hooks])].sort();
}
function packPaths(config) {
  const folders = knowledgeFolders(config);
  const files = flowFiles(config).filter((file) => !folders.some((folder) => within(file, folder)));
  return { folders, files };
}
function touchesPack(changed, { folders, files }) {
  const held = (path) => files.includes(path) || folders.some((folder) => within(path, folder));
  return changed.some(({ path, previous }) => held(path) || typeof previous === "string" && held(previous));
}

// apps/omni-app/src/jobs/pack.ts
import { z as z27 } from "zod";

// apps/omni-app/src/knowledge-harvest/github.ts
import { mkdtempSync as mkdtempSync7, readdirSync as readdirSync14, rmSync as rmSync8, statSync as statSync9 } from "node:fs";
import { tmpdir as tmpdir7 } from "node:os";
import { join as join39 } from "node:path";

// kit/lib/context.ts
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

// kit/lib/layout.ts
import { existsSync as existsSync4, readdirSync as readdirSync2 } from "node:fs";
import { join as join7, posix } from "node:path";

// kit/lib/playbook/forms.ts
import { existsSync as existsSync3, readFileSync as readFileSync4 } from "node:fs";
import { join as join6 } from "node:path";
import { parse as parse2 } from "yaml";
import { z as z14 } from "zod";
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
var FrontMatterSchema = z14.object({
  form: z14.enum(FORM_IDS),
  "form-version": z14.number().int().positive(),
  state: z14.enum(FORM_STATES),
  "points-to": z14.string().min(1).nullable(),
  evidence: z14.array(z14.string().regex(EVIDENCE, "each entry is <path>@<hex>, the file at its git hash-object")).nullable(),
  invaded: z14.string().regex(DATE, "a YYYY-MM-DD date").nullable().optional(),
  [OLD_DATE_KEY]: z14.string().regex(DATE, "a YYYY-MM-DD date").nullable().optional(),
  index: z14.string().min(1).optional()
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

// kit/lib/knowledge/pipeline.ts
import {
  cpSync,
  existsSync as existsSync25,
  mkdirSync as mkdirSync7,
  mkdtempSync as mkdtempSync4,
  readdirSync as readdirSync9,
  readFileSync as readFileSync20,
  renameSync,
  rmSync as rmSync5,
  statSync as statSync6,
  symlinkSync,
  writeFileSync as writeFileSync7
} from "node:fs";
import { tmpdir as tmpdir4 } from "node:os";
import { dirname as dirname8, join as join27 } from "node:path";
import { z as z20 } from "zod";

// kit/lib/delivery/ship.ts
import { execFileSync as execFileSync3 } from "node:child_process";
import { existsSync as existsSync12, readFileSync as readFileSync10, writeFileSync as writeFileSync3, mkdirSync as mkdirSync3 } from "node:fs";
import { basename as basename3, join as join14, dirname as dirname4 } from "node:path";

// kit/lib/check-report.ts
import { execFileSync as execFileSync2 } from "node:child_process";
import { readFileSync as readFileSync5 } from "node:fs";
import { join as join8 } from "node:path";
var LIST_MAX_BYTES = 256 * 1024 * 1024;

// kit/lib/outbox/status.ts
import { existsSync as existsSync10 } from "node:fs";

// kit/lib/commands.ts
var COMMANDS = Object.freeze({
  brainstorm: "/omni:brainstorm",
  yolo: "/omni:yolo",
  yoloFix: "/omni:yolo-fix",
  deliver: "/omni:deliver"
});

// kit/lib/outbox/account.ts
import { existsSync as existsSync9, readdirSync as readdirSync5 } from "node:fs";
import { basename as basename2 } from "node:path";

// kit/lib/schema/front-matter.ts
import { z as z15 } from "zod";
var SPEC_VALUES = ["file", "issue"];
var PROOF_VALUES = ["video"];
var E2E_VALUES = ["validate"];
var PHASE0_VALUES = ["server"];
var RANK_VALUES = ["human-action", "high", "medium"];
var BLOCKED_BY_MESSAGE = 'blocked-by must be "none" or a bracketed list of PRD numbers, e.g. [966]';
var BLOCKED_BY_LIST = /^\[\s*(\d+\s*(?:,\s*\d+\s*)*)?\]$/;
var BRACKET_LIST = /^\[([\s\S]*)\]$/;
var DATE2 = /^\d{4}-\d{2}-\d{2}$/;
var PrdField = z15.coerce.number({ message: "prd must be a number" }).int().positive().pipe(PrdNumberSchema);
var ItemPrdField = z15.string().transform((raw, refinement) => {
  const product = ProductPrdIdSchema.safeParse(raw);
  if (product.success) return product.data;
  const prd = PrdField.safeParse(raw);
  if (prd.success) return prd.data;
  refinement.addIssue({ code: "custom", message: "prd must be a number, or a product PRD like mobile-12" });
  return z15.NEVER;
});
var SliceField = z15.string().trim().min(1, "slice is required").pipe(WorkSliceIdSchema);
var BlockedBySchema = z15.string().trim().min(1, "blocked-by is required").transform((raw, ctx) => {
  if (raw === "none") return "none";
  const match = raw.match(BLOCKED_BY_LIST);
  if (!match) {
    ctx.addIssue({
      code: "custom",
      message: BLOCKED_BY_MESSAGE
    });
    return z15.NEVER;
  }
  const inner = (match[1] ?? "").trim();
  const prds = inner.length === 0 ? [] : inner.split(",").map((token) => PrdNumberSchema.safeParse(Number(token.trim())));
  const read = prds.flatMap((prd) => prd.success ? [prd.data] : []);
  if (read.length !== prds.length) {
    ctx.addIssue({ code: "custom", message: BLOCKED_BY_MESSAGE });
    return z15.NEVER;
  }
  return read;
});
var AreasSchema = z15.string().trim().transform((raw, ctx) => {
  const match = raw.match(BRACKET_LIST);
  if (!match) {
    ctx.addIssue({
      code: "custom",
      message: "areas must be a bracketed list of domain folder names, e.g. [credits]"
    });
    return z15.NEVER;
  }
  const inner = (match[1] ?? "").trim();
  return inner.length === 0 ? [] : inner.split(",").map((token) => token.trim());
}).optional();
var SpecFrontMatterSchema = z15.object({
  prd: PrdField,
  title: z15.string().trim().min(1, "title is required"),
  "blocked-by": BlockedBySchema,
  spec: z15.enum(SPEC_VALUES, { message: `spec must be one of: ${SPEC_VALUES.join(", ")}` }),
  areas: AreasSchema,
  // PRD 798: `proof: video` asks `/omni:yolo` to follow `/omni:prove` once the feature PR is ready.
  proof: z15.enum(PROOF_VALUES, { message: `proof must be ${PROOF_VALUES.join(" or ")}, or left out` }).optional(),
  // PRD 1275: `e2e: validate` asks `/omni:yolo` to follow `/omni:validate-e2e` once the feature PR is ready.
  e2e: z15.enum(E2E_VALUES, { message: `e2e must be ${E2E_VALUES.join(" or ")}, or left out` }).optional(),
  // PRD 1299: `phase0: server` says the PRD is approved on its PRD page, not by a phase-0 PR.
  phase0: z15.enum(PHASE0_VALUES, { message: `phase0 must be ${PHASE0_VALUES.join(" or ")}, or left out` }).optional()
}).strict();
var OutboxItemFrontMatterSchema = z15.object({
  id: z15.string().trim().min(1, "id is required").pipe(OutboxItemIdSchema),
  prd: ItemPrdField,
  slice: SliceField,
  rank: z15.enum(RANK_VALUES, {
    message: `rank must be one of: ${RANK_VALUES.join(", ")}`
  }),
  "bears-on": z15.string().trim().min(1, "bears-on is required"),
  raised: z15.string().regex(DATE2, "raised must be a YYYY-MM-DD date"),
  wave: z15.coerce.number({ message: "wave must be a number" }).int().positive()
}).strict();
var AccountFrontMatterSchema = z15.object({
  prd: PrdField,
  slice: SliceField,
  graded: z15.string().regex(DATE2, "graded must be a YYYY-MM-DD date")
}).strict();

// kit/lib/outbox/outbox.ts
import { existsSync as existsSync5, readdirSync as readdirSync3 } from "node:fs";
import { join as join9 } from "node:path";
var PERSON_STEPS_HEADING = "What a person must do";
var SECTION_FIELD = {
  "The question, in plain words": "questionPlain",
  "The decision, in plain words": "decisionPlain",
  "The intro, for fun": "introFun",
  "The punchline, for fun": "punchlineFun",
  [PERSON_STEPS_HEADING]: "personSteps",
  "What I had to decide": "whatIHadToDecide",
  "What I did meanwhile": "whatIDidMeanwhile",
  "What it costs to change later": "whatItCostsToChangeLater",
  "What I could not know": "whatICouldNotKnow"
};
var FILE_EXTENSION = "(?:mjs|cjs|mts|cts|js|jsx|ts|tsx|json|ya?ml|md|mdx|py|rb|go|java|sh|html?|css)";
var FILE_PATH_PATTERN = new RegExp(
  String.raw`\b[\w.-]*\.${FILE_EXTENSION}\b|\b[\w.-]+(?:/[\w.-]+)+\b`,
  "gi"
);

// kit/lib/outbox/settle.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync2, readFileSync as readFileSync6, rmSync as rmSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, isAbsolute, join as join10, relative } from "node:path";
import { z as z16 } from "zod";
var VERDICTS = ["agreed", "drifted"];
var CHANNEL_KINDS = ["prd-issue", "feature-pull-request"];
var AnswerChannelSchema = z16.object({
  kind: z16.enum(CHANNEL_KINDS, {
    message: `channel.kind must be one of: ${CHANNEL_KINDS.join(", ")}`
  }),
  number: z16.coerce.number({ message: "channel.number must be a number" }).int().positive(),
  url: z16.string().trim().min(1).optional()
}).strict();
var AnswerSchema = z16.object({
  text: z16.string().trim().min(1, "the answer text is required"),
  approvedBy: z16.string().trim().min(1, "approvedBy is required \u2014 who approved it"),
  approvedAt: z16.string().regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/,
    "approvedAt must be an ISO date or date-time"
  ),
  channel: AnswerChannelSchema,
  statedVerdict: z16.enum(VERDICTS).optional()
}).strict();

// kit/lib/codeowners.ts
var CODEOWNERS_FOLDERS = [".github", "", "docs"];
var CODEOWNERS_FILES = Object.freeze(CODEOWNERS_FOLDERS.map((folder) => folder === "" ? "CODEOWNERS" : `${folder}/CODEOWNERS`));

// kit/lib/playbook/briefing-files.ts
import { existsSync as existsSync7, readFileSync as readFileSync7 } from "node:fs";
import { join as join11, posix as posix2 } from "node:path";

// kit/lib/knowledge/registers.ts
import { existsSync as existsSync8, readFileSync as readFileSync8, readdirSync as readdirSync4 } from "node:fs";
import { basename, join as join12 } from "node:path";
var PRODUCT_CODE = "PRODUCT";
var LAYER_FILES = {
  "principles.md": "principle",
  "rules.md": "rule",
  "invariants.md": "invariant",
  "contracts.md": "contract"
};
var OPTIONAL_LAYER_FILES = ["contracts.md"];
var REQUIRED_LAYER_FILES = Object.keys(LAYER_FILES).filter((name) => !OPTIONAL_LAYER_FILES.includes(name));
var ENTRY_ID_SOURCE = "X-[A-Z0-9]+-[A-Z0-9]+-\\d+|DC-[A-Z0-9]+-\\d+|BR-[A-Z0-9]+-\\d+|P-[A-Z0-9]+-\\d+|N-[A-Z0-9]+-\\d+|N\\d+";
var LEGAL_ID_SOURCE = "L-[A-Z0-9]+-\\d+";
var ID_SOURCE = `${ENTRY_ID_SOURCE}|${LEGAL_ID_SOURCE}`;
var LEGAL_ID_SHAPE = new RegExp(`^${LEGAL_ID_SOURCE}$`);
var ID_SHAPE = new RegExp(`^(?:${ID_SOURCE})$`);
var ID_TOKEN = new RegExp(`\\b(?:${ID_SOURCE})\\b`, "g");
var ENTRY_HEADING = new RegExp(`^##\\s+(${ENTRY_ID_SOURCE})\\s*$`);
var ANY_H2 = /^##\s/;
var FIELD_LINE = /^(Why|Decided|Merged|Source|Serves|Enforced by|Stated|Proposed law|Proposed|Locked|Governs|Layers|Points to|Kind|Kept id|Glossary term):\s*(.*)$/;
var FIELD_KEY = {
  Why: "why",
  Decided: "decided",
  Merged: "merged",
  Source: "source",
  Serves: "serves",
  "Enforced by": "enforcedBy",
  Stated: "stated",
  Proposed: "proposedLine",
  "Proposed law": "proposedLaw",
  Locked: "lockedLine",
  Governs: "governsLine",
  Layers: "layersLine",
  "Points to": "pointsToLine",
  Kind: "kindLine",
  "Kept id": "keptId",
  "Glossary term": "glossaryTerm"
};
var FIELD_NAMES = keysOf(FIELD_KEY);
function codeOf(name) {
  return name.replace(/-/g, "").toUpperCase();
}
function readFields(lines) {
  const fields = {};
  const counts = {};
  let fieldAt = -1;
  let open = null;
  lines.forEach((line, index) => {
    const match = line.match(FIELD_LINE);
    if (match) {
      if (fieldAt === -1) fieldAt = index;
      const name = group(match, 1);
      if (!isOneOf(FIELD_NAMES, name)) return;
      const key = FIELD_KEY[name];
      counts[key] = (counts[key] ?? 0) + 1;
      if (counts[key] === 1) {
        fields[key] = (match[2] ?? "").trim();
        open = key;
      } else {
        open = null;
      }
      return;
    }
    if (line.trim() === "") {
      open = null;
      return;
    }
    if (open) fields[open] = `${fields[open]} ${line.trim()}`.trim();
  });
  return { fields, counts, fieldAt };
}
var PROPOSED_VALUE = /^(\S.*?)\s+(\d{4}-\d{2}-\d{2})$/;
function readProposed(file, id, value) {
  if (value === void 0) return { proposed: null, problems: [] };
  const match = value.match(PROPOSED_VALUE);
  const [, by = "", on = ""] = match ?? [];
  if (match && !/\d{4}-\d{2}-\d{2}$/.test(by)) {
    return { proposed: { by, on }, problems: [] };
  }
  return {
    proposed: { by: null, on: null },
    problems: [`${file}: ${id} \u2014 "Proposed: ${value}" is not "Proposed: <who> <YYYY-MM-DD>".`]
  };
}
var LOCKED_VALUE = /^@([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9_.-]+)?),\s*(\d{4}-\d{2}-\d{2})$/;
function readLocked(file, id, value) {
  if (value === void 0) return { locked: null, problems: [] };
  const match = value.match(LOCKED_VALUE);
  if (match) return { locked: { by: group(match, 1), on: group(match, 2) }, problems: [] };
  const line = value === "" ? "Locked:" : `Locked: ${value}`;
  return {
    locked: { by: null, on: null },
    problems: [`${file}: ${id} \u2014 "${line}" is not "Locked: @<login>, <YYYY-MM-DD>".`]
  };
}
function readGoverns(file, id, value) {
  if (value === void 0) return { governs: null, problems: [] };
  const governs = value.split(",").map((part) => part.replace(/`/g, "").trim()).filter(Boolean);
  if (governs.length > 0) return { governs, problems: [] };
  return {
    governs,
    problems: [`${file}: ${id} \u2014 "Governs:" names no path \u2014 list the paths it rules over, comma-separated.`]
  };
}
function readLayers(file, id, value) {
  if (value === void 0) return { layers: null, problems: [] };
  const layers = value.split(",").map((part) => part.replace(/`/g, "").trim()).filter(Boolean);
  if (layers.length > 0) return { layers, problems: [] };
  return { layers, problems: [`${file}: ${id} \u2014 "Layers:" names no layer \u2014 list them comma-separated, such as "Layers: db, auth".`] };
}
function readPointsTo(value) {
  if (value === void 0) return null;
  return value.split(",").map((part) => part.replace(/`/g, "").trim()).filter(Boolean);
}
function readProposedLaw(file, id, value) {
  if (value === void 0) return { proposedLaw: null, problems: [] };
  if (value !== "") return { proposedLaw: value, problems: [] };
  return {
    proposedLaw: value,
    problems: [`${file}: ${id} \u2014 "Proposed law:" says nothing \u2014 write one plain sentence: what breaks, and who gets hurt.`]
  };
}
var PENDING_VALUE = /^pending #([1-9]\d*)$/;
var PENDING_INTENT = /^pending(?![\w./-])/i;
function meansPending(value) {
  return PENDING_INTENT.test(value);
}
function readPending(file, id, value) {
  if (value === null || !meansPending(value)) return { pending: null, problems: [] };
  const match = value.match(PENDING_VALUE);
  if (match) return { pending: parseIssue(group(match, 1)), problems: [] };
  return {
    pending: null,
    problems: [`${file}: ${id} \u2014 "Enforced by: ${value}" is not "Enforced by: pending #<n>", its law issue's number.`]
  };
}
function splitEntries(text5) {
  const entries = [];
  let current = null;
  for (const line of text5.split("\n")) {
    const match = line.match(ENTRY_HEADING);
    if (match) {
      if (current) entries.push(current);
      current = { id: match[1] ?? "", lines: [] };
    } else if (ANY_H2.test(line)) {
      if (current) entries.push(current);
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) entries.push(current);
  return entries;
}
function parseEntryFile(file, text5, place) {
  return splitEntries(text5).map(({ id, lines }) => {
    const { fields, counts, fieldAt } = readFields(lines);
    const statement2 = (fieldAt === -1 ? lines : lines.slice(0, fieldAt)).filter((line) => line.trim().length > 0).join(" ").trim();
    const kind = place.kind ?? (fields.kindLine === "rule" || fields.kindLine === "invariant" ? fields.kindLine : null);
    const enforcedBy2 = fields.enforcedBy ?? null;
    const { proposed, problems: proposedProblems } = readProposed(file, id, fields.proposedLine);
    const { pending, problems: pendingProblems } = readPending(file, id, enforcedBy2);
    const { locked, problems: lockedProblems } = readLocked(file, id, fields.lockedLine);
    const { governs, problems: governsProblems } = readGoverns(file, id, fields.governsLine);
    const { layers, problems: layersProblems } = readLayers(file, id, fields.layersLine);
    const { proposedLaw, problems: proposedLawProblems } = readProposedLaw(file, id, fields.proposedLaw);
    return {
      id,
      kind,
      scope: place.scope,
      domain: place.domain,
      codes: place.codes,
      file,
      statement: statement2,
      why: fields.why ?? null,
      decided: fields.decided ?? null,
      merged: fields.merged ?? null,
      source: fields.source ?? null,
      serves: fields.serves ?? null,
      enforcedBy: enforcedBy2,
      enforced: enforcedBy2 !== null && enforcedBy2 !== "unenforced" && !meansPending(enforcedBy2),
      pending,
      stated: fields.stated ?? null,
      proposed,
      locked,
      governs,
      layers,
      proposedLaw,
      pointsTo: readPointsTo(fields.pointsToLine),
      kindLine: fields.kindLine ?? null,
      keptId: fields.keptId ?? null,
      fieldCounts: counts,
      problems: [...proposedProblems, ...pendingProblems, ...lockedProblems, ...governsProblems, ...layersProblems, ...proposedLawProblems]
    };
  });
}
function listDir(root, dir, predicate) {
  const abs = join12(root, dir);
  if (!existsSync8(abs)) return [];
  return readdirSync4(abs, { withFileTypes: true }).filter(predicate).map((entry) => entry.name).sort();
}
function diskSource(root) {
  return {
    files: (dir) => listDir(root, dir, (entry) => entry.isFile()),
    dirs: (dir) => listDir(root, dir, (entry) => entry.isDirectory()),
    read: (file) => readFileSync8(join12(root, file), "utf8")
  };
}
function glossaryTermOf(text5) {
  return readFields(text5.split("\n")).fields.glossaryTerm ?? null;
}
function productDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/product`;
}
function domainsDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/domains`;
}
function crossDomainDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/cross-domain`;
}
function readKnowledge({ ctx, source = diskSource(ctx.root) }) {
  const entries = [];
  const PRODUCT_DIR = productDir(ctx);
  const DOMAINS_DIR = domainsDir(ctx);
  const CROSS_DOMAIN_DIR = crossDomainDir(ctx);
  const productFiles = source.files(PRODUCT_DIR);
  for (const [name, kind] of Object.entries(LAYER_FILES)) {
    if (!productFiles.includes(name)) continue;
    const file = `${PRODUCT_DIR}/${name}`;
    entries.push(
      ...parseEntryFile(file, source.read(file), {
        scope: "product",
        domain: "product",
        codes: [PRODUCT_CODE],
        kind
      })
    );
  }
  const domains = source.dirs(DOMAINS_DIR).map((name) => {
    const dir = `${DOMAINS_DIR}/${name}`;
    const files = source.files(dir);
    const code = codeOf(name);
    for (const [layer, kind] of Object.entries(LAYER_FILES)) {
      if (!files.includes(layer)) continue;
      const file = `${dir}/${layer}`;
      entries.push(
        ...parseEntryFile(file, source.read(file), {
          scope: "domain",
          domain: name,
          codes: [code],
          kind
        })
      );
    }
    const glossaryTerm = files.includes("README.md") ? glossaryTermOf(source.read(`${dir}/README.md`)) : null;
    return { name, code, files, glossaryTerm };
  });
  const crossDomainNames = source.files(CROSS_DOMAIN_DIR).filter((name) => name.endsWith(".md"));
  const crossDomainFiles = crossDomainNames.map((fileName) => {
    const name = basename(fileName, ".md");
    const halves = name.split("--");
    const pair = halves.length === 2 && halves.every(Boolean) ? halves : null;
    const file = `${CROSS_DOMAIN_DIR}/${fileName}`;
    entries.push(
      ...parseEntryFile(file, source.read(file), {
        scope: "cross-domain",
        domain: name,
        codes: pair ? pair.map(codeOf) : [],
        kind: null
      })
    );
    return { file, name, pair };
  });
  return { entries, domains, crossDomainFiles, productFiles };
}
function readRegisters({ ctx }) {
  const { entries } = readKnowledge({ ctx });
  return {
    entries,
    principles: entries.filter((entry) => entry.kind === "principle"),
    rules: entries.filter((entry) => entry.kind === "rule"),
    invariants: entries.filter((entry) => entry.kind === "invariant"),
    contracts: entries.filter((entry) => entry.kind === "contract")
  };
}

// kit/lib/outbox/decision-coverage.ts
var TEST_OR_FEATURE_PATH = /\.test\.[^/]+$|\.feature$/;
function escapeRegExp(source) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isStoredShape(change, { ctx }) {
  return ctx.config.risk.storedShape.some((source) => new RegExp(source).test(change.path));
}
function enforcedByPaths({ ctx }) {
  return new Set(readRegisters({ ctx }).entries.flatMap(proofPathsOf));
}
function proofPathsOf(entry) {
  if (!entry.enforced) return [];
  return String(entry.enforcedBy).split(",").map((rawPath) => rawPath.replace(/`/g, "").trim()).filter(Boolean);
}
function isLawProof(change, { ctx }) {
  if (ctx.config.laws.source !== "knowledge") return false;
  return enforcedByPaths({ ctx }).has(change.path);
}
function isLawText(change, { ctx }) {
  const knowledgeRoot = escapeRegExp(ctx.layout.knowledgeRoot);
  const adrDir = escapeRegExp(ctx.layout.adrDir);
  const pattern = new RegExp(
    `^${knowledgeRoot}/(?:product|domains/[^/]+)/(?:principles|rules|invariants|contracts)\\.md$|^${knowledgeRoot}/cross-domain/[^/]+\\.md$|^${adrDir}/(?!README\\.md$)[^/]+\\.md$`
  );
  return pattern.test(change.path);
}
function isTestRemoved(change) {
  return change.status === "D" && TEST_OR_FEATURE_PATH.test(change.path);
}
function isSharedContract(change, { ctx }) {
  return ctx.config.risk.sharedContract.some((prefix) => change.path.startsWith(prefix));
}
var RULES = [
  { id: "stored-shape", matches: isStoredShape },
  { id: "law-proof", matches: isLawProof },
  { id: "law-text", matches: isLawText },
  { id: "test-removed", matches: isTestRemoved },
  { id: "shared-contract", matches: isSharedContract }
];
var LAW_DEMOTED = "law-demoted";
var BRIEFING_TEXT = "briefing-text";
var RULE_IDS = [...RULES.map((rule) => rule.id), BRIEFING_TEXT, LAW_DEMOTED];

// kit/lib/releases/check-releases.ts
import { existsSync as existsSync11, readFileSync as readFileSync9 } from "node:fs";
import { join as join13 } from "node:path";

// kit/lib/releases/note.ts
import { dirname as dirname3 } from "node:path";
var KIT_FOLDER = `${dirname3(CONFIG_FILE)}/`;
var FORBIDDEN = [
  { pattern: /https?:\/\/|www\./i, what: (match) => `a URL ("${match}")` },
  { pattern: /#\d+/, what: (match) => `a reference ("${match}")` },
  { pattern: /`/, what: () => "a backtick" },
  { pattern: new RegExp(KIT_FOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), what: () => `a path under ${KIT_FOLDER}` }
];

// kit/lib/outbox/check-outbox.ts
import { existsSync as existsSync14 } from "node:fs";
import { join as join16 } from "node:path";

// kit/lib/laws.ts
import { existsSync as existsSync13, readdirSync as readdirSync6, readFileSync as readFileSync11 } from "node:fs";
import { join as join15 } from "node:path";

// kit/lib/outbox/settle-merge.ts
import { existsSync as existsSync15 } from "node:fs";
import { join as join17 } from "node:path";
import { z as z17 } from "zod";
var PrField = z17.coerce.number({ message: "merge.pr must be a number" }).int().positive().pipe(PrNumberSchema);
var MergeSchema = z17.object({
  by: z17.string().trim().transform((login) => login.replace(/^@/, "")).pipe(z17.string().min(1, "merge.by is required \u2014 who merged")),
  at: z17.string().regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/,
    "merge.at must be an ISO date or date-time"
  ),
  pr: PrField,
  url: z17.string().trim().min(1).optional()
}).strict();

// kit/lib/knowledge/check-knowledge.ts
import { existsSync as existsSync21, readFileSync as readFileSync16, statSync as statSync5 } from "node:fs";
import { join as join23 } from "node:path";

// kit/lib/playbook/decisions.ts
import { existsSync as existsSync18, readdirSync as readdirSync8, readFileSync as readFileSync13 } from "node:fs";
import { join as join20 } from "node:path";

// kit/lib/knowledge-tree/levels.ts
import { existsSync as existsSync17, statSync as statSync4 } from "node:fs";
import { join as join19 } from "node:path";

// kit/lib/ask/local-state.ts
import { existsSync as existsSync16, mkdirSync as mkdirSync4, readdirSync as readdirSync7, readFileSync as readFileSync12, rmSync as rmSync4, statSync as statSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { dirname as dirname5, join as join18, resolve } from "node:path";

// kit/lib/ask/schema.ts
import { z as z18 } from "zod";
var text3 = z18.string().min(1);
var JsonObjectSchema = z18.record(z18.string(), z18.unknown());
var ModeFileSchema = z18.object({
  host: text3,
  sessionId: text3.nullable().catch(null)
});
var TerminalFileSchema = z18.object({ sessionId: text3, host: text3 });
var ROUND_STATUSES = ["open", "answered", "abandoned"];
var RoundFileSchema = z18.object({
  roundId: text3,
  status: z18.enum(ROUND_STATUSES).catch("open")
});
var HeartbeatWindowSchema = z18.object({ sentAt: z18.number() });
var TokensSchema = z18.looseObject({ access_token: text3 });
var TokenReplySchema = z18.object({ access_token: text3, refresh_token: text3 });
var QuestionOptionSchema = z18.strictObject({ label: text3, description: z18.string() });
var QuestionSchema = z18.strictObject({
  question: text3,
  header: z18.string(),
  options: z18.array(QuestionOptionSchema),
  multiSelect: z18.boolean()
});
var QuestionContextSchema = z18.strictObject({
  skill: z18.string().nullable().optional(),
  model: z18.string().nullable().optional()
});
var QuestionFileSchema = z18.strictObject({
  questions: z18.array(QuestionSchema).min(1),
  lead: z18.string().optional(),
  context: QuestionContextSchema.optional()
});

// kit/lib/ask/local-state.ts
var LOCAL_DIR = join18(dirname5(CONFIG_FILE), "local");
var TERMINALS_DIR = "ask";
var ROUNDS_DIR = join18(TERMINALS_DIR, "rounds");
var SHOTS = "shots";
var SHOTS_DIR = join18(TERMINALS_DIR, SHOTS);
var SHOTS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1e3;

// kit/lib/knowledge-tree/levels.ts
var LEVELS = Object.freeze(["repo", "plan repo", "omni settings", "kit default"]);
var TREE_DIR = `${LOCAL_DIR}/tree`;
var COPY_FOLDERS = Object.freeze({
  "plan repo": `${TREE_DIR}/plan-repo`,
  "omni settings": `${TREE_DIR}/omni-settings`
});

// kit/lib/knowledge/thesis.ts
import { existsSync as existsSync19, readFileSync as readFileSync14 } from "node:fs";
import { join as join21 } from "node:path";

// kit/lib/codeowners-laws.ts
import { existsSync as existsSync20, mkdirSync as mkdirSync5, readFileSync as readFileSync15, writeFileSync as writeFileSync5 } from "node:fs";
import { dirname as dirname6, join as join22 } from "node:path";

// kit/lib/knowledge-tree/product.ts
var PRODUCT_LEVELS = Object.freeze(["omni settings", "plan repo", "repo"]);

// kit/lib/knowledge/classify.ts
import { existsSync as existsSync22, readFileSync as readFileSync17 } from "node:fs";
import { join as join24 } from "node:path";
import { z as z19 } from "zod";
var CLASSIFICATION_KINDS = ["adr", "invariant", "rule", "covered", "stays-here"];
var PRODUCT_PLACE = PRODUCT_CODE.toLowerCase();
var NEW_PRINCIPLE = "new";
var CAPS = Object.freeze({ statement: 300, principle: 300, reason: 200 });
function capped(field, max) {
  return z19.string({ error: (issue) => issue.input === void 0 ? `${field} is required` : `${field} must be text` }).trim().min(1, `${field} is required`).max(max, `${field} is over its cap of ${max} characters`);
}
var text4 = (field) => z19.string({ error: (issue) => issue.input === void 0 ? `${field} is required` : `${field} must be text` }).trim().min(1, `${field} is required`);
var statement = capped("statement", CAPS.statement);
var reason = capped("reason", CAPS.reason);
var MAX_ENFORCED_BY = 3;
var enforcedBy = z19.array(text4("enforcedBy path"), { error: "enforcedBy must be a list of paths" }).min(1, "enforcedBy names at least one path, or is left out").max(MAX_ENFORCED_BY, `enforcedBy names at most ${MAX_ENFORCED_BY} paths`).optional();
var worthALaw = z19.boolean({ error: "worthALaw must be true or false" }).optional();
var ClassificationSchema = z19.discriminatedUnion(
  "kind",
  [
    z19.object({
      kind: z19.literal("adr"),
      title: text4("title").refine((value) => !value.includes("\n"), "title must be one line"),
      statement,
      reason
    }).strict(),
    z19.object({ kind: z19.literal("invariant"), place: text4("place"), statement, enforcedBy, worthALaw, reason }).strict(),
    z19.object({
      kind: z19.literal("rule"),
      place: text4("place"),
      statement,
      serves: text4("serves"),
      principle: z19.object({ statement: capped("principle.statement", CAPS.principle), why: capped("principle.why", CAPS.principle) }).strict().optional(),
      enforcedBy,
      worthALaw,
      reason
    }).strict(),
    z19.object({ kind: z19.literal("covered"), covers: text4("covers"), reason }).strict(),
    z19.object({ kind: z19.literal("stays-here"), statement, reason }).strict()
  ],
  { error: () => `kind must be one of: ${CLASSIFICATION_KINDS.join(", ")}` }
).superRefine((reply, context) => {
  if (reply.kind !== "rule") return;
  if (reply.serves === NEW_PRINCIPLE && !reply.principle) {
    context.addIssue({ code: "custom", path: ["principle"], message: `serves "${NEW_PRINCIPLE}" needs the principle it proposes` });
  }
  if (reply.serves !== NEW_PRINCIPLE && reply.principle) {
    context.addIssue({ code: "custom", path: ["principle"], message: `a principle is proposed only with serves "${NEW_PRINCIPLE}"` });
  }
});

// kit/lib/knowledge/harvest.ts
import { existsSync as existsSync23, readFileSync as readFileSync18 } from "node:fs";
import { join as join25 } from "node:path";

// kit/lib/knowledge/write.ts
import { existsSync as existsSync24, mkdirSync as mkdirSync6, readFileSync as readFileSync19, writeFileSync as writeFileSync6 } from "node:fs";
import { dirname as dirname7, join as join26 } from "node:path";
var KEPT_STATUSES = Object.freeze(["added", "modified", "renamed"]);

// kit/lib/knowledge/pipeline.ts
var PullFilesSchema = z20.array(z20.looseObject({ filename: z20.string().min(1), status: z20.string() })).transform((files) => files.map((file) => ({ path: file.filename, status: file.status })));
var PROMOTIONS = Object.freeze(["adr", "rule", "invariant"]);

// apps/omni-app/src/retro/qualify.ts
import { mkdtempSync as mkdtempSync6, rmSync as rmSync7 } from "node:fs";
import { tmpdir as tmpdir6 } from "node:os";
import { join as join38 } from "node:path";

// apps/omni-app/src/outbox-check/github.ts
import { mkdtempSync as mkdtempSync5, readFileSync as readFileSync27, rmSync as rmSync6 } from "node:fs";
import { tmpdir as tmpdir5 } from "node:os";
import { join as join37 } from "node:path";

// apps/omni-app/src/evaluate/evaluate.ts
import { existsSync as existsSync32, readdirSync as readdirSync13, readFileSync as readFileSync26 } from "node:fs";
import { join as join36 } from "node:path";

// kit/lib/bug/verdict.ts
import { readFileSync as readFileSync21, statSync as statSync7 } from "node:fs";
import { isAbsolute as isAbsolute2, join as join29, normalize } from "node:path";

// kit/lib/fix-verdict.ts
import { existsSync as existsSync26, readdirSync as readdirSync10 } from "node:fs";
import { join as join28 } from "node:path";

// kit/lib/outbox/comment.ts
import { existsSync as existsSync27, readFileSync as readFileSync22, writeFileSync as writeFileSync8 } from "node:fs";
import { z as z21 } from "zod";

// kit/lib/outbox/banter.ts
var INTROS = Object.freeze([
  "Here is a small question with surprisingly strong opinions.",
  "This one looked simple right up until it did not.",
  "The spec went quiet here, which is rare and a little suspicious.",
  "A question walks into a pull request and politely asks for a minute.",
  "Two sensible ideas met in this change, and only one could stay.",
  "Not every decision is dramatic, but this one did try its best.",
  "This question has been rehearsing its big moment all week.",
  "The kind of question that sounds easy until it is asked out loud.",
  "Found in the margin of the spec, next to a very small question mark.",
  "The build kept going and left this question behind like a bookmark.",
  "Nothing is on fire; this is simply a question with good manners.",
  "One more choice, gift-wrapped and labelled with care.",
  "Fresh from the workshop, and still warm from the build.",
  "Some questions knock politely, and this is one of them.",
  "This decision was made in pencil, on purpose.",
  "Behind every tidy change sits a judgement call, and here it is.",
  "A crossroads so small it barely needed a sign, so here is the sign.",
  "Every plan has a gap somewhere, and this one found a very tidy gap.",
  "Plot twist: the easy part had a question hiding in it.",
  "Here is a question that deserves better than a shrug.",
  "A decision was made, and it would like to be introduced properly.",
  "Somewhere between two good ideas, a choice had to be made.",
  "Presenting a question that kept its promise to stay short.",
  "The agent paused here, picked a path, and left a note on the door.",
  "Every piece of work leaves one crumb of doubt, and this is the crumb.",
  "A fork in the road, freshly swept and ready for visitors.",
  "This question was found hiding behind a perfectly reasonable assumption.",
  "Today's small mystery comes with a clue and a best guess."
]);
var PUNCHLINES = Object.freeze([
  "Nothing here is carved in stone, only lightly pencilled.",
  "The good news is that every pencil comes with an eraser.",
  "No wrong answers here, only reversible ones.",
  "Changing course later costs a little, not a lot.",
  "The agent has a hunch, and hunches love a second opinion.",
  "Quick to read, and oddly satisfying to settle.",
  "It sounds bigger than it is, like most things before lunch.",
  "The work did not wait, but it did leave a light on.",
  "Every settled question makes the next build a little calmer.",
  "Settling it takes a minute, and the minute is well spent.",
  "It is easier to answer than it was to ask.",
  "Answers of every size are welcome here.",
  "Nothing breaks while it waits; it just waits a little hopefully.",
  "A calm answer now saves a long thread later.",
  "One small answer, many quieter tomorrows.",
  "Nothing dramatic, just a small signpost waiting for its arrow.",
  "Sometimes the sensible choice and the fun choice are the same one.",
  "It is only a question, but it has been very well behaved.",
  "The code carries on meanwhile; it just likes to be sure.",
  "Half the fun of a question is watching it turn into a decision.",
  "Best of all, the answer fits on one line.",
  "The worst case is a small rework, and small reworks are friendly.",
  "Clarity is cheap today and pricey next month.",
  "The question is short, and the peace of mind lasts much longer.",
  "Somewhere, a future bug just got a little nervous.",
  "Every question answered is one less surprise at release time.",
  "A good question ages like milk, so this one is served fresh.",
  "Small print, big relief once it is settled."
]);
var BANTER_POOL = Object.freeze({ intros: INTROS, punchlines: PUNCHLINES });

// kit/lib/git.ts
import { execFileSync as execFileSync4 } from "node:child_process";

// kit/lib/outbox/comment.ts
var PrCommentResultSchema = z21.object({
  htmlUrl: z21.string().nullish(),
  newAdoptedCount: z21.number().optional()
}).loose();

// kit/lib/visual/verdict.ts
import { existsSync as existsSync31, readdirSync as readdirSync12, readFileSync as readFileSync25 } from "node:fs";
import { join as join35 } from "node:path";

// kit/lib/inbox/check-inbox.ts
import { existsSync as existsSync30, readdirSync as readdirSync11, statSync as statSync8 } from "node:fs";
import { basename as basename5, dirname as dirname10, join as join34 } from "node:path";

// kit/lib/design/words/product.ts
import { readFileSync as readFileSync24 } from "node:fs";
import { join as join31 } from "node:path";
import { z as z23 } from "zod";

// kit/lib/product/knowledge.ts
import { readFileSync as readFileSync23, writeFileSync as writeFileSync9 } from "node:fs";
import { join as join30 } from "node:path";
import { z as z22 } from "zod";
var PRODUCT_KNOWLEDGE_FILE = join30(LOCAL_DIR, "product-knowledge.json");
var LegalSchema = z22.object({ id: z22.string().min(1), statement: z22.string(), source: z22.string(), owner: z22.string() });
var TermSchema = z22.object({ term: z22.string().min(1), meaning: z22.string(), avoid: z22.array(z22.string()) }).extend({ domains: z22.array(z22.string()).optional() });
var DomainSchema = z22.object({ key: z22.string().min(1), name: z22.string(), meaning: z22.string() });
var PersonaSchema = z22.object({ name: z22.string().min(1), stance: z22.string() });
var ReplySchema = z22.object({
  state: z22.string().optional(),
  product: z22.object({ name: z22.string().min(1) }).nullable().optional(),
  legal: z22.array(LegalSchema).optional(),
  glossary: z22.array(TermSchema).optional(),
  // Only the name and stance are kept; a persona the page sends out of shape is left out, never a refusal.
  personas: z22.array(z22.unknown()).optional(),
  // Like a persona, a domain out of shape is left out, never a refusal.
  domains: z22.array(z22.unknown()).optional(),
  // The law home (PRD 2632): a reply out of shape here reads as none, never a refusal.
  lawHome: z22.unknown().optional()
});
var CopySchema = z22.object({
  product: z22.string(),
  readAt: z22.iso.datetime(),
  legal: z22.array(LegalSchema),
  glossary: z22.array(TermSchema),
  // A copy from before PRD 2299 has none: it still reads, with no persona.
  personas: z22.array(PersonaSchema).default([]),
  // A copy from before PRD 2583 has none: it still reads, with no domains.
  domains: z22.array(DomainSchema).optional(),
  // A copy from before PRD 2632 has none: it reads as no law home.
  lawHome: z22.string().nullable().optional()
});

// kit/lib/design/words/product.ts
var CopySchema2 = z23.object({ glossary: z23.array(z23.object({ term: z23.string().min(1), avoid: z23.array(z23.string()) })) });

// kit/lib/before-after/grade.ts
var SECTION_STATES = ["filled", "na", "gap"];
var STATES = new Set(SECTION_STATES);

// kit/lib/roadmap/index.ts
import { existsSync as existsSync29 } from "node:fs";
import { join as join33 } from "node:path";

// kit/lib/inbox/inbox.ts
import { existsSync as existsSync28 } from "node:fs";
import { basename as basename4, dirname as dirname9, join as join32 } from "node:path";

// kit/lib/roadmap/parse.ts
import { z as z24 } from "zod";
var optionalText = z24.string().trim().min(1).optional();
var ProductFrontMatterSchema = z24.object({
  roadmap: z24.string().optional(),
  title: z24.string().trim().min(1),
  milestone: z24.string().trim().min(1),
  product: optionalText,
  target: z24.string().regex(/^\d{4}-\d{2}-\d{2}$/, "a YYYY-MM-DD date").optional(),
  source: optionalText
}).strict();
var FrontMatterSchema2 = z24.object({
  roadmap: z24.string().regex(/^[1-9]\d*$/, "the roadmap issue's number").transform(Number).pipe(IssueNumberSchema),
  title: z24.string().trim().min(1),
  milestone: z24.string().trim().min(1),
  product: optionalText,
  target: z24.string().regex(/^\d{4}-\d{2}-\d{2}$/, "a YYYY-MM-DD date").optional(),
  source: optionalText
}).strict();

// kit/lib/voice/voice.ts
import { z as z25 } from "zod";
var STANCES = ["excited", "neutral", "skeptical"];
var SETTLED = ["accepted", "saved-as-claim", "just-this-run", "none"];
var VoicePersonaSchema = z25.looseObject({
  name: z25.string(),
  stance: z25.enum(STANCES),
  score: z25.number(),
  reaction: z25.string(),
  citations: z25.array(z25.string())
});
var VoiceObjectionSchema = z25.looseObject({ persona: z25.string(), text: z25.string(), citations: z25.array(z25.string()), settled: z25.enum(SETTLED) });
var VoiceRoundSchema = z25.object({
  stage: z25.string(),
  date: z25.string(),
  personas: z25.array(VoicePersonaSchema),
  objection: VoiceObjectionSchema.nullish(),
  fit: z25.string().nullish()
});
var VoiceSchema = z25.object({ rounds: z25.array(VoiceRoundSchema) });

// apps/omni-app/src/evaluate/evaluate.ts
var LAWS_PR = Object.freeze({ knowledge: "Knowledge PR", law: "Enforce PR" });

// apps/omni-app/src/approved-check/state.ts
import { basename as basename6 } from "node:path";
var SEQ_MAX = 2 ** 31 - 1;

// apps/omni-app/src/publish/publish.ts
var DEFAULT_CHECK_NAME = ConfigSchema.parse({ kit: 1 }).ci.outboxContext;

// apps/omni-app/src/outbox-check/github.ts
var STATUS = Object.freeze({
  added: "A",
  removed: "D",
  modified: "M",
  changed: "M",
  renamed: "R",
  copied: "C"
});

// apps/omni-app/src/knowledge-harvest/schema.ts
import { z as z26 } from "zod";
var HarvestEventSchema = z26.looseObject({
  installationId: z26.number(),
  owner: z26.string(),
  repo: z26.string(),
  prNumber: PrNumberSchema
});
var FailedHarvestEventSchema = HarvestEventSchema.partial();
var PullMergeSchema = z26.looseObject({
  merged: z26.boolean().nullish(),
  merged_at: z26.string().nullish(),
  merged_by: z26.looseObject({ login: z26.string().nullish() }).nullish(),
  merge_commit_sha: z26.string().nullish(),
  html_url: z26.string().nullish()
});
var RefSchema3 = z26.looseObject({ object: z26.looseObject({ sha: z26.string() }) });
var OpenPullSchema = z26.looseObject({ head: z26.looseObject({ ref: z26.string().nullish() }).nullish() });
var CommitSchema = z26.looseObject({ message: z26.string().nullish() });
function parsedOr(schema, value, context) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  const field = issue && issue.path.length > 0 ? issue.path.join(".") : "(answer)";
  throw new Error(`${context}: ${field}: ${issue?.message ?? parsed.error.message}`);
}
var MergeSchema2 = z26.object({ by: z26.string(), at: z26.string(), pr: PrNumberSchema, url: z26.string().exactOptional() });
var QualifiedSchema = z26.union([
  z26.object({ skip: z26.string() }),
  z26.object({
    skip: z26.null(),
    config: ConfigSchema,
    prd: z26.object({ number: PrdNumberSchema, topic: z26.string(), title: z26.string() }),
    merge: MergeSchema2
  })
]);
var MoveSchema = z26.object({ from: z26.string(), to: z26.string() });
var EditsSchema = z26.object({
  deletes: z26.array(z26.string()),
  moves: z26.array(MoveSchema),
  writes: z26.array(z26.object({ path: z26.string(), text: z26.string() }))
});
var ItemSectionsSchema = z26.object({
  questionPlain: z26.string().nullable().exactOptional(),
  decisionPlain: z26.string().nullable().exactOptional(),
  options: z26.array(z26.object({ letter: z26.string(), text: z26.string() })).nullable().exactOptional(),
  personSteps: z26.string().nullable().exactOptional(),
  whatIHadToDecide: z26.string().nullable().exactOptional(),
  whatIDidMeanwhile: z26.string().nullable().exactOptional(),
  whatItCostsToChangeLater: z26.string().nullable().exactOptional()
});
var CandidateSchema = z26.object({
  id: z26.string(),
  verdict: z26.string().nullable(),
  answer: z26.string(),
  itemText: z26.string(),
  item: z26.object({ sections: ItemSectionsSchema.nullable().exactOptional() }).nullable()
});
var SummarySchema = z26.object({
  places: z26.object({ adr: z26.boolean(), knowledge: z26.boolean() }),
  domains: z26.array(z26.object({ name: z26.string(), firstLine: z26.string().nullable() })),
  principles: z26.array(z26.object({ id: z26.string(), place: z26.string(), statement: z26.string() })),
  decisions: z26.array(z26.object({ number: z26.string(), title: z26.string().nullable() })),
  laws: z26.array(
    z26.object({ id: z26.string(), kind: z26.enum(["principle", "rule", "invariant"]).nullable(), place: z26.string(), statement: z26.string() })
  )
});
var SettledSchema = z26.object({
  tip: z26.string(),
  prepared: z26.object({
    ok: z26.literal(true),
    prd: PrdNumberSchema,
    edits: EditsSchema,
    settled: z26.array(z26.object({ id: z26.string(), from: z26.enum(["open", "drift"]) })),
    shipped: z26.array(MoveSchema),
    candidates: z26.array(CandidateSchema),
    summary: SummarySchema,
    changed: z26.array(z26.object({ path: z26.string(), status: z26.string() }))
  })
});
var ClassificationOutSchema = z26.object({
  id: z26.string(),
  reply: ClassificationSchema.nullable(),
  reason: z26.string().nullable(),
  error: z26.string().nullable()
});
var PlacedSchema = z26.object({
  id: z26.string(),
  kind: z26.enum(["adr", "invariant", "rule", "covered", "stays-here"]),
  landedAs: z26.array(z26.string()),
  files: z26.array(z26.string()),
  ledgerFile: z26.string(),
  ledgerLine: z26.string(),
  decided: z26.string(),
  status: z26.string().nullable(),
  proposed: z26.boolean(),
  reason: z26.string(),
  enforcedBy: z26.array(z26.string()).exactOptional(),
  dropped: z26.array(z26.object({ path: z26.string(), reason: z26.string() })).exactOptional(),
  law: z26.object({ worth: z26.boolean(), decidedBy: z26.string(), confidence: z26.number().nullable(), issue: IssueNumberSchema.nullable() }).exactOptional()
});
var LawIssueSchema = z26.object({
  id: z26.string(),
  entry: z26.string(),
  register: z26.string(),
  statement: z26.string(),
  source: z26.string(),
  title: z26.string(),
  body: z26.string()
});
var WrittenSchema = z26.object({
  edits: EditsSchema,
  placed: z26.array(PlacedSchema),
  notPlaced: z26.array(z26.object({ id: z26.string(), reason: z26.string() })),
  checks: z26.object({ knowledge: z26.array(z26.string()), outbox: z26.array(z26.string()) }),
  commit: z26.object({
    files: z26.array(z26.object({ path: z26.string(), content: z26.string() })),
    moves: z26.array(MoveSchema),
    deletes: z26.array(z26.string())
  }),
  taken: z26.array(z26.string()),
  lawIssues: z26.array(LawIssueSchema)
});
var LawWorthStateSchema = z26.object({
  statement: z26.string(),
  why: z26.string().nullable(),
  principle: z26.string().nullable(),
  domain: z26.string().nullable(),
  prdTitle: z26.string().nullable()
});
var LawQuestionsSchema = z26.array(z26.object({ id: z26.string(), state: LawWorthStateSchema, old: z26.boolean() }));
var LawJudgementSchema = z26.object({
  worth: z26.object({ worth: z26.boolean(), decidedBy: z26.string(), confidence: z26.number().nullable() }).nullable(),
  reason: z26.string().nullable()
});
var LawIssueOpenedSchema = z26.object({ number: IssueNumberSchema, created: z26.boolean() });
var ListedIssueSchema = z26.looseObject({ number: IssueNumberSchema, title: z26.string().nullish(), pull_request: z26.unknown().optional() });
var PublishedSchema = z26.object({
  branch: z26.string(),
  commit: z26.string(),
  committed: z26.boolean(),
  pr: z26.object({ number: PrNumberSchema, url: z26.string(), created: z26.boolean() })
}).nullable();
var CommentedSchema = z26.object({ commentId: CommentIdSchema, created: z26.boolean() });

// apps/omni-app/src/knowledge-harvest/github.ts
async function readMerge(octokit, { owner, repo, prNumber }) {
  const { data: answer } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", { owner, repo, pull_number: prNumber });
  const data = parsedOr(PullMergeSchema, answer, `GitHub answered #${prNumber} unexpectedly`);
  return {
    merged: data.merged === true || Boolean(data.merged_at),
    by: data.merged_by?.login ?? null,
    at: data.merged_at ?? null,
    sha: data.merge_commit_sha ?? null,
    url: data.html_url ?? null
  };
}

// apps/omni-app/src/knowledge-pack/files.ts
import { createHash } from "node:crypto";
var MAX_FILE_BYTES = 1024 * 1024;
function sha256Of(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
var utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function textOf(bytes) {
  if (bytes.length > MAX_FILE_BYTES) return { why: "over 1 MiB" };
  let text5;
  try {
    text5 = utf8.decode(bytes);
  } catch {
    return { why: "not UTF-8 text" };
  }
  return text5.includes("\0") ? { why: "holds a NUL character" } : { text: text5 };
}
function packFiles(read) {
  const files = [];
  const left = [];
  for (const path of [...read.keys()].sort()) {
    const bytes = read.get(path) ?? new Uint8Array();
    const kept = textOf(bytes);
    if ("why" in kept) left.push({ path, why: kept.why });
    else files.push({ path, content: kept.text, sha256: sha256Of(bytes) });
  }
  return { files, left };
}

// apps/omni-app/src/jobs/pack.ts
var PACK_KIND = "knowledge-pack";
var PackPayloadSchema = z27.object({
  installationId: z27.number(),
  owner: z27.string().min(1),
  repo: z27.string().min(1),
  sha: z27.string().regex(/^[0-9a-f]{40}$/),
  committedAt: z27.string().min(1),
  prNumber: PrNumberSchema.optional()
});
function packJob(input) {
  const subject = `${input.owner}/${input.repo}`.toLowerCase();
  const { prNumber, ...rest } = input;
  return { kind: PACK_KIND, key: `${subject}@${input.sha}`, subject, payload: prNumber === void 0 ? rest : { ...rest, prNumber } };
}
function packHandler({
  octokitFor,
  store,
  log: log2 = noteTo("knowledge-pack")
}) {
  return async (job) => {
    const payload = payloadOf(job.payload);
    const { installationId, owner, repo } = payload;
    const repository = `${owner}/${repo}`;
    const what = labelOf(repository, payload);
    const skipped = (why) => {
      log2(`knowledge pack: ${what} makes no pack: ${why}`);
      return { outcome: "skipped", reason: why };
    };
    const octokit = await octokitFor(installationId);
    const qualified = payload.prNumber === void 0 ? await qualifyCommit(octokit, { owner, repo }, payload) : await qualifyMerge(octokit, { owner, repo, prNumber: payload.prNumber });
    if (qualified.skip !== null) return skipped(qualified.skip);
    const packed = await pack(octokit, store, { owner, repo, repository, sha: qualified.sha, committedAt: qualified.committedAt, paths: qualified.paths });
    if ("bound" in packed) return skipped(`its knowledge is too large to pack: ${packed.bound}`);
    for (const line of packLines(what, qualified.sha, packed)) log2(line);
    return { outcome: "done" };
  };
}
function payloadOf(raw) {
  const parsed = PackPayloadSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new Error(`The pack job is malformed: ${issue?.path.join(".") || "(payload)"}: ${issue?.message ?? parsed.error.message}`);
}
var labelOf = (repository, { prNumber, sha }) => prNumber === void 0 ? `${repository}@${sha.slice(0, 7)}` : `${repository}#${String(prNumber)}`;
async function qualifyMerge(octokit, { owner, repo, prNumber }) {
  const merge = await readMerge(octokit, { owner, repo, prNumber });
  if (!merge.merged || !merge.sha || !merge.at) return { skip: "it was closed, not merged" };
  const read = await configAt(octokit, { owner, repo, sha: merge.sha });
  if ("none" in read) return { skip: read.none };
  const paths = packPaths(read.config);
  if (!touchesPack(await changedPaths(octokit, { owner, repo, prNumber }), paths)) {
    return { skip: "it touches neither the knowledge folder nor the flow config" };
  }
  return { skip: null, sha: merge.sha, committedAt: merge.at, paths };
}
async function qualifyCommit(octokit, { owner, repo }, { sha, committedAt }) {
  const read = await configAt(octokit, { owner, repo, sha });
  if ("none" in read) return { skip: read.none };
  return { skip: null, sha, committedAt, paths: packPaths(read.config) };
}
async function pack(octokit, store, { owner, repo, repository, sha, committedAt, paths }) {
  let bytes;
  try {
    bytes = await packBytesAt(octokit, { owner, repo, sha, paths });
  } catch (error) {
    if (error instanceof SnapshotBoundError) return { bound: error.message };
    throw error;
  }
  const { files, left } = packFiles(bytes);
  const answer = await store.put({ repository, sha, committedAt, files });
  return {
    files: files.length,
    left: left.map((file) => `${file.path}: ${file.why}`),
    packs: answer.packs.map(({ workspace, created, newest }) => ({ workspace, created, newest }))
  };
}
function packLines(what, sha, packed) {
  const short = sha.slice(0, 7);
  const kept = packed.packs.filter((one) => one.created).length;
  return [
    ...packed.left.map((line) => `knowledge pack: ${what} left out of pack ${short}: ${line}`),
    `knowledge pack: ${what} pack ${short} of ${String(packed.files)} files, new in ${String(kept)} of ${String(packed.packs.length)} workspaces`
  ];
}

// apps/omni-app/src/jobs/gaps.ts
var HeldRowSchema = z28.object({ repository: z28.string().min(1) });
var PackRowSchema = z28.object({ repository: z28.string().min(1), sha: z28.string().min(1), committed_at: z28.string().min(1) });
function gapsStore(connection) {
  const db = serviceDb(connection);
  return {
    held: async () => {
      const held = rowsOf(HeldRowSchema, await db.from("product_repositories").select("repository"));
      const packs = rowsOf(PackRowSchema, await db.from("knowledge_packs").select("repository, sha, committed_at").eq("newest", true));
      const newest = /* @__PURE__ */ new Map();
      for (const row of packs) {
        const known = newest.get(row.repository);
        if (!known || Date.parse(row.committed_at) > Date.parse(known.committedAt)) newest.set(row.repository, { sha: row.sha, committedAt: row.committed_at });
      }
      return [...new Set(held.map((row) => row.repository.toLowerCase()))].sort().map((repository) => ({ repository, pack: newest.get(repository) ?? null }));
    }
  };
}
var InstallationSchema2 = z28.looseObject({ id: z28.number().int().positive() });
var RepositorySchema = z28.looseObject({ default_branch: z28.string().min(1) });
var CommitsSchema = z28.array(z28.looseObject({ sha: z28.string().regex(/^[0-9a-f]{40}$/), commit: z28.looseObject({ committer: z28.looseObject({ date: z28.string().min(1) }).nullish() }) }));
var INSTALLATION = "GET /repos/{owner}/{repo}/installation";
var statusOf = (error) => {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  return typeof error.status === "number" ? error.status : null;
};
function budgetRefused2(error) {
  for (let cause = error, depth = 0; cause instanceof Error && depth < 4; cause = cause.cause, depth += 1) {
    if (cause instanceof GithubDeferred || cause instanceof GithubPaused) return true;
  }
  return false;
}
async function latestCommit(octokit, { owner, repo, branch, paths }) {
  let latest = null;
  for (const path of paths) {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/commits", { owner, repo, sha: branch, path, per_page: 1 });
    const [commit] = CommitsSchema.parse(data);
    const committedAt = commit?.commit.committer?.date;
    if (commit && committedAt && (!latest || Date.parse(committedAt) > Date.parse(latest.committedAt))) latest = { sha: commit.sha, committedAt };
  }
  return latest;
}
async function compareGaps({
  store,
  ledger,
  appOctokit,
  octokitFor,
  log: log2 = noteTo("jobs")
}) {
  const summary = { read: 0, added: 0, skipped: 0, failed: 0, stopped: false };
  for (const held of await store.held()) {
    try {
      const outcome = await compareOne(held, { ledger, appOctokit, octokitFor, log: log2 });
      summary.read += 1;
      if (outcome === "added") summary.added += 1;
      else if (outcome === "skipped") summary.skipped += 1;
    } catch (error) {
      if (budgetRefused2(error)) {
        summary.stopped = true;
        log2("the comparison stopped: GitHub's budget is low, the rest waits for the next hour");
        break;
      }
      summary.failed += 1;
      log2(`the comparison could not read ${held.repository}: ${(error instanceof Error ? error.message : String(error)).split("\n")[0] ?? ""}`);
    }
  }
  return summary;
}
async function compareOne({ repository, pack: pack2 }, { ledger, appOctokit, octokitFor, log: log2 }) {
  const [owner = "", repo = ""] = repository.split("/");
  let installationId;
  try {
    const { data: data2 } = await (await appOctokit()).request(INSTALLATION, { owner, repo });
    installationId = InstallationSchema2.parse(data2).id;
  } catch (error) {
    if (statusOf(error) === 404) return "skipped";
    throw error;
  }
  const octokit = await octokitFor(installationId);
  const { data } = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
  const branch = RepositorySchema.parse(data).default_branch;
  const read = await configAt(octokit, { owner, repo, sha: branch });
  if ("none" in read) {
    log2(`the comparison leaves ${repository} alone: ${read.none}`);
    return "skipped";
  }
  const paths = packPaths(read.config);
  const latest = await latestCommit(octokit, { owner, repo, branch, paths: [...paths.folders, CONFIG_FILE] });
  if (!latest) return "same";
  if (pack2 && (pack2.sha === latest.sha || Date.parse(pack2.committedAt) >= Date.parse(latest.committedAt))) return "same";
  const added = await ledger.add(packJob({ installationId, owner, repo, sha: latest.sha, committedAt: latest.committedAt }));
  return added ? "added" : "same";
}

// apps/omni-app/src/jobs/ledger.ts
import { z as z29 } from "zod";
var RefreshedSchema = z29.enum(["added", "updated", "again", "requeued"]);
var PayloadSchema = z29.record(z29.string(), z29.unknown());
var ClaimedRowSchema = z29.object({
  id: z29.string().min(1),
  kind: z29.string().min(1),
  key: z29.string().min(1),
  subject: z29.string().min(1),
  payload: PayloadSchema,
  tries: z29.number().int().min(1).max(5),
  claim: z29.string().min(1),
  claimed_until: z29.string().min(1)
});
var JobStateSchema = z29.enum(["queued", "done", "skipped", "failed"]);
var ReplayedRowSchema = z29.object({
  id: z29.string().min(1),
  kind: z29.string().min(1),
  key: z29.string().min(1),
  state: z29.literal("queued"),
  tries: z29.literal(0)
});
var HealthSchema = z29.object({
  state: z29.enum(["ok", "late"]),
  late: z29.number().int().nonnegative(),
  failed: z29.number().int().nonnegative()
});
var refused3 = (error) => new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ""}`);
function dataOf({ data, error }) {
  if (error) throw refused3(error);
  return data;
}
function jobLedger(connection) {
  const db = serviceDb(connection);
  return {
    add: async ({ kind, key, subject, payload }) => z29.boolean().parse(dataOf(await db.rpc("background_job_add", { p_kind: kind, p_key: key, p_subject: subject, p_payload: payload }))),
    refresh: async ({ kind, key, subject, payload, delaySeconds }) => RefreshedSchema.parse(dataOf(await db.rpc("background_job_refresh", {
      p_kind: kind,
      p_key: key,
      p_subject: subject,
      p_payload: payload,
      p_delay_seconds: delaySeconds
    }))),
    claim: async ({ limit, leaseSeconds }) => {
      const rows = z29.array(ClaimedRowSchema).parse(dataOf(await db.rpc("background_job_claim", { p_limit: limit, p_lease_seconds: leaseSeconds })));
      return rows.map(({ claimed_until, ...row }) => ({ ...row, claimedUntil: claimed_until }));
    },
    finish: async ({ id, claim, outcome, reason: reason2, retryAt }) => {
      const answer = await db.rpc("background_job_finish", {
        p_id: id,
        p_claim: claim,
        p_outcome: outcome,
        ...reason2 === null ? {} : { p_reason: reason2 },
        ...retryAt === null ? {} : { p_retry_at: retryAt }
      });
      if (answer.error?.code === "55000") return "stale";
      return JobStateSchema.parse(dataOf(answer));
    },
    replay: async (id) => {
      const answer = await db.rpc("background_job_replay", { p_id: id });
      if (answer.error?.code === "P0002" || answer.error?.code === "55000") return { replayed: false, reason: answer.error.message };
      const job = ReplayedRowSchema.parse(dataOf(answer));
      return { replayed: true, ...job };
    },
    health: async () => HealthSchema.parse(dataOf(await db.rpc("background_jobs_health", void 0, { get: true }))),
    forget: async () => z29.number().int().nonnegative().parse(dataOf(await db.rpc("background_jobs_forget")))
  };
}

// apps/omni-app/src/jobs/worker.ts
var TIME_BUDGET_MS = 24e4;
var LEASE_SECONDS = 300;
var MAX_TRIES = 5;
var RETRY_MINUTES = Object.freeze([1, 5, 30, 120]);
var WAIT_MINUTES = 15;
var MINUTE = 6e4;
var MAX_REASON = 500;
async function runDue({
  ledger,
  handlers,
  failures = {},
  clock = Date.now,
  budgetMs = TIME_BUDGET_MS,
  leaseSeconds = LEASE_SECONDS,
  log: log2 = noteTo("jobs")
}) {
  const summary = { ran: 0, done: 0, skipped: 0, retry: 0, waiting: 0, failed: 0, stale: 0 };
  const start = clock();
  while (clock() - start < budgetMs) {
    const [job] = await ledger.claim({ limit: 1, leaseSeconds });
    if (!job) break;
    const settled = await settle(job, handlers[job.kind], clock);
    summary.ran += 1;
    const kept = await keep(ledger, job, settled, log2);
    if (kept === "stale") summary.stale += 1;
    else if (kept !== null) summary[settled.outcome] += 1;
    if (kept === "failed") await failed(job, settled.reason, failures[job.kind], log2);
  }
  return summary;
}
async function failed(job, reason2, hook, log2) {
  if (!hook) return;
  try {
    await hook(job, reason2 ?? "it failed on its last try");
  } catch (error) {
    log2(`job ${job.kind} ${job.key}: its failure hook threw: ${firstLine3(error instanceof Error ? error.message : String(error))}`);
  }
}
async function settle(job, handler, clock) {
  try {
    if (!handler) throw new Error(`no handler runs jobs of kind ${job.kind} here`);
    const result = await handler(job);
    return result.outcome === "done" ? { outcome: "done", reason: null, retryAt: null } : { outcome: "skipped", reason: firstLine3(result.reason), retryAt: null };
  } catch (error) {
    const reason2 = firstLine3(error instanceof Error ? error.message : String(error));
    const budget = budgetRefusal(error);
    if (budget) return { outcome: "waiting", reason: firstLine3(budget.message), retryAt: later(clock, WAIT_MINUTES) };
    const wait = RETRY_MINUTES[job.tries - 1];
    if (job.tries >= MAX_TRIES || wait === void 0) return { outcome: "failed", reason: reason2, retryAt: null };
    return { outcome: "retry", reason: reason2, retryAt: later(clock, wait) };
  }
}
async function keep(ledger, job, settled, log2) {
  const name = `job ${job.kind} ${job.key}`;
  let answer;
  try {
    answer = await ledger.finish({ id: job.id, claim: job.claim, ...settled });
  } catch (error) {
    log2(`${name}: its ${settled.outcome} was not kept: ${firstLine3(error instanceof Error ? error.message : String(error))}`);
    return null;
  }
  if (answer === "stale") log2(`${name}: its claim was taken over, so its ${settled.outcome} was not kept`);
  else if (settled.outcome === "skipped") log2(`${name}: skipped: ${settled.reason ?? ""}`);
  else if (settled.outcome !== "done") log2(`${name}: ${settled.outcome} on try ${String(job.tries)}: ${settled.reason ?? ""}`);
  return answer;
}
function budgetRefusal(error) {
  for (let cause = error, depth = 0; cause instanceof Error && depth < 4; cause = cause.cause, depth += 1) {
    if (cause instanceof GithubDeferred || cause instanceof GithubPaused) return cause;
  }
  return null;
}
function firstLine3(message) {
  const line = message.split("\n").map((one) => one.trim()).find((one) => one.length > 0);
  return line ? line.slice(0, MAX_REASON) : "it threw with no message";
}
var later = (clock, minutes) => new Date(clock() + minutes * MINUTE).toISOString();

// apps/omni-app/src/jobs/sweep.ts
var FORGET_HOUR_UTC = 3;
function liveJobs(env, logger) {
  const { supabase } = env;
  if (!supabase) return null;
  const ledger = jobLedger(supabase);
  const store = knowledgePackStore(supabase);
  const octokitFor = installationOctokitFor(env.githubApp ?? null, githubClient({ store: githubStoreOf(supabase), log: noteTo("github", logger) }));
  return {
    run: () => runDue({ ledger, handlers: { [PACK_KIND]: packHandler({ octokitFor, store }) } }),
    delayed: () => postDelayed({ store: delayedStore(supabase), octokitFor }),
    gaps: () => compareGaps({ store: gapsStore(supabase), ledger, appOctokit: appOctokitFor(env.githubApp ?? null), octokitFor }),
    replay: (id) => ledger.replay(id),
    forget: () => ledger.forget()
  };
}
var ReplayBodySchema = z30.object({ replay: z30.string().min(1) });
var json = (status, body) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
function authorized(header, secret) {
  if (!secret || header === null) return false;
  const given = Buffer.from(header);
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
function jobsSweepRoute(env, { logger = log, jobs = liveJobs(env, logger), clock = Date.now } = {}) {
  const guarded = (handle) => loggedHandler(logger, "jobs-sweep", async (request) => {
    if (!authorized(request.headers.get("authorization"), env.cron?.secret)) return json(401, { error: "unauthorized" });
    if (!jobs) return json(503, { error: "no database here" });
    return handle(request, jobs);
  });
  return {
    GET: guarded(async (request, ledger) => {
      const body = {};
      if (new URL(request.url).searchParams.get("gaps") === "1") {
        body.gaps = await ledger.gaps();
        if (new Date(clock()).getUTCHours() === FORGET_HOUR_UTC) body.forgotten = await ledger.forget();
      }
      body.delayed = await ledger.delayed();
      body.run = await ledger.run();
      return json(200, { ok: true, ...body });
    }),
    POST: guarded(async (request, ledger) => {
      const parsed = ReplayBodySchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return json(400, { error: 'expected {"replay": "<job id>"}' });
      const replayed = await ledger.replay(parsed.data.replay);
      if (!replayed.replayed) return json(409, { ok: false, replayed: false, reason: replayed.reason });
      return json(200, { ok: true, replayed: true, id: replayed.id, run: await ledger.run() });
    }),
    PUT: methodNotAllowed(logger),
    PATCH: methodNotAllowed(logger),
    DELETE: methodNotAllowed(logger)
  };
}
function methodNotAllowed(logger) {
  return loggedHandler(logger, "jobs-sweep", () => new Response("method not allowed", { status: 405, headers: { allow: "GET, POST" } }));
}

// apps/omni-app/entries/jobs-sweep.ts
var { GET, POST, PUT, PATCH, DELETE } = jobsSweepRoute(readEnv(processEnv()));
export {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT
};
