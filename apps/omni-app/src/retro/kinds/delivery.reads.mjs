// The GitHub reads of the delivery kind (PRD 72, slice s5), each through the one Octokit seam,
// `octokit.request(route, params)`, and each giving plain records: a pull request's changed paths,
// its stuck comments, the times a label was added to it, its reviews and its review threads.
//
// A read the installation is not allowed to make, or that finds nothing (403, 404, or GraphQL
// refusing the same way), gives `null`: unknown, which the detector says, never an empty list it
// would count as "none". Any other failure fails the step, so Inngest retries it.
import { MAX_PAGES, PER_PAGE, paginate } from '../github.mjs';
import { hasRedCircle, isBotLogin, stuckAttempts } from './delivery.facts.mjs';

const UNREADABLE = new Set([403, 404]);
const UNREADABLE_GRAPHQL = new Set(['FORBIDDEN', 'NOT_FOUND']);

/** `read()`'s records, or `null` when GitHub says this installation cannot read them. */
export async function readOrNull(read) {
  try {
    return await read();
  } catch (error) {
    if (UNREADABLE.has(error?.status)) return null;
    throw error;
  }
}

function pages(octokit, route, params) {
  return paginate((page) => octokit.request(route, { ...params, per_page: PER_PAGE, page }).then(({ data }) => data));
}

/** Every path a pull request changed; a renamed file counts under both its names. */
export async function listChangedPaths(octokit, { owner, repo, number }) {
  const files = await pages(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { owner, repo, pull_number: number });
  return files.flatMap((file) => (file.previous_filename ? [file.filename, file.previous_filename] : [file.filename]));
}

/** The comments on a pull request that say it went stuck, with how many attempts it took. */
export async function listStuckComments(octokit, { owner, repo, number }) {
  const comments = await pages(octokit, 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments', { owner, repo, issue_number: number });
  return comments
    .map((comment) => ({ comment, attempts: stuckAttempts(comment.body) }))
    .filter(({ attempts }) => attempts !== null)
    .map(({ comment, attempts }) => ({ url: comment.html_url ?? null, at: comment.created_at ?? null, attempts, text: comment.body }));
}

/** When `label` was added to a pull request, oldest first, from its issue events. */
export async function listLabelAdds(octokit, { owner, repo, number, label }) {
  const events = await pages(octokit, 'GET /repos/{owner}/{repo}/issues/{issue_number}/events', { owner, repo, issue_number: number });
  return events
    .filter((event) => event.event === 'labeled' && event.label?.name === label)
    .map((event) => event.created_at)
    .sort();
}

/** A pull request's reviews: who wrote each, person or bot, its state, and its text when it holds a red circle. */
export async function listReviews(octokit, { owner, repo, number }) {
  const reviews = await pages(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', { owner, repo, pull_number: number });
  return reviews.map((review) => {
    const red = hasRedCircle(review.body);
    return {
      url: review.html_url ?? null,
      author: review.user?.login ?? null,
      bot: review.user?.type === 'Bot' || isBotLogin(review.user?.login),
      state: review.state ?? null,
      red,
      text: red ? review.body : null,
    };
  });
}

const THREADS_QUERY = `query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved
          isOutdated
          path
          comments(first: 1) { nodes { url body author { login __typename } } }
        }
      }
    }
  }
}`;

/**
 * A pull request's review threads, read through GraphQL (the REST API does not say whether a thread
 * is resolved): each thread's opening comment, its author, person or bot, whether it was resolved,
 * and its text when it holds a red circle. `null` when GraphQL refuses the read.
 */
export async function listReviewThreads(octokit, { owner, repo, number }) {
  const threads = [];
  let after = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data: body } = await octokit.request('POST /graphql', {
      query: THREADS_QUERY,
      variables: { owner, repo, number, after },
    });
    if (body?.errors?.length) {
      if (body.errors.every((error) => UNREADABLE_GRAPHQL.has(error.type))) return null;
      throw new Error(body.errors.map((error) => error.message).join('; '));
    }
    const connection = body?.data?.repository?.pullRequest?.reviewThreads;
    if (!connection) return null;
    for (const node of connection.nodes ?? []) {
      const first = node.comments?.nodes?.[0] ?? null;
      const red = hasRedCircle(first?.body);
      threads.push({
        url: first?.url ?? null,
        author: first?.author?.login ?? null,
        bot: first?.author?.__typename === 'Bot' || isBotLogin(first?.author?.login),
        path: node.path ?? null,
        resolved: node.isResolved === true,
        outdated: node.isOutdated === true,
        red,
        text: red ? first.body : null,
      });
    }
    if (!connection.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor;
  }
  return threads;
}
