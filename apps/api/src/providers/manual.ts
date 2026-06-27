import { NormalizedEvent, parsePriceRange, stableHash } from "@chengdu-ticket-assistant/shared";

export interface ManualEventInput {
  title: string;
  cityName: string;
  venueName?: string;
  categoryName?: string;
  showTimeText?: string;
  saleStartTime?: string;
  status?: NormalizedEvent["status"];
  priceText?: string;
  officialUrl: string;
}

export function normalizeManualEvent(input: ManualEventInput): Omit<
  NormalizedEvent,
  "id" | "provider" | "providerEventId" | "rawPayloadHash" | "updatedAt"
> {
  if (!/^https:\/\//.test(input.officialUrl)) {
    throw new Error("officialUrl must be an HTTPS official ticketing link");
  }

  return {
    title: input.title,
    cityName: input.cityName,
    venueName: input.venueName,
    categoryName: input.categoryName,
    showTimeText: input.showTimeText,
    saleStartTime: input.saleStartTime,
    status: input.status ?? "unknown",
    priceText: input.priceText,
    ...parsePriceRange(input.priceText),
    officialUrl: input.officialUrl,
    isSelectableSeat: false
  };
}

export function manualPayloadHash(input: ManualEventInput): string {
  return stableHash(input);
}
