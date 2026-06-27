# 架构说明

## 目标

系统面向个人用户，核心目标是降低错过成都演出开售的概率，而不是接管交易流程。架构围绕四个动作设计：

1. 安全获取公开演出信息。
2. 根据订阅规则识别目标项目。
3. 在关键时间点稳定提醒用户。
4. 到点打开官方链接并展示手动购票 checklist。

## 组件

```text
Web/PWA
  ├─ 演出发现
  ├─ 订阅规则
  ├─ 倒计时待命
  └─ 失败复盘

API
  ├─ Events
  ├─ Watch Rules
  ├─ Countdown
  ├─ Notification Channels
  └─ Purchase Sessions

Worker
  ├─ DamaiSearchProvider
  ├─ Rule Engine
  ├─ Notification Scheduler
  └─ Notifier
```

## Provider 边界

Provider 只允许访问官方开放接口或用户手动输入的官方链接。禁止实现：

- 登录态抓取。
- 订单接口调用。
- 支付接口调用。
- App 私有接口逆向。
- 验证码、滑块、排队、风控相关处理。
- 多账号、多代理并发。

## 调度策略

MVP 使用低频调度：

| 场景 | 建议频率 |
|---|---:|
| 普通项目发现 | 10-30 分钟 |
| 命中规则项目 | 3-10 分钟 |
| 开售前 1 小时 | 1-3 分钟 |
| 开售前 5 分钟 | 15-30 秒，仅限少量重点项目 |

当前实现默认 `SYNC_INTERVAL_MS=600000`，即 10 分钟。

## 存储策略

当前代码使用 `InMemoryStore`，便于快速运行和验证交互。生产化时应替换为 PostgreSQL repository：

- `events`：项目主表。
- `event_snapshots`：状态快照。
- `watch_rules`：订阅规则。
- `notification_jobs`：定时通知任务。
- `notification_channels`：通知通道。
- `purchase_sessions`：购票辅助会话和复盘。
- `audit_logs`：审计日志。

SQL 草案位于 `db/schema.sql`。
