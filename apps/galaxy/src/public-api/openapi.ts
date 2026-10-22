import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  BugFixListSchema, JobSchema, ListQuerySchema, PrdListSchema, PublicApiErrorSchema, StartBugFixSchema, StartMegaBugFixSchema,
} from './public-api.contract';

// The public API's reference (PRD 2022 s3, spec "The reference"): every /api/v1 route registered with
// @asteasolutions/zod-to-openapi (v9, which reads zod 4's own `.meta()`, so nothing patches `z`) from the
// contract's schemas, and built into an OpenAPI 3.1 document with the `bearerAuth` scheme on every route
// but its own. This is the only file that imports the library; nothing here validates a call.
// A route added under app/api/v1/ is registered here too: openapi.test.ts fails when one is missing.

const ERROR_ANSWERS = {
  401: 'No key, an unknown key, a revoked key, or a key whose maker left the workspace.',
  403: 'A repository outside the workspace or outside the key’s list of repositories, to start a job in or to read the job of.',
  404: 'A job that does not exist, that a person sent, or that no key of this workspace queued.',
  422: 'A query or body the contract refuses, a cursor that does not decode, a description the runners refuse, or a repository that is not a plan repository; the message names the field.',
  500: 'The API could not answer; the message never carries a stack or a database error.',
} as const;

const errors = (...statuses: (keyof typeof ERROR_ANSWERS)[]) => Object.fromEntries(statuses.map((status) => [
  status,
  { description: ERROR_ANSWERS[status], content: { 'application/json': { schema: PublicApiErrorSchema } } },
]));

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
    description: 'A job a key of this workspace queued, whichever key it was: its status, the runner, the `pr_url` (the pull request a mega bug fix’s record is), the exit code, the reason and the times, and, for a bug fix or a mega bug fix, what it did: its `outcome` (`pr_opened`, `already_fixed`, `need_human`, `needs_brainstorm`, `not_a_bug`, `stuck` or `blocked`; null while it runs, when it failed, or when its runner reported none), `fixed_by` (the pull request that already fixed the bug, with `already_fixed` only), `prs` (every pull request it opened, in order, a mega bug fix’s record last), `questions` (the state of the questions it asked), `continues` and `continued_by` (the job it carries on and the one that carries it on), `acting_for`, `cancelled_by` (the key that cancelled it) and `log_tail`. A key whose list of repositories leaves the job’s repository out is refused.',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.uuid().meta({ description: 'The job’s id, as `POST /api/v1/bug-fixes` or `POST /api/v1/mega-bug-fixes` answered it.', example: '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3' }) }) },
    responses: {
      200: { description: 'The job.', content: { 'application/json': { schema: JobSchema } } },
      ...errors(401, 403, 404, 500),
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
