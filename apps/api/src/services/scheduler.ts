import { NormalizedEvent, WatchRule } from "@chengdu-ticket-assistant/shared";
import { AppConfig } from "../config.js";
import { InMemoryStore } from "../data/store.js";
import { DamaiSearchProvider } from "../providers/damai.js";
import { buildNotificationDedupeKey, computeScheduledTime, matchRule } from "./rule-engine.js";
import { Notifier } from "./notifier.js";

export class Scheduler {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: AppConfig,
    private readonly store: InMemoryStore,
    private readonly provider: DamaiSearchProvider,
    private readonly notifier: Notifier
  ) {}

  start(): void {
    void this.syncOnce();
    this.timer = setInterval(() => {
      void this.syncOnce();
      void this.deliverDueNotifications();
    }, this.config.syncIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async syncOnce(): Promise<{ inserted: number; updated: number; providerEnabled: boolean }> {
    let providerEvents: NormalizedEvent[] = [];

    if (this.provider.enabled) {
      try {
        providerEvents = await this.provider.search(this.config.defaultCity, 1);
      } catch (error) {
        console.warn("Provider sync failed. Keeping existing local data.", error);
      }
    }

    const result = this.store.upsertEvents(providerEvents);
    this.reconcileRules(this.store.listEvents({ cityName: this.config.defaultCity }), this.store.listRules());
    return { ...result, providerEnabled: this.provider.enabled };
  }

  reconcileRules(events: NormalizedEvent[], rules: WatchRule[]): void {
    for (const event of events) {
      for (const rule of rules) {
        const reason = matchRule(event, rule);
        if (!reason || !event.saleStartTime) continue;

        for (const offsetSeconds of rule.notifyOffsetsSeconds) {
          const scheduledFor = computeScheduledTime(event.saleStartTime, offsetSeconds);
          if (scheduledFor.getTime() < Date.now() - 60_000) continue;

          this.store.createNotificationJob({
            eventId: event.id,
            watchRuleId: rule.id,
            channelType: "browser",
            scheduledFor: scheduledFor.toISOString(),
            dedupeKey: buildNotificationDedupeKey(event, rule, offsetSeconds),
            payload: {
              title: event.title,
              venueName: event.venueName,
              status: event.status,
              officialUrl: event.officialUrl,
              offsetSeconds,
              reason
            }
          });
        }
      }
    }
  }

  async deliverDueNotifications(): Promise<void> {
    const dueJobs = this.store.listDueJobs();
    for (const job of dueJobs) {
      try {
        await this.notifier.send(job);
        this.store.updateJobStatus(job.id, "sent");
      } catch (error) {
        console.warn("Notification delivery failed.", error);
        this.store.updateJobStatus(job.id, "failed");
      }
    }
  }
}
