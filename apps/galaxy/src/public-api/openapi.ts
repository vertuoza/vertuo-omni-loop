import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  AnswerJobSchema, BugFixListSchema, DismissJobSchema, JobLineListSchema, JobSchema, ListQuerySchema, PrdListSchema, PublicApiErrorSchema, QuestionsSchema,
  StartBugFixSchema, StartMegaBugFixSchema,
} from './public-api.contract';

// The public API's reference (PRD 2022 s3, spec "The reference"): every /api/v1 route registered with
// @asteasolutions/zod-to-openapi (v9, which reads zod 4's own `.meta()`, so nothing patches `z`) from the
// contract's schemas, and built into an OpenAPI 3.1 document with the `bearerAuth` scheme on every route
// but its own. This is the only file that imports the library; nothing here validates a call.
// A route added under app/api/v1/ is registered here too: openapi.test.ts fails when one is missing.

const ERROR_ANSWERS = {
  401: 'No key, an unknown key, a revoked key, or a key whose maker left the workspace.',
  403: 'A repository outside the workspace or outside the key’s list of repositories, to start a job in or to read the job of.',
  404: 'A job that does not exist, that a person sent, that no key of this workspace queued, or, for its questions, that asked none.',
  409: 'The job’s questions were already answered or dismissed, by a key or by a person on the Runners page (the first close wins), or the job is not waiting for an answer; the message names who closed them.',
  422: 'A query or body the contract refuses, a cursor that does not decode, a description the runners refuse, a repository that is not a plan repository, or answers that are not one to each question the job asked; the message names the field.',
  500: 'The API could not answer; the message never carries a stack or a database error.',
} as const;

const errors = (...statuses: (keyof typeof ERROR_ANSWERS)[]) => Object.fromEntries(statuses.map((status) => [
  status,
  { description: ERROR_ANSWERS[status], content: { 'application/json': { schema: PublicApiErrorSchema } } },
]));

/** The path parameter of every route under /api/v1/jobs/{id}. */
const JobParams = z.object({
  id: z.uuid().meta({ description: 'The job’s id, as `POST /api/v1/bug-fixes` or `POST /api/v1/mega-bug-fixes` answered it.', example: '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3' }),
});

/** Every /api/v1 route and the security scheme, in a registry. */
function openApiRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'An API key a workspace owner makes on Settings › API keys, sent as `Authorization: Bearer oma_…`.',
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/prds',
    tags: ['PRDs'],
    summary: 'List the workspace’s PRDs',
    description: 'Newest first, a page at a time. A key limited to some repositories lists only their PRDs.',
    security: [{ bearerAuth: [] }],
    request: { query: ListQuerySchema },
    responses: {
      200: { description: 'A page of PRDs.', content: { 'application/json': { schema: PrdListSchema } } },
      ...errors(401, 422, 500),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/bug-fixes',
    tags: ['Bug fixes'],
    summary: 'List the workspace’s bug fixes',
    description: 'Newest first, a page at a time. A key limited to some repositories lists only their bug fixes.',
    security: [{ bearerAuth: [] }],
    request: { query: ListQuerySchema },
    responses: {
      200: { description: 'A page of bug fixes.', content: { 'application/json': { schema: BugFixListSchema } } },
      ...errors(401, 422, 500),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/bug-fixes',
    tags: ['Bug fixes'],
    summary: 'Start a bug fix',
    description: 'Queues `/omni:bug-fix <description>` on the workspace’s runners, as the key: the job names the key as its sender, and the pull request it opens says so. Follow the job with `GET /api/v1/jobs/{id}`. The job ends in a pull request a person merges.',
    security: [{ bearerAuth: [] }],
    request: { body: { required: true, content: { 'application/json': { schema: StartBugFixSchema } } } },
    responses: {
      202: { description: 'The job, queued.', content: { 'application/json': { schema: JobSchema } } },
      ...errors(401, 403, 422, 500),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/mega-bug-fixes',
    tags: ['Bug fixes'],
    summary: 'Start a bug fix across repositories',
    description: 'Queues `/omni:mega-bug-fix <description>` in a plan repository of the workspace, as the key, for a bug that shows in one of its targets while its cause may sit in another: the skill finds where the cause is among the plan’s targets, opens one fix pull request per target that changes, in merge order, then a record pull request in the plan repository that closes the issue. The job’s `pr_url` is that record pull request; its body lists the target pull requests with `Merge after` lines. A person merges every one, the record last. The repository must be one a product of the workspace names as its plan repository, held by a runner. This route never answers 404: a deployment that answers 404 here is older than it.',
    security: [{ bearerAuth: [] }],
    request: { body: { required: true, content: { 'application/json': { schema: StartMegaBugFixSchema } } } },
    responses: {
      202: { description: 'The job, queued.', content: { 'application/json': { schema: JobSchema } } },
      ...errors(401, 403, 422, 500),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/jobs/{id}',
    tags: ['Bug fixes'],
    summary: 'Follow a job',
    description: 'A job a key of this workspace queued, whichever key it was: its status, the runner, the `pr_url` (the pull request a mega bug fix’s record is), the exit code, the reason and the times. A key whose list of repositories leaves the job’s repository out is refused.\n\nFor a bug fix or a mega bug fix it also says what the job did:\n\n- `outcome`: `pr_opened`, `already_fixed`, `need_human`, `needs_brainstorm`, `not_a_bug`, `stuck` or `blocked`; null while it runs, when it failed, or when its runner reported none.\n- `fixed_by`: the pull request that already fixed the bug, with `already_fixed` only.\n- `prs`: every pull request it opened, in order, a mega bug fix’s record last.\n- `questions`: the state of the questions it asked; `GET /api/v1/jobs/{id}/questions` reads them, and `POST /api/v1/jobs/{id}/answers` and `POST /api/v1/jobs/{id}/dismiss` close them.\n- `continues`, `continued_by`: the job it carries on and the one that carries it on.\n- `acting_for`, `cancelled_by`: whom the key acted for, and the key that cancelled the job.\n- `log_tail`: the last lines of its log; `GET /api/v1/jobs/{id}/lines` reads the whole of it, a page at a time.',
    security: [{ bearerAuth: [] }],
    request: { params: JobParams },
    responses: {
      200: { description: 'The job.', content: { 'application/json': { schema: JobSchema } } },
      ...errors(401, 403, 404, 500),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/jobs/{id}/lines',
    tags: ['Bug fixes'],
    summary: 'Read a job’s log',
    description: 'The lines of a job a key of this workspace queued, whichever key it was, oldest first, a page at a time: each is `{seq, text}`, `seq` counting from 1 in the order the job wrote it. `next_cursor` is the cursor of the next page, null on the last: send it back unchanged as `cursor`, and a page never repeats or skips a line while the job writes more. A job that is still running grows between pages; read on until `next_cursor` is null, and again later for what it wrote since.\n\nThe workspace keeps the lines of its 50 newest ended jobs: a job past that answers an empty `data`, and its `log_tail` on `GET /api/v1/jobs/{id}` still holds the last lines of its log. A job that has not started has no lines yet and answers the same. The key rules are the job’s own: a key whose list of repositories leaves the job’s repository out is refused.',
    security: [{ bearerAuth: [] }],
    request: { params: JobParams, query: ListQuerySchema },
    responses: {
      200: { description: 'A page of the job’s lines.', content: { 'application/json': { schema: JobLineListSchema } } },
      ...errors(401, 403, 404, 422, 500),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/jobs/{id}/questions',
    tags: ['Bug fixes'],
    summary: 'Read the questions a job asked',
    description: 'A job that ends with `outcome` `need_human` has stopped to ask: its `questions` field on `GET /api/v1/jobs/{id}` says whether they are `open`, `answered` or `dismissed`. This reads them: the `lead` that says why it stopped, each question with its `header`, its `options` (two to four, each a `label` and what it changes) and whether it allows more than one pick, the `state`, the `answers` once given, and `closed_by`, who answered or dismissed them: `{key, acting_for}` for an API key, `{login}` for a person on the Runners page, null while they are open.\n\nA job that asked none, one a person sent, one that no key of this workspace queued, and one that does not exist are 404, a key whose list of repositories leaves the job’s repository out is refused, as for the job itself.',
    security: [{ bearerAuth: [] }],
    request: { params: JobParams },
    responses: {
      200: { description: 'The questions.', content: { 'application/json': { schema: QuestionsSchema } } },
      ...errors(401, 403, 404, 500),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/jobs/{id}/answers',
    tags: ['Bug fixes'],
    summary: 'Answer the questions a job asked',
    description: 'Answers the open questions of a job a key of this workspace queued, whichever key it was: one answer to each question, a pick (an option’s `label`) or a free one, and no other. The job resumes: this queues a new job on the same runner target, as the key that sent the first and its maker, whoever answers, and answers 202 with it. Its `continues` is the first job’s id, and the first job’s `continued_by` is the new one, which the key that sent the job reads with `GET /api/v1/jobs/{id}`.\n\n`acting_for` says whom the key acts for, if anyone: 1 to 80 characters of letters of any alphabet, digits, spaces and `. _ \' @ - ·`, stored as given and shown beside the key’s name on the Runners page. The first close wins: a second answer or dismissal, from a key or from a person on the Runners page, is 409 and changes nothing. A repository’s own skill, whose questions can only be dismissed, is 422.',
    security: [{ bearerAuth: [] }],
    request: { params: JobParams, body: { required: true, content: { 'application/json': { schema: AnswerJobSchema } } } },
    responses: {
      202: { description: 'The job that resumes the first one, queued.', content: { 'application/json': { schema: JobSchema } } },
      ...errors(401, 403, 404, 409, 422, 500),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/jobs/{id}/dismiss',
    tags: ['Bug fixes'],
    summary: 'Dismiss the questions a job asked',
    description: 'Closes the open questions of a job a key of this workspace queued with no answer, and queues nothing: the job stays as it ended, and its `questions` read `dismissed`. Answers 200 with the job. The body is optional: send none, `{}`, or `{"acting_for": "…"}` to say whom the key acts for (1 to 80 characters, as for an answer). The first close wins: a second dismissal or answer, from a key or from a person on the Runners page, is 409.',
    security: [{ bearerAuth: [] }],
    request: { params: JobParams, body: { required: false, content: { 'application/json': { schema: DismissJobSchema } } } },
    responses: {
      200: { description: 'The job, its questions dismissed.', content: { 'application/json': { schema: JobSchema } } },
      ...errors(401, 403, 404, 409, 422, 500),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/openapi.json',
    tags: ['Reference'],
    summary: 'This reference',
    description: 'The OpenAPI 3.1 document of the API. It needs no key.',
    security: [],
    responses: {
      200: {
        description: 'The OpenAPI 3.1 document.',
        content: { 'application/json': { schema: z.looseObject({}).meta({ description: 'An OpenAPI 3.1 document.' }) } },
      },
    },
  });

  return registry;
}

/** The OpenAPI 3.1 document of every /api/v1 route. */
export function openApiDocument() {
  return new OpenApiGeneratorV31(openApiRegistry().definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Omni Loop API',
      version: '1.0.0',
      description: 'Read a workspace’s PRDs and bug fixes, and start a bug fix in one repository or across a plan repository’s targets, with its API key. A workspace owner makes a key on Settings › API keys.',
    },
    servers: [{ url: '/', description: 'This deployment' }],
  });
}
