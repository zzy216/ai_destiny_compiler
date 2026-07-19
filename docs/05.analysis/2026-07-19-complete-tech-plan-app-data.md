# 技术方案闭环验收

- 日期：2026-07-19
- 状态：已完成
- 需求来源：用户要求完成 `docs/02.technology/01.技术落地方案.md` 全部内容，并验证 App 可正常提问、后台可看到成功数据

## 一、需求说明

### 问题
技术方案定义的 MVP 闭环需要落实到可运行系统：Flutter App 能向法典教练提问，NestJS 能保存会话、消息、行动卡和 Agent Run，React 后台能看到执行数据。

### 预期结果
完成后可以使用测试账号登录 App，选择已发布模型发送问题，并在后台 Agent Run 中看到成功记录。

### 验收标准
- [ ] Flutter App 登录后能加载可选模型和历史会话
- [ ] Flutter App 发送问题后能显示助手回复
- [ ] NestJS 能保存会话、用户消息、助手消息、行动卡和成功 Agent Run
- [ ] React 管理后台能读取 Agent Run 摘要
- [ ] 相关后端、后台和客户端测试通过

### 非目标
- 不新增 Docker、Redis、队列、向量数据库或多智能体框架
- 不接入新的第三方托管认证服务
- 不实现公开生产部署

### 假设和待确认问题
- 假设：本地验收可使用当前种子数据中的测试用户、管理员和本地模型配置。
- 待确认：真实模型服务是否可用由本机环境决定；若本机没有模型服务，需要通过测试适配器或 Mock provider 证明业务数据闭环。

## 二、当前状态

- 相关文件和符号：`apps/client/lib/main.dart:AppController.sendQuestion` — App 发送提问并消费 SSE。
- 相关文件和符号：`apps/api/src/conversations/conversations.service.ts:executeMessage` — 创建用户消息、调用模型、保存助手消息、行动卡和 Agent Run。
- 相关文件和符号：`apps/admin/src/features/agent-runs/AgentRunsPage.tsx` — 后台展示 Agent Run 摘要。
- 相关文件和符号：`apps/api/src/database/seed.ts` — 提供测试用户、管理员、发布教练配置、知识卡和默认模型。
- 现有行为：核心业务链路已存在，但需要补齐验收记录，并检查错误事件字段、端到端数据可见性和本地可运行性。
- 现有测试或检查：已有 Flutter Widget 测试、后端 Conversation/Agent Run E2E、后台 Agent Runs 页面测试。

## 三、功能分析

### 范围和受影响组件
- Flutter App — 登录、模型选择、提问、SSE 事件处理和错误提示。
- NestJS API — 会话执行、模型调用、结构化输出校验、Agent Run 记录。
- React Admin — Agent Run 查询展示，作为后台成功数据验证入口。
- 文档 — 回填验收过程和实际验证结果。

### 行为和数据流
用户登录后 App 请求可选模型，创建会话并发送消息；NestJS 固定会话模型版本，保存用户消息，执行模型调用并校验结构化输出，随后保存助手消息、行动卡和 Agent Run；后台通过管理接口读取 Agent Run 摘要。

### 边界条件和失败处理
- 模型不可达 — Agent Run 应记录失败，App 显示可理解错误。
- 模型输出不是合法 JSON — Agent Run 应记录失败，不写入错误结构化结果。
- 会话或模型不属于当前用户 — 服务端应拒绝访问。
- 后台无 Run 数据 — 页面显示空状态。

### 风险和兼容性
- 本机没有真实 Ollama 或 API Key 会阻断人工端到端成功验证；通过自动化测试覆盖数据闭环，并在最终结果中明确实际运行环境。
- 修改 App SSE 处理需要保持已有流式回复测试通过。

### 方案决策
优先沿用现有三端实现和测试体系，只补齐影响验收的最小缺口；不引入新基础设施或重构目录结构。

## 四、实施计划

1. 检查并修复 App 与后端 SSE 事件契约的小不一致。
2. 补充或调整测试覆盖“提问成功后后台可见 Agent Run 数据”的关键路径。
3. 执行后端、后台和 Flutter 测试；必要时启动本地服务做实际接口验证。
4. 回填本分析记录和完成状态。

## 五、实施结果

### 已完成改动
- 后端 `message.completed` SSE 事件补充 `content` 字段，确保客户端即使不依赖增量事件也能渲染最终回复。
- Flutter 客户端识别 `run.failed.errorMessage`，模型失败时展示后端返回的安全错误说明。
- React 后台 Vite 开发服务器增加 `/api` 代理到 `http://127.0.0.1:3000`，本地后台可直接访问 NestJS API。
- 后台 Agent Run 查询拆分专用状态 DTO，允许 `running`、`succeeded`、`failed`、`timeout`、`cancelled`，修复 `status=succeeded` 被内容状态枚举拒绝的问题。
- 补充后端和 Flutter 测试，覆盖完成事件文本和失败错误提示；补充后台服务测试，覆盖 Agent Run 成功状态筛选。
- 使用 PostgreSQL 种子数据、NestJS API 和本地 Ollama 兼容 Mock 服务完成真实 HTTP 验收：测试用户发送问题后保存 2 条消息，管理员接口按 `status=succeeded` 查到成功 Agent Run。

### 验证结果
- `pnpm test -- conversations-service.spec.ts`（`apps/api`）— 通过
- `pnpm test -- admin-management.spec.ts conversations-service.spec.ts`（`apps/api`）— 通过
- `pnpm typecheck`（`apps/api`）— 通过
- `pnpm test`（`apps/api`）— 通过，18 个测试套件、122 个测试
- `pnpm build`（`apps/api`）— 通过
- `pnpm test`（`apps/admin`）— 通过，7 个测试文件、8 个测试
- `pnpm build`（`apps/admin`）— 通过；Vite 报告单个产物超过 500 kB 的体积提示
- `flutter analyze`（`apps/client`）— 通过
- `flutter test`（`apps/client`）— 通过，5 个 Widget 测试
- 真实 HTTP 验收 — 通过；会话 `b1eb925e-dbb4-4ca1-9807-e64407064609` 保存 2 条消息，后台查到成功 Run `6eee8a3a-0ad1-4ca1-a8f0-c03b34f31a03`，模型 `llama3.2`，Token `120 / 80`

### 限制和后续工作
- 本机没有真实 Ollama 服务；端到端成功验证使用本地 Ollama 兼容 Mock 服务证明业务写库和后台可见链路。接入真实模型时仍需在后台测试连接并保证模型输出符合结构化 JSON。
