import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/v1/openapi.json/route';
import { openApiDocument } from './openapi';

// The reference (PRD 2022 s3): the document parses as OpenAPI 3.1, carries `bearerAuth` on every route
// but its own, and registers every app/api/v1/**/route.ts, so a route added without being described
// fails here.

const V1 = fileURLToPath(new URL('../../app/api/v1', import.meta.url));

/** Every route.ts under app/api/v1/, as the path it serves (`[id]` as `{id}`). */
function routePaths(dir = V1): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routePaths(path);
    if (entry.name !== 'route.ts') return [];
    const segments = relative(V1, dir).split(sep).filter(Boolean).map((s) => s.replace(/^\[(.+)\]$/, '{$1}'));
    return [['/api/v1', ...segments].join('/')];
  });
}

describe('the OpenAPI reference', () => {
  const document = openApiDocument();
  const schemasText = () => JSON.stringify(document.paths?.['/api/v1/jobs/{id}']);

  it('is an OpenAPI 3.1 document with a title and a version', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toBeTruthy();
    expect(document.info.version).toBeTruthy();
  });

  it('registers every app/api/v1 route', () => {
    const routes = routePaths();
    expect(routes.length).toBeGreaterThan(0);
    expect(Object.keys(document.paths ?? {}).sort()).toEqual(expect.arrayContaining(routes));
    for (const route of routes) expect(document.paths?.[route], route).toBeDefined();
  });

  it('puts bearerAuth on every route but its own', () => {
    expect(document.components?.securitySchemes?.['bearerAuth']).toMatchObject({ type: 'http', scheme: 'bearer' });
    for (const [path, item] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(item as Record<string, { security?: unknown }>)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        expect(operation.security, `${method} ${path}`).toEqual(path === '/api/v1/openapi.json' ? [] : [{ bearerAuth: [] }]);
      }
    }
  });

  it('describes each list route with its parameters, its answers and an example', () => {
    for (const path of ['/api/v1/prds', '/api/v1/bug-fixes']) {
      const get = document.paths?.[path]?.get;
      expect(get?.parameters?.map((p) => ('name' in p ? p.name : '')).sort(), path).toEqual(['cursor', 'limit']);
      expect(Object.keys(get?.responses ?? {}), path).toEqual(expect.arrayContaining(['200', '401', '422', '500']));
    }
    const prd = JSON.stringify(document.components?.schemas ?? {}) + JSON.stringify(document.paths?.['/api/v1/prds']);
    expect(prd).toContain('"example"');
  });

  it('describes starting a bug fix and following its job (PRD 2022 s4)', () => {
    const post = document.paths?.['/api/v1/bug-fixes']?.post;
    expect(post?.requestBody).toBeDefined();
    expect(JSON.stringify(post?.requestBody)).toContain('"maxLength":186');
    expect(Object.keys(post?.responses ?? {})).toEqual(expect.arrayContaining(['202', '401', '403', '422', '500']));
    const job = document.paths?.['/api/v1/jobs/{id}']?.get;
    expect(job?.parameters?.map((p) => ('name' in p ? p.name : ''))).toEqual(['id']);
    expect(Object.keys(job?.responses ?? {})).toEqual(expect.arrayContaining(['200', '401', '404', '500']));
  });

  it('describes reading a job, and refusing one off the key’s list with 403 (PRD 2425 s3)', () => {
    const job = document.paths?.['/api/v1/jobs/{id}']?.get;
    expect(Object.keys(job?.responses ?? {}).sort()).toEqual(['200', '401', '403', '404', '500']);
    expect(job?.description).toMatch(/outcome.*fixed_by.*prs.*questions.*continues.*continued_by.*acting_for.*cancelled_by.*log_tail/s);
  });

  it.each(['outcome', 'fixed_by', 'prs', 'questions', 'continues', 'continued_by', 'acting_for', 'cancelled_by', 'log_tail'])(
    'documents the job’s field %s (PRD 2425 s3)', (field) => { expect(schemasText()).toContain(`"${field}"`); },
  );

  it.each(['pr_opened', 'already_fixed', 'need_human', 'needs_brainstorm', 'not_a_bug', 'stuck', 'blocked'])(
    'documents the outcome %s (PRD 2425 s3)', (word) => { expect(schemasText()).toContain(`"${word}"`); },
  );

  it('names a pull request’s link, repository and number in the job’s prs', () => {
    for (const part of ['"url"', '"repo"', '"number"']) expect(schemasText()).toContain(part);
  });

  describe('a job’s lines (PRD 2425 s4)', () => {
    const lines = () => document.paths?.['/api/v1/jobs/{id}/lines']?.get;

    it('is a route of the Bug fixes group, read with a key, by the job’s id and a limit and a cursor', () => {
      expect(lines()?.tags).toEqual(['Bug fixes']);
      expect(lines()?.security).toEqual([{ bearerAuth: [] }]);
      expect(lines()?.parameters?.map((p) => ('name' in p ? p.name : '')).sort()).toEqual(['cursor', 'id', 'limit']);
    });

    it('answers 200 and every refusal of the job’s own read, plus 422 for a query or a cursor it refuses', () => {
      expect(Object.keys(lines()?.responses ?? {}).sort()).toEqual(['200', '401', '403', '404', '422', '500']);
    });

    it('describes a page of lines: each a sequence number and a text, then next_cursor', () => {
      const text = JSON.stringify(lines()?.responses?.['200']);
      for (const part of ['"data"', '"seq"', '"text"', '"next_cursor"']) expect(text).toContain(part);
    });

    it('says the order, the paging and the retention, and where the log tail stays', () => {
      expect(lines()?.summary).toBeTruthy();
      expect(lines()?.description).toMatch(/oldest first/);
      expect(lines()?.description).toMatch(/next_cursor/);
      expect(lines()?.description).toMatch(/50 newest ended jobs.*empty.*log_tail/s);
    });

    it('is named from the job’s own read, which says where every line is read', () => {
      expect(document.paths?.['/api/v1/jobs/{id}']?.get?.description).toContain('GET /api/v1/jobs/{id}/lines');
    });
  });

  describe('a job’s questions, answers and dismissal (PRD 2425 s6)', () => {
    const route = (name: string) => document.paths?.[`/api/v1/jobs/{id}/${name}`];
    const questions = () => route('questions')?.get;
    const answers = () => route('answers')?.post;
    const dismissal = () => route('dismiss')?.post;
    const statuses = (operation: { responses?: object } | undefined) => Object.keys(operation?.responses ?? {}).sort();

    it('lists the three routes in the Bug fixes group, read with a key, by the job’s id', () => {
      for (const operation of [questions(), answers(), dismissal()]) {
        expect(operation?.tags).toEqual(['Bug fixes']);
        expect(operation?.security).toEqual([{ bearerAuth: [] }]);
        expect(operation?.parameters?.map((p) => ('name' in p ? p.name : ''))).toEqual(['id']);
        expect(operation?.summary).toBeTruthy();
      }
      expect(route('questions')).not.toHaveProperty('post');
      expect(route('answers')).not.toHaveProperty('get');
      expect(route('dismiss')).not.toHaveProperty('get');
    });

    it('answers a read with 200 and the job’s own refusals, an answer with 202 and a dismissal with 200, each also 409 and 422', () => {
      expect(statuses(questions())).toEqual(['200', '401', '403', '404', '500']);
      expect(statuses(answers())).toEqual(['202', '401', '403', '404', '409', '422', '500']);
      expect(statuses(dismissal())).toEqual(['200', '401', '403', '404', '409', '422', '500']);
    });

    it('says what the 409 is: the first close wins, a key’s or a person’s, and the message names who closed them', () => {
      const conflict = JSON.stringify(answers()?.responses?.['409']);
      expect(conflict).toMatch(/already answered or dismissed/);
      expect(conflict).toMatch(/Runners page/);
      expect(conflict).toContain('"conflict"');
    });

    it('describes the questions: the lead, each question with its options, the state, the answers and who closed them', () => {
      const text = JSON.stringify(questions()?.responses?.['200']);
      for (const part of ['"lead"', '"questions"', '"header"', '"multi_select"', '"options"', '"label"', '"state"', '"answers"', '"closed_by"', '"acting_for"', '"login"']) {
        expect(text, part).toContain(part);
      }
      for (const state of ['open', 'answered', 'dismissed']) expect(text).toContain(`"${state}"`);
    });

    it('takes the answers strictly: answers required, acting_for of 1 to 80 characters of a set, no other field', () => {
      const body = JSON.stringify(answers()?.requestBody);
      expect(answers()?.requestBody).toMatchObject({ required: true });
      for (const part of ['"answers"', '"acting_for"', '"minLength":1', '"maxLength":80', '"pattern"', '"additionalProperties":false']) expect(body, part).toContain(part);
      expect(body).toContain('"required":["answers"]');
    });

    it('takes a dismissal with no body at all, or an acting_for, and nothing else', () => {
      const body = JSON.stringify(dismissal()?.requestBody);
      expect(dismissal()?.requestBody).not.toMatchObject({ required: true });
      for (const part of ['"acting_for"', '"maxLength":80', '"additionalProperties":false']) expect(body, part).toContain(part);
    });

    it('says the resume continues the job as the key that sent it, and that a dismissal queues nothing', () => {
      expect(answers()?.description).toMatch(/continues/);
      expect(answers()?.description).toMatch(/key that sent/);
      expect(dismissal()?.description).toMatch(/queues nothing/);
    });

    it('is named from the job’s own read, which says where its questions are read and closed', () => {
      const description = document.paths?.['/api/v1/jobs/{id}']?.get?.description;
      for (const route of ['GET /api/v1/jobs/{id}/questions', 'POST /api/v1/jobs/{id}/answers', 'POST /api/v1/jobs/{id}/dismiss']) expect(description).toContain(route);
    });
  });

  it('describes starting a mega bug fix, with a strict body and no 404', () => {
    const post = document.paths?.['/api/v1/mega-bug-fixes']?.post;
    expect(post?.requestBody).toBeDefined();
    expect(Object.keys(post?.responses ?? {}).sort()).toEqual(['202', '401', '403', '422', '500']);
    const body = JSON.stringify(post?.requestBody);
    expect(body).toContain('"additionalProperties":false');
    expect(body).toContain('"maxLength":181');
  });

  it('is what GET /api/v1/openapi.json answers, with no key', async () => {
    const answer = GET();
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual(JSON.parse(JSON.stringify(document)));
  });
});
