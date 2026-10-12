import { WORKER_SCOPE } from './device';

// The Omni page's service worker (PRD 1322 s9), as the source GET /api/push/sw.js serves: the browser
// runs it, not Node, and the repository keeps no JavaScript source file, so it is held here as text.
// The Phone alerts switch on a person's profile registers it with the site's root as its scope (the
// route allows that with `Service-Worker-Allowed: /`), so this device receives Web Push.
//
// A push carries JSON `{title, body, url}`: it is shown as one notification, and a tap opens `url` on
// this site (the PRD's approve screen), focusing a tab already on it. A push it cannot read still
// shows a notification, as browsers require, and a url off this site opens the app instead. It caches
// nothing and serves no request: taking alerts back later is this text emptied of its handlers.

export const WORKER_SOURCE = String.raw`'use strict';
const FALLBACK = { title: 'Omni Loop', body: 'A PRD waits for your approval.', url: '/app' };
const here = (path) => new URL(path, self.location.origin);

function readPush(data) {
  let sent = {};
  try {
    sent = (data && data.json()) || {};
  } catch {
    sent = {};
  }
  const text = (value, otherwise) => (typeof value === 'string' && value.trim() ? value : otherwise);
  let url = here(FALLBACK.url);
  try {
    url = here(text(sent.url, FALLBACK.url));
  } catch {
    url = here(FALLBACK.url);
  }
  return {
    title: text(sent.title, FALLBACK.title),
    body: text(sent.body, FALLBACK.body),
    url: url.origin === self.location.origin ? url.href : here(FALLBACK.url).href,
  };
}

self.addEventListener('push', (event) => {
  const push = readPush(event.data);
  event.waitUntil(self.registration.showNotification(push.title, { body: push.body, data: { url: push.url }, icon: '/icon' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || here(FALLBACK.url).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = tabs.find((tab) => tab.url === url);
    return open ? open.focus() : self.clients.openWindow(url);
  })());
});
`;

/** The worker, as GET /api/push/sw.js answers it: JavaScript, allowed the whole site, never cached long. */
export function workerResponse(): Response {
  return new Response(WORKER_SOURCE, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'service-worker-allowed': WORKER_SCOPE,
      'cache-control': 'no-cache',
    },
  });
}
