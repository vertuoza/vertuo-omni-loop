// The Omni page's service worker (PRD 1322 s9), registered by the Phone alerts switch on a person's
// profile so this device receives Web Push. A push carries JSON `{title, body, url}`: it is shown as
// one notification, and a tap opens `url` on this site (the PRD's approve screen), focusing a tab
// already on it. A push it cannot read still shows a notification, as the browser requires.
// It caches nothing and serves no request: removing alerts later is this file emptied of its handlers.

const FALLBACK = { title: 'Omni Loop', body: 'A PRD waits for your approval.', url: '/app' };

/** The push's JSON, kept to strings, its url to this site; the fallback for what it lacks. */
function readPush(data) {
  let sent = {};
  try {
    sent = data ? data.json() : {};
  } catch {
    sent = {};
  }
  const text = (value, otherwise) => (typeof value === 'string' && value.trim() ? value : otherwise);
  const url = new URL(text(sent && sent.url, FALLBACK.url), self.location.origin);
  return {
    title: text(sent && sent.title, FALLBACK.title),
    body: text(sent && sent.body, FALLBACK.body),
    url: url.origin === self.location.origin ? url.href : new URL(FALLBACK.url, self.location.origin).href,
  };
}

self.addEventListener('push', (event) => {
  const push = readPush(event.data);
  event.waitUntil(self.registration.showNotification(push.title, { body: push.body, data: { url: push.url }, icon: '/icon' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || new URL(FALLBACK.url, self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = tabs.find((tab) => tab.url === url);
    if (open) return open.focus();
    return self.clients.openWindow(url);
  })());
});
