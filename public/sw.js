// Good Foreigner service worker: shows alert notifications, including Web Push alerts
// sent by the server when a risky email arrives while the app is closed.
// Deliberately no caching / offline logic.

const ICON = "/icon-192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Only same-origin paths ("/..." but not "//host") may be opened from a notification. */
function safePath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

/** Web Push payload { title, body, tag, url } → showNotification arguments. Never throws. */
function notificationFromPush(data) {
  let payload = {};
  if (data) {
    try {
      payload = data.json() || {};
    } catch {
      try {
        payload = { body: data.text() };
      } catch {
        payload = {};
      }
    }
  }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "Good Foreigner";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: ICON,
    badge: ICON,
    data: { url: safePath(payload.url) },
  };
  if (typeof payload.tag === "string" && payload.tag) options.tag = payload.tag;
  return { title, options };
}

self.addEventListener("push", (event) => {
  // userVisibleOnly: every push must show a notification.
  const { title, options } = notificationFromPush(event.data);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target.href);
      return undefined;
    })(),
  );
});
