import type { CountdownView, NormalizedEvent, WatchRule } from "@chengdu-ticket-assistant/shared";

const jsonHeaders = { "content-type": "application/json" };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listEvents(): Promise<NormalizedEvent[]> {
  return request<NormalizedEvent[]>("/api/events?cityName=成都");
}

export function createManualEvent(input: Partial<NormalizedEvent>): Promise<NormalizedEvent> {
  return request<NormalizedEvent>("/api/events/manual", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input)
  });
}

export function listRules(): Promise<WatchRule[]> {
  return request<WatchRule[]>("/api/watch-rules");
}

export function createRule(input: Partial<WatchRule>): Promise<WatchRule> {
  return request<WatchRule>("/api/watch-rules", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input)
  });
}

export function getCountdown(eventId: string): Promise<CountdownView> {
  return request<CountdownView>(`/api/countdown/${eventId}`);
}

export function startPurchaseSession(eventId: string): Promise<{ id: string }> {
  return request<{ id: string }>("/api/purchase-sessions", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ eventId })
  });
}

export function submitPurchaseResult(
  sessionId: string,
  input: { purchaseResult: string; failureReasonCode?: string; failureNote?: string }
): Promise<unknown> {
  return request(`/api/purchase-sessions/${sessionId}/result`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input)
  });
}
