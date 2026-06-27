import {
  CountdownView,
  maskSecret,
  NormalizedEvent,
  NotificationChannel,
  NotificationJob,
  nowIso,
  PurchaseSession,
  stableHash,
  WatchRule
} from "@chengdu-ticket-assistant/shared";

const LOCAL_USER_ID = "local-user";

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const sampleEvents: NormalizedEvent[] = [
  {
    id: "sample_chengdu_001",
    provider: "sample",
    providerEventId: "chengdu-001",
    title: "成都夏夜演唱会",
    cityName: "成都",
    venueName: "成都东安湖体育公园",
    categoryName: "演唱会",
    showTimeText: "2026-07-01 19:30",
    saleStartTime: "2026-07-01T12:00:00+08:00",
    status: "coming_soon",
    priceText: "¥380-1680",
    minPrice: 380,
    maxPrice: 1680,
    officialUrl: "https://detail.damai.cn/",
    isSelectableSeat: false,
    rawPayloadHash: stableHash("sample_chengdu_001"),
    updatedAt: nowIso()
  },
  {
    id: "sample_chengdu_002",
    provider: "sample",
    providerEventId: "chengdu-002",
    title: "成都周末 Livehouse 专场",
    cityName: "成都",
    venueName: "成都露天音乐公园",
    categoryName: "音乐会",
    showTimeText: "2026-07-05 20:00",
    saleStartTime: "2026-06-28T10:00:00+08:00",
    status: "on_sale",
    priceText: "¥280-580",
    minPrice: 280,
    maxPrice: 580,
    officialUrl: "https://detail.damai.cn/",
    isSelectableSeat: false,
    rawPayloadHash: stableHash("sample_chengdu_002"),
    updatedAt: nowIso()
  }
];

export class InMemoryStore {
  private events = new Map<string, NormalizedEvent>();
  private rules = new Map<string, WatchRule>();
  private channels = new Map<string, NotificationChannel>();
  private jobs = new Map<string, NotificationJob>();
  private sessions = new Map<string, PurchaseSession>();

  constructor(defaultWebhookUrl?: string) {
    for (const event of sampleEvents) this.events.set(event.id, event);
    if (defaultWebhookUrl) {
      const now = nowIso();
      this.channels.set("default_webhook", {
        id: "default_webhook",
        userId: LOCAL_USER_ID,
        channelType: "webhook",
        channelName: "默认 Webhook",
        endpoint: defaultWebhookUrl,
        endpointMasked: maskSecret(defaultWebhookUrl),
        enabled: true,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  get userId(): string {
    return LOCAL_USER_ID;
  }

  listEvents(filters: { cityName?: string; keyword?: string; status?: string } = {}): NormalizedEvent[] {
    return Array.from(this.events.values())
      .filter((event) => !filters.cityName || event.cityName === filters.cityName)
      .filter((event) => !filters.status || event.status === filters.status)
      .filter((event) => {
        if (!filters.keyword) return true;
        const keyword = filters.keyword.toLowerCase();
        return [event.title, event.venueName, event.categoryName].filter(Boolean).some((item) =>
          String(item).toLowerCase().includes(keyword)
        );
      })
      .sort((left, right) => String(left.saleStartTime ?? "").localeCompare(String(right.saleStartTime ?? "")));
  }

  getEvent(id: string): NormalizedEvent | undefined {
    return this.events.get(id);
  }

  upsertEvents(events: NormalizedEvent[]): { inserted: number; updated: number } {
    let inserted = 0;
    let updated = 0;
    for (const event of events) {
      const existing = this.events.get(event.id);
      if (!existing) {
        inserted += 1;
      } else if (existing.rawPayloadHash !== event.rawPayloadHash || existing.status !== event.status) {
        updated += 1;
      }
      this.events.set(event.id, { ...existing, ...event, updatedAt: nowIso() });
    }
    return { inserted, updated };
  }

  createManualEvent(input: Omit<NormalizedEvent, "id" | "provider" | "providerEventId" | "rawPayloadHash" | "updatedAt">): NormalizedEvent {
    const id = createId("manual");
    const event: NormalizedEvent = {
      ...input,
      id,
      provider: "manual",
      providerEventId: id,
      rawPayloadHash: stableHash(input),
      updatedAt: nowIso()
    };
    this.events.set(event.id, event);
    return event;
  }

  listRules(userId = LOCAL_USER_ID): WatchRule[] {
    return Array.from(this.rules.values()).filter((rule) => rule.userId === userId);
  }

  createRule(input: Omit<WatchRule, "id" | "userId" | "createdAt" | "updatedAt">): WatchRule {
    const now = nowIso();
    const rule: WatchRule = {
      ...input,
      id: createId("rule"),
      userId: LOCAL_USER_ID,
      createdAt: now,
      updatedAt: now
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  updateRule(id: string, patch: Partial<WatchRule>): WatchRule | undefined {
    const current = this.rules.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, id, userId: current.userId, updatedAt: nowIso() };
    this.rules.set(id, next);
    return next;
  }

  listChannels(userId = LOCAL_USER_ID): NotificationChannel[] {
    return Array.from(this.channels.values()).filter((channel) => channel.userId === userId);
  }

  createChannel(input: Omit<NotificationChannel, "id" | "userId" | "createdAt" | "updatedAt" | "endpointMasked">): NotificationChannel {
    const now = nowIso();
    const channel: NotificationChannel = {
      ...input,
      id: createId("channel"),
      userId: LOCAL_USER_ID,
      endpointMasked: maskSecret(input.endpoint),
      createdAt: now,
      updatedAt: now
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  createNotificationJob(input: Omit<NotificationJob, "id" | "userId" | "status" | "createdAt" | "updatedAt">): NotificationJob {
    const existing = Array.from(this.jobs.values()).find((job) => job.dedupeKey === input.dedupeKey);
    if (existing) return existing;

    const now = nowIso();
    const job: NotificationJob = {
      ...input,
      id: createId("job"),
      userId: LOCAL_USER_ID,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    return job;
  }

  listDueJobs(now = new Date()): NotificationJob[] {
    return Array.from(this.jobs.values()).filter((job) => job.status === "pending" && new Date(job.scheduledFor) <= now);
  }

  updateJobStatus(id: string, status: NotificationJob["status"]): void {
    const job = this.jobs.get(id);
    if (job) this.jobs.set(id, { ...job, status, updatedAt: nowIso() });
  }

  countdownView(eventId: string): CountdownView | undefined {
    const event = this.events.get(eventId);
    if (!event) return undefined;
    const secondsLeft = event.saleStartTime
      ? Math.max(0, Math.ceil((new Date(event.saleStartTime).getTime() - Date.now()) / 1000))
      : undefined;

    return {
      event,
      secondsLeft,
      checklist: [
        "已在官方票务平台手动登录",
        "已确认实名观演人信息",
        "已确认目标场次、票档和预算",
        "已准备支付方式",
        "已阅读官方退改签和入场规则"
      ],
      safetyNotice: "系统只打开官方链接并展示 checklist；购票动作必须由用户在官方平台手动完成。"
    };
  }

  createPurchaseSession(eventId: string): PurchaseSession {
    const now = nowIso();
    const session: PurchaseSession = {
      id: createId("session"),
      userId: LOCAL_USER_ID,
      eventId,
      openedOfficialAt: now,
      createdAt: now,
      updatedAt: now
    };
    this.sessions.set(session.id, session);
    return session;
  }

  updatePurchaseSession(id: string, patch: Partial<PurchaseSession>): PurchaseSession | undefined {
    const current = this.sessions.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, updatedAt: nowIso() };
    this.sessions.set(id, next);
    return next;
  }
}
