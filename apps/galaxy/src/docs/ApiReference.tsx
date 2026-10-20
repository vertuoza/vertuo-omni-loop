'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

// The API reference (PRD 2022 s3): Scalar's viewer over GET /api/v1/openapi.json, every route with its
// parameters, responses and examples. It runs in the browser only; the document is the site's own, so
// nothing leaves it. Rendered by app/docs/api/page.tsx, inside the docs layout. Scalar's own stylesheet
// draws it (#2092: without it every control fell back to the browser's defaults), with its theme off:
// docs.css maps its colours to the docs tokens, so it follows the theme switch.

/** Where the OpenAPI document is served (app/api/v1/openapi.json/route.ts). */
const OPENAPI_PATH = '/api/v1/openapi.json';

export function ApiReference() {
  return (
    <div className="docs-api-reference">
      <ApiReferenceReact configuration={{ url: OPENAPI_PATH, theme: 'none', hideDarkModeToggle: true, withDefaultFonts: false, layout: 'modern' }} />
    </div>
  );
}
