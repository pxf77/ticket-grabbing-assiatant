import express from "express";
import { z } from "zod";
import { InMemoryStore } from "./data/store.js";
import { normalizeManualEvent } from "./providers/manual.js";
import { Scheduler } from "./services/scheduler.js";
import { Notifier } from "./services/notifier.js";

const ruleSchema = z.object({
  name: z.string().min(1),
  cityName: z.string().default("成都"),
  keywords: z.array(z.string()).default([]),
  artists: z.array(z.string()).default([]),
  venues: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  notifyOffsetsSeconds: z.array(z.number().int().positive()).default([86400, 1800, 600, 60, 10]),
  enabled: z.boolean().default(true)
});

const manualEventSchema = z.object({
  title: z.string().min(1),
  cityName: z.string().default("成都"),
  venueName: z.string().optional(),
  categoryName: z.string().optional(),
  showTimeText: z.string().optional(),
  saleStartTime: z.string().optional(),
  status: z.enum(["announced", "coming_soon", "on_sale", "sold_out", "cancelled", "unknown"]).default("unknown"),
  priceText: z.string().optional(),
  officialUrl: z.string().url()
});

const channelSchema = z.object({
  channelType: z.enum(["browser", "webhook", "email", "wecom", "dingtalk", "telegram"]),
  channelName: z.string().min(1),
  endpoint: z.string().optional(),
  enabled: z.boolean().default(true)
});

export function createRouter(store: InMemoryStore, scheduler: Scheduler, notifier: Notifier): express.Router {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "chengdu-ticket-assistant-api" });
  });

  router.get("/api/events", (req, res) => {
    res.json(
      store.listEvents({
        cityName: typeof req.query.cityName === "string" ? req.query.cityName : undefined,
        keyword: typeof req.query.keyword === "string" ? req.query.keyword : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined
      })
    );
  });

  router.post("/api/events/manual", (req, res) => {
    const input = manualEventSchema.parse(req.body);
    const event = store.createManualEvent(normalizeManualEvent(input));
    res.status(201).json(event);
  });

  router.get("/api/watch-rules", (_req, res) => {
    res.json(store.listRules());
  });

  router.post("/api/watch-rules", (req, res) => {
    const rule = store.createRule(ruleSchema.parse(req.body));
    scheduler.reconcileRules(store.listEvents({ cityName: rule.cityName }), [rule]);
    res.status(201).json(rule);
  });

  router.patch("/api/watch-rules/:id", (req, res) => {
    const rule = store.updateRule(req.params.id, ruleSchema.partial().parse(req.body));
    if (!rule) return res.status(404).json({ error: "watch rule not found" });
    scheduler.reconcileRules(store.listEvents({ cityName: rule.cityName }), [rule]);
    return res.json(rule);
  });

  router.get("/api/notification-channels", (_req, res) => {
    res.json(store.listChannels());
  });

  router.post("/api/notification-channels", (req, res) => {
    const channel = store.createChannel(channelSchema.parse(req.body));
    const { endpoint: _endpoint, ...safeChannel } = channel;
    res.status(201).json(safeChannel);
  });

  router.post("/api/notification-channels/:id/test", async (req, res) => {
    const job = store.createNotificationJob({
      eventId: "test",
      channelType: "browser",
      scheduledFor: new Date().toISOString(),
      dedupeKey: `test:${Date.now()}`,
      payload: {
        title: "测试提醒",
        venueName: "成都",
        status: "test",
        officialUrl: "https://detail.damai.cn/",
        offsetSeconds: 0
      }
    });
    await notifier.send(job);
    store.updateJobStatus(job.id, "sent");
    res.json({ ok: true });
  });

  router.get("/api/countdown/:eventId", (req, res) => {
    const view = store.countdownView(req.params.eventId);
    if (!view) return res.status(404).json({ error: "event not found" });
    return res.json(view);
  });

  router.post("/api/provider/sync", async (_req, res) => {
    res.json(await scheduler.syncOnce());
  });

  router.post("/api/purchase-sessions", (req, res) => {
    const schema = z.object({ eventId: z.string().min(1) });
    const { eventId } = schema.parse(req.body);
    if (!store.getEvent(eventId)) return res.status(404).json({ error: "event not found" });
    return res.status(201).json(store.createPurchaseSession(eventId));
  });

  router.post("/api/purchase-sessions/:id/result", (req, res) => {
    const schema = z.object({
      purchaseResult: z.enum(["success", "failed", "abandoned", "unknown"]),
      failureReasonCode: z.string().optional(),
      failureNote: z.string().optional()
    });
    const session = store.updatePurchaseSession(req.params.id, schema.parse(req.body));
    if (!session) return res.status(404).json({ error: "purchase session not found" });
    return res.json(session);
  });

  return router;
}
