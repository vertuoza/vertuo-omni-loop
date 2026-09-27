// The before/after page, served on its own route, /prd/<id>/v/<version>/page (PRD 216's spec, "The
// pages"; decision 9). It is HTML someone else's Claude wrote, so it never runs on the galaxy's origin:
// the route answers with a sandbox policy (an anonymous origin, so no cookies and no storage of the
// galaxy's; no request anywhere, so no network) and nosniff, and the page shows it in an iframe that
// allows scripts and nothing else. The policy holds even when the route is opened on its own. A viewer
// who may not read the dossier gets not found, the same for a version that does not exist.

/** The route's Content-Security-Policy, exactly as the spec writes it. */
export const SANDBOX_CSP =
  "sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:";

/** The iframe's sandbox: scripts, and no same origin, forms, pop-ups or top navigation. */
export const FRAME_SANDBOX = 'allow-scripts';

const HEADERS = {
  'content-security-policy': SANDBOX_CSP,
  'x-content-type-options': 'nosniff',
  // Behind a sign-in, and not found once the viewer signs out: never kept by a shared cache, or at all.
  'cache-control': 'private, no-store',
};

/** The page's answer: the HTML, or not found (null). */
export function sandboxedPage(content: string | null): Response {
  if (content === null) {
    return new Response('Not found', { status: 404, headers: { ...HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
  }
  return new Response(content, { status: 200, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' } });
}
