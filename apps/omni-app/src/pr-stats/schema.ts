// What GitHub's GraphQL API answers the collector's queries (PRD 612, bug 638, PRD 714), as the
// collector reads them (PRD 725, s20). Each schema names only the fields the collector uses and lets
// every other field through; a field the collector reads past a missing value is nullish here.
import { z } from 'zod';
import { firstIssue } from 'vertuo-omni-plan/kit/lib/plan-repo/gh-schema.ts';

/** `rateLimit { limit remaining resetAt }`: an installation's GraphQL budget. */
const RateLimitSchema = z.looseObject({
  limit: z.number(),
  remaining: z.number(),
  resetAt: z.string().nullish(),
});

/** Any answer, read only for the `rateLimit` it may carry. */
export const RateLimited = z.looseObject({ rateLimit: RateLimitSchema.nullish() }).nullish();

/** `query PullsUpdated`: one page of pull requests, newest update first. */
export const PullsUpdatedSchema = z.looseObject({
  repository: z.looseObject({
    pullRequests: z.looseObject({
      pageInfo: z.looseObject({ hasNextPage: z.boolean(), endCursor: z.string().nullish() }),
      nodes: z.array(z.looseObject({ number: z.number(), updatedAt: z.string() })),
    }),
  }),
});

/** A user or an app, as GraphQL names it: an app by its bare login, `__typename: 'Bot'`. */
const ActorSchema = z.looseObject({ login: z.string().nullish(), __typename: z.string().nullish() }).nullish();

/** One pull request of `query PullDetails`, its `PULL_FIELDS`. */
export const PullDetailSchema = z.looseObject({
  number: z.number(),
  author: ActorSchema,
  createdAt: z.string(),
  mergedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  mergedBy: ActorSchema,
  baseRefName: z.string().nullish(),
  headRefName: z.string().nullish(),
  isDraft: z.boolean().nullish(),
  body: z.string().nullish(),
  additions: z.number().nullish(),
  deletions: z.number().nullish(),
  labels: z.looseObject({ nodes: z.array(z.looseObject({ name: z.string().nullish() }).nullish()).nullish() }).nullish(),
  commits: z
    .looseObject({
      totalCount: z.number(),
      nodes: z.array(
        z.looseObject({
          commit: z.looseObject({ message: z.string().nullish(), committedDate: z.string().nullish() }).nullish(),
        }),
      ),
    })
    .nullish(),
  reviews: z
    .looseObject({ nodes: z.array(z.looseObject({ author: ActorSchema, submittedAt: z.string().nullish() })).nullish() })
    .nullish(),
  timelineItems: z
    .looseObject({
      nodes: z
        .array(
          z
            .looseObject({ createdAt: z.string().nullish(), label: z.looseObject({ name: z.string().nullish() }).nullish() })
            .nullish(),
        )
        .nullish(),
    })
    .nullish(),
});

/** `query PullDetails`: one aliased `p<number>` per pull request asked, null for a number GitHub does not know. */
export const PullDetailsSchema = z.looseObject({ repository: z.record(z.string(), z.unknown()) });

/** One aliased pull request of `query PullStatus`: its first comments' bodies. */
export const PullCommentsSchema = z
  .looseObject({
    comments: z.looseObject({ nodes: z.array(z.looseObject({ body: z.string().nullish() }).nullish()).nullish() }).nullish(),
  })
  .nullish();

/** A tracked `repositories` row, as the collector selects it, with its workspace's installation. */
export const TrackedRowSchema = z.looseObject({
  workspace_id: z.string(),
  full_name: z.string(),
  collected_until: z.string().nullish(),
  workspaces: z.looseObject({ github_installation_id: z.union([z.number(), z.string()]) }),
});

/**
 * A failed GitHub call, read for what it says: GraphQL's `errors`, an HTTP `status`, its `message`.
 * Anything else, or an `errors` of another shape, reads as nothing.
 */
export const FailureSchema = z.looseObject({
  errors: z.array(z.looseObject({ type: z.unknown().optional(), message: z.unknown().optional() }).nullish()).nullish().catch(undefined),
  message: z.unknown().optional(),
  status: z.unknown().optional(),
});

/** The environment the collector reads: the database's address and the service role's key. */
export const StoreEnvSchema = z.looseObject({
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

export type PullDetail = z.infer<typeof PullDetailSchema>;
export type Actor = z.infer<typeof ActorSchema>;

/**
 * `value` parsed by `schema`, or an error naming GitHub's answer and the first field it got wrong:
 * `GitHub answered PullsUpdated unexpectedly: repository.pullRequests.nodes.0.number: …`.
 */
export function parseAnswer<S extends z.ZodType>(schema: S, value: unknown, what: string): z.infer<S> {
  return parsedOr(schema, value, `GitHub answered ${what} unexpectedly`);
}

/** `value` parsed by `schema`, or an error saying `context`, then the first field it got wrong. */
export function parsedOr<S extends z.ZodType>(schema: S, value: unknown, context: string): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Error(`${context}: ${firstIssue(parsed.error)}`);
}
