// apps/omni-app/entries/inngest.ts
import { serve } from "inngest/edge";

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
function processEnv() {
  return process.env;
}

// apps/omni-app/src/functions.ts
function appFunctions() {
  return [];
}

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
  const cut = id.lastIndexOf("-");
  return cut <= 40 && Number(id.slice(cut + 1)) <= PRODUCT_SEQ_MAX;
}).brand();
var PRODUCT_ROADMAP = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-R([1-9]\d{0,9})$/;
var ProductRoadmapIdSchema = z4.string().regex(PRODUCT_ROADMAP).refine((id) => {
  const cut = id.lastIndexOf("-R");
  return cut <= 40 && Number(id.slice(cut + 2)) <= PRODUCT_SEQ_MAX;
}).brand();
var PRODUCT_BUG = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-B([1-9]\d{0,9})$/;
var ProductBugIdSchema = z4.string().regex(PRODUCT_BUG).refine((id) => {
  const cut = id.lastIndexOf("-B");
  return cut <= 40 && Number(id.slice(cut + 2)) <= PRODUCT_SEQ_MAX;
}).brand();
var PrNumberSchema = z4.number().int().positive().brand();
var CommentIdSchema = z4.number().int().positive().brand();
var WorkSliceIdSchema = z4.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).brand();
var SliceIdSchema = z4.string().regex(/^s\d+$/).brand().brand();
var OutboxItemIdSchema = z4.string().regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?s\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/).brand();

// apps/omni-app/src/inngest-client.ts
var APP_ID = "omni-loop";
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
var PullAtSchema = z5.object({
  installationId: z5.number(),
  owner: z5.string().min(1),
  repo: z5.string().min(1),
  prNumber: PrNumberSchema,
  headSha: z5.string().min(1)
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

// apps/omni-app/entries/inngest.ts
readEnv(processEnv());
var functions = appFunctions();
var handler = serve({ client: inngest, functions });
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  functions
};
