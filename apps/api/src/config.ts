import "dotenv/config";

export interface AppConfig {
  port: number;
  defaultCity: string;
  syncIntervalMs: number;
  damai: {
    appKey?: string;
    appSecret?: string;
    gateway: string;
  };
  defaultWebhookUrl?: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.API_PORT ?? 8787),
    defaultCity: process.env.DEFAULT_CITY ?? "成都",
    syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS ?? 10 * 60 * 1000),
    damai: {
      appKey: process.env.TOP_APP_KEY || undefined,
      appSecret: process.env.TOP_APP_SECRET || undefined,
      gateway: process.env.TOP_GATEWAY ?? "https://gw.api.taobao.com/router/rest"
    },
    defaultWebhookUrl: process.env.DEFAULT_WEBHOOK_URL || undefined
  };
}
