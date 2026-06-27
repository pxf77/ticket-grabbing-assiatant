import crypto from "node:crypto";
import { NormalizedEvent, parsePriceRange, stableHash } from "@chengdu-ticket-assistant/shared";
import { AppConfig } from "../config.js";

const DAMAI_SEARCH_METHOD = "alibaba.damai.ec.search.project.search";

interface TopParams {
  [key: string]: string | number | undefined;
}

function cnTimestamp(): string {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  return formatter.format(new Date()).replace("T", " ");
}

export function signTopRequest(params: TopParams, appSecret: string): string {
  const canonical = Object.entries(params)
    .filter(([key, value]) => key !== "sign" && value !== undefined && String(value) !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}${value}`)
    .join("");

  return crypto
    .createHash("md5")
    .update(`${appSecret}${canonical}${appSecret}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

function statusFromDamai(value: unknown): NormalizedEvent["status"] {
  const status = String(value ?? "");
  if (status === "3" || /售票中|在售/.test(status)) return "on_sale";
  if (/即将|预售|待售/.test(status)) return "coming_soon";
  if (/售罄|缺货/.test(status)) return "sold_out";
  if (/取消/.test(status)) return "cancelled";
  return "unknown";
}

function pickText(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return undefined;
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  const candidates: unknown[] = [
    payload,
    (payload as any)?.alibaba_damai_ec_search_project_search_response,
    (payload as any)?.result,
    (payload as any)?.data,
    (payload as any)?.projects,
    (payload as any)?.project_list,
    (payload as any)?.alibaba_damai_ec_search_project_search_response?.result,
    (payload as any)?.alibaba_damai_ec_search_project_search_response?.result?.project_list,
    (payload as any)?.alibaba_damai_ec_search_project_search_response?.result?.data
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
    if (candidate && typeof candidate === "object") {
      for (const value of Object.values(candidate as Record<string, unknown>)) {
        if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
      }
    }
  }

  return [];
}

export class DamaiSearchProvider {
  constructor(private readonly config: AppConfig["damai"]) {}

  get enabled(): boolean {
    return Boolean(this.config.appKey && this.config.appSecret);
  }

  async search(cityName: string, page = 1): Promise<NormalizedEvent[]> {
    if (!this.enabled) return [];

    const businessParam = {
      category_name: "演唱会|音乐会|话剧歌剧|舞蹈芭蕾|曲苑杂坛",
      filter_city_name: cityName,
      page_number: page,
      page_size: 30,
      sort_type: 1,
      date_type: 0,
      channel: "10001|10002|10003"
    };

    const params: TopParams = {
      method: DAMAI_SEARCH_METHOD,
      app_key: this.config.appKey,
      timestamp: cnTimestamp(),
      format: "json",
      v: "2.0",
      sign_method: "md5",
      param: JSON.stringify(businessParam)
    };

    params.sign = signTopRequest(params, this.config.appSecret!);

    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) body.set(key, String(value));
    }

    const response = await fetch(this.config.gateway, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
      body,
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      throw new Error(`Damai search request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    return extractRows(payload).map((row) => this.normalize(row, cityName));
  }

  normalize(raw: Record<string, unknown>, cityName: string): NormalizedEvent {
    const providerEventId =
      pickText(raw, ["project_id", "projectId", "id", "item_id", "itemId"]) ?? stableHash(raw);
    const title = pickText(raw, ["project_name", "projectName", "name", "title"]) ?? "未命名演出";
    const priceText = pickText(raw, ["price_str", "priceText", "price", "price_low_high"]);
    const officialUrl = pickText(raw, ["buy_url", "buyUrl", "url", "detail_url"]) ?? "https://detail.damai.cn/";
    const priceRange = parsePriceRange(priceText);

    return {
      id: `damai_${providerEventId}`,
      provider: "damai",
      providerEventId,
      title,
      cityName: pickText(raw, ["city_name", "cityName", "city"]) ?? cityName,
      venueName: pickText(raw, ["venue_name", "venueName", "venue"]),
      categoryName: pickText(raw, ["category_name", "categoryName", "category"]),
      showTimeText: pickText(raw, ["show_time", "showTime", "perform_time", "performTime"]),
      saleStartTime: pickText(raw, ["sale_start_time", "saleStartTime", "sell_start_time"]),
      status: statusFromDamai(pickText(raw, ["site_status", "siteStatus", "status", "status_name"])),
      priceText,
      ...priceRange,
      officialUrl,
      isSelectableSeat: ["true", "1", "yes"].includes(
        String(pickText(raw, ["is_selectable_seat", "selectableSeat", "isSeatSelectable"]) ?? "").toLowerCase()
      ),
      rawPayloadHash: stableHash(raw),
      updatedAt: new Date().toISOString()
    };
  }
}
