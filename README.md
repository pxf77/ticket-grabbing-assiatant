# 成都演出个人购票辅助驾驶系统

> 合规边界：本项目只做演出发现、状态监测、开售倒计时、提醒、官方购票页跳转和手动购票 checklist。  
> 不做自动登录、自动选票、自动选座、自动提交订单、自动支付、验证码处理、排队绕过、风控规避、代理池或多账号并发。

## 产品定位

本仓库实现一个面向个人用户的成都演出购票辅助系统：

- 自动聚合成都地区演出项目。
- 通过关键词、艺人、场馆、价格区间和开售时间创建订阅规则。
- 在 T-24h、T-30m、T-10m、T-60s、T-10s 等节点发送提醒。
- 到点展示官方购票入口和手动购票 checklist。
- 用户在官方平台手动完成登录、实名信息确认、选票和支付。
- 失败后记录结构化复盘，用于优化下次提醒节奏。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite + PWA |
| 后端 | Node.js + Express + TypeScript |
| 共享模型 | TypeScript workspace package |
| 调度 | 后端 setInterval MVP，后续可替换 BullMQ / Temporal |
| 存储 | MVP 内存存储，附带 PostgreSQL schema |
| 通知 | 浏览器通知、Webhook 占位、邮件/企业微信/钉钉可扩展 |

## 快速开始

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

前端默认运行在：

```text
http://localhost:5173
```

后端默认运行在：

```text
http://localhost:8787
```

## 目录结构

```text
apps/
  api/        后端 API、Provider、规则引擎、调度与通知
  web/        PWA 前端、倒计时页、订阅规则、复盘页
packages/
  shared/     前后端共享类型和工具函数
db/
  schema.sql  PostgreSQL 数据模型
docs/
  ARCHITECTURE.md
  UX.md
  COMPLIANCE.md
scripts/
  compliance-check.mjs
```

## 外部数据源

MVP 预留 `DamaiSearchProvider`，只用于调用官方开放搜索接口，获取公开的演出项目和状态信息。  
它不会访问登录态、订单页、支付页，也不会构造任何交易请求。

需要配置时：

```bash
TOP_APP_KEY=your_app_key
TOP_APP_SECRET=your_app_secret
```

没有配置时，系统会使用本地示例数据，便于开发 UI 和规则引擎。

## API 摘要

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| GET | `/api/events` | 演出列表 |
| POST | `/api/events/manual` | 手动添加官方项目链接 |
| GET | `/api/watch-rules` | 订阅规则列表 |
| POST | `/api/watch-rules` | 创建订阅规则 |
| PATCH | `/api/watch-rules/:id` | 更新订阅规则 |
| GET | `/api/countdown/:eventId` | 倒计时页数据 |
| POST | `/api/provider/sync` | 手动触发一次安全同步 |
| POST | `/api/notification-channels/:id/test` | 测试通知通道 |
| POST | `/api/purchase-sessions` | 创建一次购票辅助会话 |
| POST | `/api/purchase-sessions/:id/result` | 提交成功/失败复盘 |

## 合规保护

项目内置 `pnpm check:compliance`，扫描 `apps/` 和 `packages/` 中是否出现明显越界实现信号，例如验证码求解、队列绕过、代理池、自动支付、浏览器自动化框架等。

```bash
pnpm check:compliance
```

该检查不能替代人工审查，但可以作为 CI 中的最低边界守卫。

## 后续迭代

1. 将内存存储替换为 PostgreSQL repository。
2. 接入 Web Push VAPID 或 FCM。
3. 增加企业微信、钉钉、Telegram、邮件通知适配器。
4. 加入用户登录、Passkey 或邮箱 magic link。
5. 增加通知健康度、通道降级和失败复盘分析。
6. 增加多城市、多平台官方开放接口。
