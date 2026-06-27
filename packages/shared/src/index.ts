export type EventStatus =
  | "announced"
  | "coming_soon"
  | "on_sale"
  | "sold_out"
  | "cancelled"
  | "unknown";

export interface NormalizedEvent {
  id: string;
  provider: "damai" | "manual" | "sample";
  providerEventId: string;
  title: string;
  cityName: string;
  venueName?: string;
  categoryName?: string;
  showTimeText?: string;
  saleStartTime?: string;
  status: EventStatus;
  priceText?: string;
  minPrice?: number;
  maxPrice?: number;
  officialUrl: string;
  isSelectableSeat?: boolean;
  rawPayloadHash: string;
  updatedAt: string;
}

export interface WatchRule {
  id: string;
  userId: string;
  name: string;
  cityName: string;
  keywords: string[];
  artists: string[];
  venues: string[];
  categories: string[];
  minPrice?: number;
  maxPrice?: number;
  notifyOffsetsSeconds: number[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationChannel {
  id: string;
  userId: string;
  channelType: "browser" | "webhook" | "email" | "wecom" | "dingtalk" | "telegram";
  channelName: string;
  endpointMasked?: string;
  endpoint?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationJob {
  id: string;
  userId: string;
  eventId: string;
  watchRuleId?: string;
  channelType: NotificationChannel["channelType"];
  scheduledFor: string;
  dedupeKey: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseSession {
  id: string;
  userId: string;
  eventId: string;
  openedOfficialAt?: string;
  userConfirmedReadyAt?: string;
  purchaseResult?: "success" | "failed" | "abandoned" | "unknown";
  failureReasonCode?: string;
  failureNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CountdownView {
  event: NormalizedEvent;
  secondsLeft?: number;
  checklist: string[];
  safetyNotice: string;
}

export interface MatchReason {
  city?: boolean;
  keyword?: string[];
  artist?: string[];
  venue?: string[];
  category?: string[];
  price?: boolean;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function stableHash(input: unknown): string {
  const value = typeof input === "string" ? input : JSON.stringify(input);
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function parsePriceRange(priceText?: string): { minPrice?: number; maxPrice?: number } {
  if (!priceText) return {};
  const values = Array.from(priceText.matchAll(/\d+(?:\.\d+)?/g)).map((item) => Number(item[0]));
  if (values.length === 0) return {};
  return { minPrice: Math.min(...values), maxPrice: Math.max(...values) };
}

export function maskSecret(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}
