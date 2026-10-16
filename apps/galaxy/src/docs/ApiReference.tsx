'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';

// The API reference (PRD 2022 s3): Scalar's viewer over GET /api/v1/openapi.json, every route with its
// parameters, responses and examples. It runs in the browser only; the document is the site's own, so
// nothing leaves it. Rendered by app/docs/api/page.tsx, inside the docs layout.

/** Where the OpenAPI document is served (app/api/v1/openapi.json/route.ts). */
const OPENAPI_PATH = '/api/v1/openapi.json';

export function ApiReference() {
  return (
    <div className="docs-api-reference">
      <ApiReferenceReact configuration={{ url: OPENAPI_PATH, hideDarkModeToggle: true, withDefaultFonts: false, layout: 'modern' }} />
    </div>
  );
}
