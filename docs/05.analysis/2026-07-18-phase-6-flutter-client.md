# 实施阶段 6 Flutter 咨询客户端

- 日期：2026-07-18
- 状态：已完成
- 需求来源：用户要求“继续下一步”，依据 MVP 清单在阶段 5 合并后进入阶段 6。

## 一、需求说明

### 问题

后端已经具备自建认证、可用模型列表、会话创建、消息历史和 SSE 咨询回复接口，但仓库尚无 Flutter 客户端，普通用户无法在移动端完成登录和咨询闭环。

### 预期结果

从最新 `main` 创建 `codex/phase-6-flutter-client`，新增 `apps/client` Flutter 应用，交付登录、咨询、历史会话和个人设置的最小完整纵切；客户端通过已生成的 API 契约调用 NestJS 服务，并覆盖关键界面测试。

### 验收标准

- [ ] `apps/client` 可执行 `flutter test` 和 `flutter analyze`。
- [ ] 登录页支持配置 API Base URL、邮箱或用户名、密码和设备名，并能保存登录会话。
- [ ] 登录后展示可用模型，自动选择默认或首个可选模型。
- [ ] 用户可以创建咨询会话、发送问题，并从 SSE 事件流拼接助手回复。
- [ ] 用户可以查看历史会话和会话消息。
- [ ] 设置页展示当前用户、API 地址，并支持登出。
- [ ] 测试覆盖未登录、登录后首页、发送消息和登出等关键流程。
- [ ] 更新 MVP 清单、TDD 证据和阶段分析记录。

### 非目标

- 不实现行动执行反馈、复盘、记忆和提醒；这些属于阶段 7。
- 不实现注册、邀请码管理、密码修改、用户自定义模型管理和离线缓存。
- 不对接推送通知、应用图标、发布签名、商店元数据和真实设备权限。

### 假设和待确认问题

- 假设：阶段 6 以开发和内测可运行为目标，默认 API 地址使用 `http://127.0.0.1:3000/api`，真实设备访问局域网地址由用户在登录页配置。
- 假设：Refresh Token 存储先通过可替换 SessionStore 抽象隔离；生产级安全存储可在发布阶段进一步加固。
- 待确认：暂无；本阶段先完成客户端纵切和测试证据。

## 二、当前状态

- 相关文件和符号：`apps/api/src/auth/auth.controller.ts` — 已提供登录、刷新、登出和改密接口。
- 相关文件和符号：`apps/api/src/models/models.controller.ts` — 已提供当前用户可用模型列表接口。
- 相关文件和符号：`apps/api/src/conversations/conversations.controller.ts` — 已提供创建会话、列表、消息历史和 SSE 发消息接口。
- 相关文件和符号：`apps/api/openapi.json` — 已生成接口契约，可供客户端对齐字段。
- 相关文件和符号：`apps/client` — 当前不存在，需要新建 Flutter 工程。
- 现有行为：普通用户只能通过 API 直接调用咨询能力，没有移动端入口。
- 现有测试或检查：已有后端认证和会话测试；没有 Flutter 客户端测试。

## 三、功能分析

### 范围和受影响组件

- `apps/client` — Flutter 应用壳、登录状态、API Client、会话页面、历史页、设置页和 Widget 测试。
- `docs/04.testing/11.Flutter咨询客户端.tdd.md` — 记录客户端用户旅程、测试规格和验证命令。
- `docs/03.plan/02.MVP执行清单.md` — 更新阶段 5 合并状态和阶段 6 执行状态。

### 行为和数据流

```text
用户输入 API 地址和账号密码
→ Flutter 调用 POST /v1/auth/login
→ 保存 Access Token、Refresh Token 和当前用户
→ GET /v1/models 读取可选模型
→ POST /v1/conversations 创建会话
→ POST /v1/conversations/:id/messages 读取 SSE
→ 页面追加用户消息和助手回复
→ GET /v1/conversations 与 /messages 读取历史
```

### 边界条件和失败处理

- 登录失败 — 保持登录页，展示服务端错误或通用错误。
- 没有可选模型 — 咨询输入禁用，提示先在后台发布模型。
- SSE 返回 `run.failed` — 停止发送状态并展示失败原因。
- 网络错误或 API 地址错误 — 展示错误，不清空当前输入。
- 登出 — 调用服务端登出；即使服务端失败，也清理本地会话，避免继续误用旧 Token。

### 风险和兼容性

- Flutter SDK 版本为 3.27.2，默认模板可能生成较多平台文件 — 保留官方脚手架结构，减少手写工程配置风险。
- 移动端访问本机 `127.0.0.1` 与真机网络语义不同 — 登录页允许修改 Base URL，文档标明开发默认值。
- SSE 解析容易受分包影响 — API Client 使用按行解析事件和 data，并通过 Widget 测试覆盖完成事件拼接。

### 方案决策

采用“单 Flutter 应用 + 轻量 AppController + 可注入 API Client”的方案。客户端不引入复杂状态管理库，先用 `ChangeNotifier` 固定 MVP 流程；HTTP 调用集中在 API Client，界面测试使用 Fake Client 固定行为，避免依赖本地后端运行。

## 四、实施计划

1. 使用 Flutter 官方脚手架创建 `apps/client`，整理依赖和基础工程配置。
2. 新增 API DTO、API Client、SessionStore、AppController 和主界面。
3. 补充 Widget 测试覆盖登录、模型加载、发送消息、历史和登出。
4. 更新 TDD 证据、MVP 清单和本分析记录。
5. 执行 `flutter test`、`flutter analyze`、`git diff --check`，通过后提交并合并回 `main`。

## 五、实施结果

### 已完成改动

新增 `apps/client` Flutter 工程和 `http` 依赖；实现命运编译器客户端入口、认证登录、运行期会话保存、可用模型加载、会话创建、SSE 消息流解析、咨询页、历史页、设置页和登出。新增 Fake API 驱动的 Widget 测试覆盖登录、咨询、历史打开和登出；更新客户端 README、MVP 清单和阶段 TDD 证据。

### 验证结果

- `cd apps/client && flutter test` — 通过；4 个 Widget 测试通过。
- `cd apps/client && flutter test --coverage` — 通过；4 个 Widget 测试通过并生成覆盖率数据。
- `cd apps/client && flutter analyze` — 通过；无静态分析问题。
- `cd apps/client && flutter build web` — 通过。
- `cd apps/api && pnpm test` — 通过；17 个测试套件、101 个测试通过。
- `cd apps/api && pnpm test:coverage` — 通过；全局分支覆盖率 80.16%。
- `cd apps/api && pnpm typecheck` — 通过。
- `cd apps/api && pnpm build` — 通过。
- `cd apps/admin && pnpm test` — 通过；7 个测试文件、8 个测试通过。
- `cd apps/admin && pnpm test:coverage` — 通过；语句/行覆盖率 91.52%。
- `cd apps/admin && pnpm typecheck` — 通过。
- `cd apps/admin && pnpm build` — 通过；Vite 仍提示 Ant Design 相关单 chunk 大于 500 kB。
- `git diff --check` — 通过。

### 限制和后续工作

- 本阶段未接入平台安全存储，Refresh Token 仅通过可替换的运行期 SessionStore 抽象保存；发布阶段应接入 Keychain / Keystore。
- 未实现注册、改密、用户自定义模型管理、行动反馈、复盘、记忆和提醒。
- 未做真机联调；真机访问本机后端时需要在登录页配置局域网 API 地址。
