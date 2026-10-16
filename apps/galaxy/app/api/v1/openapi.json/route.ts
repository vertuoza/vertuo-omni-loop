import { openApiDocument } from '../../../../src/public-api/openapi';

// GET /api/v1/openapi.json → 200 the OpenAPI 3.1 reference, with no key (src/public-api/openapi.ts,
// PRD 2022 s3). Built once, at build time: it reads no session, cookie or database.
export const dynamic = 'force-static';

export function GET() {
  return Response.json(openApiDocument());
}
