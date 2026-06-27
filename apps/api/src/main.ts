import cors from "cors";
import express from "express";
import { loadConfig } from "./config.js";
import { InMemoryStore } from "./data/store.js";
import { DamaiSearchProvider } from "./providers/damai.js";
import { Notifier } from "./services/notifier.js";
import { Scheduler } from "./services/scheduler.js";
import { createRouter } from "./routes.js";

const config = loadConfig();
const store = new InMemoryStore(config.defaultWebhookUrl);
const provider = new DamaiSearchProvider(config.damai);
const notifier = new Notifier(store);
const scheduler = new Scheduler(config, store, provider, notifier);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(createRouter(store, scheduler, notifier));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "unknown error";
  res.status(400).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Chengdu ticket assistant API listening on :${config.port}`);
  console.log(provider.enabled ? "Damai provider enabled." : "Damai provider disabled; using sample/manual data.");
  scheduler.start();
});
