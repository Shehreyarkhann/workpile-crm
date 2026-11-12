import express from "express";
import path from "node:path";
import fs from "node:fs";
import { initSchema } from "./db.ts";
import { app, ingestBatch } from "./app.ts";
initSchema();
import("./worker.ts").then(w => w.startWorker()).catch(() => {});
import("./mail-sync.ts").then(ms => { const tick = () => ms.processMailSync((ws: string, actor: string, emails: any[]) => ingestBatch(ws, actor, emails)).catch(() => {}); setInterval(tick, 60000); setTimeout(tick, 15000); }).catch(() => {});
const PORT = Number(process.env.PORT || 4173);
const dist = path.join(process.cwd(), "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res, next) => { if (req.path.startsWith("/api") || req.path.startsWith("/v1")) return next(); res.sendFile(path.join(dist, "index.html")); });
}
app.listen(PORT, () => console.log(`Workpile listening on :${PORT}`));
