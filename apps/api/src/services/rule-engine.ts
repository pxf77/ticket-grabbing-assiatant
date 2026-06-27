import { MatchReason, NormalizedEvent, WatchRule } from "@chengdu-ticket-assistant/shared";

function includesAny(haystack: string | undefined, needles: string[]): string[] {
  if (!haystack || needles.length === 0) return [];
  const lower = haystack.toLowerCase();
  return needles.filter((needle) => lower.includes(needle.toLowerCase()));
}

export function matchRule(event: NormalizedEvent, rule: WatchRule): MatchReason | undefined {
  if (!rule.enabled) return undefined;
  if (rule.cityName && event.cityName !== rule.cityName) return undefined;

  const keywordMatches = includesAny(
    [event.title, event.venueName, event.categoryName].filter(Boolean).join(" "),
    rule.keywords
  );
  const artistMatches = includesAny(event.title, rule.artists);
  const venueMatches = includesAny(event.venueName, rule.venues);
  const categoryMatches = includesAny(event.categoryName, rule.categories);

  const hasTextCriteria =
    rule.keywords.length > 0 || rule.artists.length > 0 || rule.venues.length > 0 || rule.categories.length > 0;
  const hasTextMatch =
    keywordMatches.length > 0 || artistMatches.length > 0 || venueMatches.length > 0 || categoryMatches.length > 0;

  if (hasTextCriteria && !hasTextMatch) return undefined;

  const minOk = rule.minPrice === undefined || event.maxPrice === undefined || event.maxPrice >= rule.minPrice;
  const maxOk = rule.maxPrice === undefined || event.minPrice === undefined || event.minPrice <= rule.maxPrice;
  if (!minOk || !maxOk) return undefined;

  return {
    city: true,
    keyword: keywordMatches,
    artist: artistMatches,
    venue: venueMatches,
    category: categoryMatches,
    price: true
  };
}

export function buildNotificationDedupeKey(event: NormalizedEvent, rule: WatchRule, offsetSeconds: number): string {
  return `${event.id}:${rule.id}:${offsetSeconds}`;
}

export function computeScheduledTime(saleStartTime: string, offsetSeconds: number): Date {
  return new Date(new Date(saleStartTime).getTime() - offsetSeconds * 1000);
}
