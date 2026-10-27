// The fleet board's GitHub calls (PRD 2530 s2), through GitHub's GraphQL API only: `octokit.graphql(query,
// variables)`, so a test fakes one function. Two calls per card: the project's node id from its
// organization and number, then `addProjectV2ItemById`. Adding a pull request already on the board answers
// its card and changes nothing, so a second delivery is harmless.
//
// GitHub's refusals are answers, never retried: the App not allowed to write the organization's projects
// (an org admin has not accepted `Organization projects`) is `permission`; a project or organization that
// does not exist, or a link that is not an organization project, is `missing`. Anything else (a 5xx, a rate
// limit) is thrown, so the step fails and Inngest retries it.
import { z } from 'zod';

/** The one seam of GitHub the fleet board calls through: a GraphQL query and its variables. */
export type GraphqlOctokit = { graphql: (query: string, variables?: Record<string, unknown>) => Promise<unknown> };

/** What adding the card came to. */
export const AddedSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('added') }),
  z.object({ outcome: z.literal('refused'), reason: z.enum(['permission', 'missing']) }),
]);
export type Added = z.infer<typeof AddedSchema>;

/** An organization project's link: `https://github.com/orgs/<org>/projects/<number>`, as the fleet keeps it. */
const BOARD = /^https:\/\/github\.com\/orgs\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/projects\/([1-9][0-9]{0,9})\/?$/;

/** The organization and number a board's link names, or `null` when it is no organization project. */
function boardOf(url: string): { org: string; number: number } | null {
  const match = BOARD.exec(url.trim());
  if (!match?.[1] || !match[2]) return null;
  return { org: match[1], number: Number(match[2]) };
}

const PROJECT = `query FleetBoardProject($org: String!, $number: Int!) {
  organization(login: $org) { projectV2(number: $number) { id } }
}`;

const ADD = `mutation FleetBoardAdd($project: ID!, $content: ID!) {
  addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
}`;

const ProjectAnswerSchema = z.looseObject({
  organization: z.looseObject({ projectV2: z.looseObject({ id: z.string().min(1) }).nullish() }).nullish(),
});

const AddAnswerSchema = z.looseObject({
  addProjectV2ItemById: z.looseObject({ item: z.looseObject({ id: z.string().min(1) }).nullish() }).nullish(),
});

/** Adds the pull request `contentId` to the board at `url`: added, or refused and why. Throws on anything else. */
export async function addToBoard(octokit: GraphqlOctokit, { url, contentId }: { url: string; contentId: string }): Promise<Added> {
  const board = boardOf(url);
  if (!board) return refused('missing');
  try {
    const project = ProjectAnswerSchema.parse(await octokit.graphql(PROJECT, { org: board.org, number: board.number })).organization?.projectV2?.id;
    if (!project) return refused('missing');
    const card = AddAnswerSchema.parse(await octokit.graphql(ADD, { project, content: contentId })).addProjectV2ItemById?.item?.id;
    if (!card) throw new Error('GitHub answered addProjectV2ItemById with no card');
    return { outcome: 'added' };
  } catch (error) {
    const reason = refusalOf(error);
    if (reason === null) throw error;
    return refused(reason);
  }
}

function refused(reason: 'permission' | 'missing'): Added {
  return { outcome: 'refused', reason };
}

/** The GraphQL error types that say the App may not write the organization's projects. */
const NOT_ALLOWED: ReadonlySet<unknown> = new Set(['FORBIDDEN', 'INSUFFICIENT_SCOPES']);

const GraphqlErrorsSchema = z.looseObject({ errors: z.array(z.looseObject({ type: z.unknown().optional() })).min(1) });
const HttpErrorSchema = z.looseObject({ status: z.number(), message: z.string().optional() });

/**
 * A refusal GitHub answered, or `null` when the error is not one: a GraphQL answer's errors (`FORBIDDEN`,
 * `INSUFFICIENT_SCOPES`: permission; `NOT_FOUND`: missing), or an HTTP status (401 or 403: permission,
 * unless it names a rate limit; 404: missing). A rate limit or a 5xx is no refusal.
 */
function refusalOf(error: unknown): 'permission' | 'missing' | null {
  const graphql = GraphqlErrorsSchema.safeParse(error);
  if (graphql.success) {
    const types = graphql.data.errors.map((one) => one.type);
    if (types.some((type) => NOT_ALLOWED.has(type))) return 'permission';
    if (types.every((type) => type === 'NOT_FOUND')) return 'missing';
    return null;
  }
  const http = HttpErrorSchema.safeParse(error);
  if (!http.success) return null;
  const { status, message = '' } = http.data;
  if ((status === 401 || status === 403) && !/rate limit/i.test(message)) return 'permission';
  if (status === 404) return 'missing';
  return null;
}
