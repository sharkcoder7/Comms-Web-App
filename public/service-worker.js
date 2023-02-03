// This is a no-op service worker which just deactivates and
// unregisters a previous service worker of the same name

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  self.registration
    .unregister()
    .then(() =>
      self.clients.matchAll({
        type: "window",
      }),
    )
    .then((windowClients) => {
      windowClients.forEach((windowClient) =>
        windowClient.navigate(windowClient.url),
      );
    });
});
