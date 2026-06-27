import { InMemoryStore } from "../data/store.js";
import { NotificationChannel, NotificationJob } from "@chengdu-ticket-assistant/shared";

export class Notifier {
  constructor(private readonly store: InMemoryStore) {}

  async send(job: NotificationJob): Promise<void> {
    const channels = this.store
      .listChannels(job.userId)
      .filter((channel) => channel.enabled && channel.channelType === job.channelType);

    if (channels.length === 0 && job.channelType === "browser") {
      console.log("[notification:browser]", job.payload);
      return;
    }

    for (const channel of channels) {
      await this.sendToChannel(channel, job);
    }
  }

  private async sendToChannel(channel: NotificationChannel, job: NotificationJob): Promise<void> {
    const payload = {
      msgtype: "markdown",
      markdown: {
        title: "成都演出提醒",
        text: this.renderMarkdown(job)
      },
      raw: job.payload
    };

    if (channel.channelType === "webhook" && channel.endpoint) {
      const response = await fetch(channel.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8_000)
      });
      if (!response.ok) throw new Error(`Webhook notification failed: ${response.status}`);
      return;
    }

    console.log(`[notification:${channel.channelType}]`, payload);
  }

  private renderMarkdown(job: NotificationJob): string {
    const title = String(job.payload.title ?? "未命名演出");
    const venue = String(job.payload.venueName ?? "未知场馆");
    const status = String(job.payload.status ?? "未知状态");
    const url = String(job.payload.officialUrl ?? "");
    const seconds = Number(job.payload.offsetSeconds ?? 0);
    const label = seconds > 0 ? `开售前 ${Math.round(seconds / 60)} 分钟` : "开售时间到";

    return [
      `## ${label}`,
      "",
      `- 项目：${title}`,
      `- 场馆：${venue}`,
      `- 状态：${status}`,
      `- 官方链接：${url}`,
      "",
      "请在官方平台手动完成登录、实名信息确认、选票和支付。"
    ].join("\n");
  }
}
