import { useEffect, useMemo, useState } from "react";
import type { CountdownView, NormalizedEvent, WatchRule } from "@chengdu-ticket-assistant/shared";
import {
  createRule,
  getCountdown,
  listEvents,
  listRules,
  startPurchaseSession,
  submitPurchaseResult
} from "./api";

const DEFAULT_RULE = {
  name: "成都演唱会提醒",
  cityName: "成都",
  keywords: ["演唱会"],
  artists: [],
  venues: [],
  categories: ["演唱会"],
  maxPrice: 1680,
  notifyOffsetsSeconds: [86400, 1800, 600, 60, 10],
  enabled: true
};

function formatSeconds(seconds?: number): string {
  if (seconds === undefined) return "待官方公布";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function useCountdown(eventId?: string) {
  const [view, setView] = useState<CountdownView | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function load() {
      const next = await getCountdown(eventId!);
      if (!cancelled) setView(next);
    }

    void load();
    const timer = setInterval(load, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

  return view;
}

export default function App() {
  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const [rules, setRules] = useState<WatchRule[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE);
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  async function refresh() {
    const [nextEvents, nextRules] = await Promise.all([listEvents(), listRules()]);
    setEvents(nextEvents);
    setRules(nextRules);
    setSelectedEventId((current) => current ?? nextEvents[0]?.id);
  }

  useEffect(() => {
    void refresh().catch((error) => setMessage(error.message));
  }, []);

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setMessage("当前浏览器不支持系统通知。");
      return;
    }
    const permission = await Notification.requestPermission();
    setMessage(permission === "granted" ? "通知权限已开启。" : "通知权限未开启，可继续使用页面内倒计时。");
  }

  async function handleCreateRule() {
    const rule = await createRule(ruleForm);
    setRules((current) => [rule, ...current]);
    setMessage("订阅规则已创建。建议开启浏览器通知并安装 PWA。");
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">成都演出 · 个人购票辅助驾驶</p>
          <h1>发现、提醒、倒计时、官方跳转。最后一步由你手动完成。</h1>
          <p className="hero-copy">
            系统不代管票务账号，不自动提交订单，不处理验证码，不绕过排队或风控。
          </p>
        </div>
        <div className="hero-actions">
          <button onClick={requestNotificationPermission}>开启通知</button>
          <button className="secondary" onClick={() => void refresh()}>
            刷新数据
          </button>
        </div>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="grid two">
        <div className="card">
          <div className="card-header">
            <h2>演出发现</h2>
            <span>{events.length} 个成都项目</span>
          </div>
          <div className="event-list">
            {events.map((event) => (
              <button
                key={event.id}
                className={event.id === selectedEvent?.id ? "event active" : "event"}
                onClick={() => setSelectedEventId(event.id)}
              >
                <strong>{event.title}</strong>
                <span>{event.venueName ?? "未知场馆"}</span>
                <span>
                  {event.priceText ?? "票价待定"} · {event.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>订阅规则</h2>
            <span>{rules.length} 条</span>
          </div>
          <label>
            规则名
            <input value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} />
          </label>
          <label>
            关键词，逗号分隔
            <input
              value={ruleForm.keywords.join(",")}
              onChange={(event) =>
                setRuleForm({ ...ruleForm, keywords: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })
              }
            />
          </label>
          <label>
            预算上限
            <input
              type="number"
              value={ruleForm.maxPrice}
              onChange={(event) => setRuleForm({ ...ruleForm, maxPrice: Number(event.target.value) })}
            />
          </label>
          <button onClick={() => void handleCreateRule()}>创建成都订阅</button>

          <div className="rules">
            {rules.map((rule) => (
              <div key={rule.id} className="rule">
                <strong>{rule.name}</strong>
                <span>{rule.keywords.join(" / ") || "全部成都演出"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {selectedEvent && <CountdownPanel event={selectedEvent} />}
    </main>
  );
}

function CountdownPanel({ event }: { event: NormalizedEvent }) {
  const view = useCountdown(event.id);
  const [armed, setArmed] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [openState, setOpenState] = useState<string>();
  const secondsLeft = view?.secondsLeft;

  useEffect(() => {
    if (!armed || secondsLeft !== 0) return;
    const handle = window.open(event.officialUrl, "_blank", "noopener,noreferrer");
    setOpenState(handle ? "已尝试打开官方购票页，请手动完成购买。" : "浏览器拦截了自动打开，请点击下方官方链接按钮。");
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("开售时间到", { body: event.title });
    }
  }, [armed, secondsLeft, event]);

  async function arm() {
    const session = await startPurchaseSession(event.id);
    setSessionId(session.id);
    setArmed(true);
    setOpenState("待命中。到点将尝试打开官方购票页。");
  }

  async function submitResult(purchaseResult: "success" | "failed") {
    if (!sessionId) return;
    await submitPurchaseResult(sessionId, {
      purchaseResult,
      failureReasonCode: purchaseResult === "failed" ? "manual_feedback" : undefined
    });
    setOpenState(purchaseResult === "success" ? "已记录成功样本。" : "已记录失败复盘。");
  }

  return (
    <section className="card countdown">
      <div>
        <p className="eyebrow">到点辅助</p>
        <h2>{event.title}</h2>
        <p>{event.venueName ?? "未知场馆"} · {event.showTimeText ?? "演出时间待定"}</p>
        <div className="timer">{formatSeconds(secondsLeft)}</div>
        <p className="muted">{view?.safetyNotice}</p>
        <div className="actions">
          <button onClick={() => void arm()} disabled={armed}>
            {armed ? "已进入待命" : "开始待命"}
          </button>
          <a className="button secondary" href={event.officialUrl} target="_blank" rel="noreferrer">
            打开官方链接
          </a>
        </div>
        {openState && <div className="notice compact">{openState}</div>}
      </div>

      <div className="checklist">
        <h3>手动购票 Checklist</h3>
        {(view?.checklist ?? []).map((item) => (
          <label key={item} className="check">
            <input type="checkbox" />
            <span>{item}</span>
          </label>
        ))}
        <div className="actions">
          <button className="secondary" onClick={() => void submitResult("success")} disabled={!sessionId}>
            记录成功
          </button>
          <button className="secondary" onClick={() => void submitResult("failed")} disabled={!sessionId}>
            记录失败
          </button>
        </div>
      </div>
    </section>
  );
}
