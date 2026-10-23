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

  it('describes starting a mega bug fix, with a strict body and no 404', () => {
    const post = document.paths?.['/api/v1/mega-bug-fixes']?.post;
    expect(post?.requestBody).toBeDefined();
    expect(Object.keys(post?.responses ?? {}).sort()).toEqual(['202', '401', '403', '422', '500']);
    const body = JSON.stringify(post?.requestBody);
    expect(body).toContain('"additionalProperties":false');
    expect(body).toContain('"maxLength":181');
  });

  it('lists the two refusals of a key whose GitHub App cannot run the job, in the error shape and on both starts (PRD 2433 s6)', () => {
    const shape = JSON.stringify(document.paths?.['/api/v1/prds']?.get?.responses?.['401']);
    expect(shape).toContain('"enum":["unauthorized","forbidden","not_found","invalid_request","github_app_not_installed","github_app_permissions","internal"]');
    const described = (response: unknown): string => {
      const text = typeof response === 'object' && response !== null && 'description' in response ? response.description : '';
      return typeof text === 'string' ? text : '';
    };
    for (const path of ['/api/v1/bug-fixes', '/api/v1/mega-bug-fixes']) {
      const post = document.paths?.[path]?.post;
      const answer = described(post?.responses?.['422']);
      expect(answer, path).toContain('github_app_not_installed');
      expect(answer, path).toContain('github_app_permissions');
      expect(post?.description, path).toContain('nothing is queued');
    }
    for (const path of ['/api/v1/prds', '/api/v1/bug-fixes']) {
      expect(described(document.paths?.[path]?.get?.responses?.['422']), path).not.toContain('github_app');
    }
  });

  it('is what GET /api/v1/openapi.json answers, with no key', async () => {
    const answer = GET();
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual(JSON.parse(JSON.stringify(document)));
  });
});
