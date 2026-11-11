self.addEventListener("push", (e) => {
  let d = { title: "Workpile", body: "" };
  try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title || "Workpile", { body: d.body || "", icon: "/icon.svg", data: { url: d.url || "/app" } }));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data?.url || "/app")); });
