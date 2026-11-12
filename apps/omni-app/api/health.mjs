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
function readCommit(source) {
  return envReader(source).group(VERCEL)?.commit ?? null;
}
function processEnv() {
  return process.env;
}

// apps/omni-app/src/jobs/ledger.ts
import { z as z5 } from "zod";

// apps/omni-app/src/server-event/service-db.ts
import { createClient } from "@supabase/supabase-js";
import { z as z4 } from "zod";
function serviceDb({ url, key, fetch }) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...fetch ? { global: { fetch } } : {}
  });
}

// apps/omni-app/src/jobs/schedule.ts
var SCHEDULES = Object.freeze([
  { kind: "pr-stats", periodMinutes: 15, maxTries: 3 },
  { kind: "escalation", periodMinutes: 60, maxTries: 3 }
]);

// apps/omni-app/src/jobs/ledger.ts
var RefreshedSchema = z5.enum(["added", "updated", "again", "requeued"]);
var PayloadSchema = z5.record(z5.string(), z5.unknown());
var ClaimedRowSchema = z5.object({
  id: z5.string().min(1),
  kind: z5.string().min(1),
  key: z5.string().min(1),
  subject: z5.string().min(1),
  payload: PayloadSchema,
  progress: PayloadSchema.default({}),
  lane: z5.string().min(1).nullable().default(null),
  tries: z5.number().int().min(1).max(5),
  max_tries: z5.number().int().min(1).max(5).default(5),
  claim: z5.string().min(1),
  claimed_until: z5.string().min(1)
});
var JobStateSchema = z5.enum(["queued", "done", "skipped", "failed"]);
var ReplayedRowSchema = z5.object({
  id: z5.string().min(1),
  kind: z5.string().min(1),
  key: z5.string().min(1),
  state: z5.literal("queued"),
  tries: z5.literal(0)
});
var HealthSchema = z5.object({
  state: z5.enum(["ok", "late"]),
  late: z5.number().int().nonnegative(),
  failed: z5.number().int().nonnegative(),
  /** The schedules whose kind has had no done job for three periods; absent before PRD omni-loop-3's migration. */
  scheduled: z5.number().int().nonnegative().optional()
});
var StepRowSchema = z5.object({ step: z5.string().min(1), value: z5.unknown(), saved_at: z5.string().min(1) });
var STALE = "55000";
var refused = (error) => new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ""}`);
function dataOf({ data, error }) {
  if (error) throw refused(error);
  return data;
}
function paced(lane, maxTries) {
  return { ...lane === void 0 ? {} : { p_lane: lane }, ...maxTries === void 0 ? {} : { p_max_tries: maxTries } };
}
function healthArgs(schedules) {
  if (schedules.length === 0) return void 0;
  return { p_kinds: schedules.map(({ kind }) => kind), p_periods: schedules.map(({ periodMinutes }) => periodMinutes * 60) };
}
function jobLedger(connection) {
  const db = serviceDb(connection);
  return {
    add: async ({ kind, key, subject, payload, lane, maxTries }) => z5.boolean().parse(dataOf(await db.rpc("background_job_add", { p_kind: kind, p_key: key, p_subject: subject, p_payload: payload, ...paced(lane, maxTries) }))),
    refresh: async ({ kind, key, subject, payload, delaySeconds, lane, maxTries }) => RefreshedSchema.parse(dataOf(await db.rpc("background_job_refresh", {
      p_kind: kind,
      p_key: key,
      p_subject: subject,
      p_payload: payload,
      p_delay_seconds: delaySeconds,
      ...paced(lane, maxTries)
    }))),
    claim: async ({ limit, leaseSeconds }) => {
      const rows = z5.array(ClaimedRowSchema).parse(dataOf(await db.rpc("background_job_claim", { p_limit: limit, p_lease_seconds: leaseSeconds })));
      return rows.map(({ claimed_until, max_tries, ...row }) => ({ ...row, claimedUntil: claimed_until, maxTries: max_tries }));
    },
    finish: async ({ id, claim, outcome, reason, retryAt, progress }) => {
      const answer = await db.rpc("background_job_finish", {
        p_id: id,
        p_claim: claim,
        p_outcome: outcome,
        ...reason === null ? {} : { p_reason: reason },
        ...retryAt === null ? {} : { p_retry_at: retryAt },
        ...progress === void 0 ? {} : { p_progress: progress }
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
    health: async (schedules = SCHEDULES) => HealthSchema.parse(dataOf(await db.rpc("background_jobs_health", healthArgs(schedules), { get: true }))),
    forget: async () => z5.number().int().nonnegative().parse(dataOf(await db.rpc("background_jobs_forget"))),
    save: async ({ id, claim, step, value }) => {
      const answer = await db.rpc("background_job_save", { p_id: id, p_claim: claim, p_step: step, p_value: z5.json().parse(value) });
      if (answer.error?.code === STALE) return "stale";
      dataOf(answer);
      return "saved";
    },
    stepsOf: async ({ id, claim }) => {
      const answer = await db.rpc("background_job_steps_of", { p_id: id, p_claim: claim });
      if (answer.error?.code === STALE) return "stale";
      const rows = z5.array(StepRowSchema).parse(dataOf(answer));
      return new Map(rows.map(({ step, value }) => [step, value]));
    },
    renew: async ({ id, claim, leaseSeconds }) => {
      const answer = await db.rpc("background_job_renew", { p_id: id, p_claim: claim, ...leaseSeconds === void 0 ? {} : { p_lease_seconds: leaseSeconds } });
      if (answer.error?.code === STALE) return "stale";
      return { until: z5.string().min(1).parse(dataOf(answer)) };
    },
    wake: async ({ kind, key }) => z5.boolean().parse(dataOf(await db.rpc("background_job_wake", { p_kind: kind, p_key: key })))
  };
}

// apps/omni-app/src/health/health.ts
var JOBS_TIMEOUT_MS = 5e3;
var readJobs = (connection) => jobLedger(connection).health();
async function jobsCheck(source, read = readJobs) {
  let supabase;
  try {
    supabase = readEnv(source).supabase;
  } catch {
    return "unknown";
  }
  if (!supabase) return "off";
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("timed out"));
      }, JOBS_TIMEOUT_MS);
    });
    const { state } = await Promise.race([read(supabase), timeout]);
    return state;
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}
function healthOf(source, jobs = "off") {
  let env = "ok";
  try {
    readEnv(source);
  } catch {
    env = "failed";
  }
  const ok = env === "ok" && jobs !== "late";
  return { status: ok ? 200 : 503, body: { ok, app: "omni-app", commit: readCommit(source), checks: { env, jobs: env === "ok" ? jobs : "unknown" } } };
}
var NO_STORE = { "cache-control": "no-store" };
var notAllowed = () => new Response("method not allowed", { status: 405, headers: { ...NO_STORE, allow: "GET", "content-type": "text/plain; charset=utf-8" } });
function healthRoute(source, read = readJobs) {
  return {
    GET: async () => {
      const env = source();
      const { status, body } = healthOf(env, await jobsCheck(env, read));
      return Response.json(body, { status, headers: NO_STORE });
    },
    POST: notAllowed,
    PUT: notAllowed,
    PATCH: notAllowed,
    DELETE: notAllowed
  };
}

// apps/omni-app/entries/health.ts
var { GET, POST, PUT, PATCH, DELETE } = healthRoute(processEnv);
export {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT
};
