# 实施阶段 7 行动和复盘闭环

- 日期：2026-07-19
- 状态：已完成
- 需求来源：用户要求“继续下一步”，依据 MVP 清单在阶段 6 合并后进入阶段 7。

## 一、需求说明

### 问题

阶段 3 已能在咨询完成后生成行动卡，阶段 6 已有 Flutter 咨询入口，但用户还不能通过 API 查询行动卡、提交执行反馈、沉淀复盘和管理记忆，行动闭环停留在“建议生成”。

### 预期结果

从最新 `main` 创建 `codex/phase-7-action-review`，实现用户侧行动卡、执行反馈、复盘和记忆管理的最小后端闭环，并更新 OpenAPI、MVP 清单和 TDD 证据。

### 验收标准

- [x] 用户可分页查询自己的行动卡，并读取单张行动卡详情。
- [x] 用户可对自己的行动卡提交执行反馈，系统创建 `execution_records` 并同步更新行动卡状态和 `completed_at`。
- [x] 用户不能读取或反馈其他用户的行动卡。
- [x] 用户可创建和分页查询行动、每日、阶段复盘。
- [x] 用户可创建、分页查询和删除自己的记忆。
- [x] OpenAPI 包含阶段 7 用户侧路径，且不暴露跨用户写入字段。
- [x] 后端测试、类型检查、构建、覆盖率检查通过。
- [x] 更新 MVP 清单、阶段分析记录和 TDD 证据。

### 非目标

- 不新增数据库表或 Migration，沿用阶段 0 已设计的 `goals`、`action_cards`、`execution_records`、`reviews`、`memories`。
- 不实现 AI 自动生成复盘、提醒调度、推送通知和记忆自动抽取。
- 不实现 Flutter 或 React 的完整行动复盘页面，本阶段先交付后端契约和业务规则。

### 假设和待确认问题

- 假设：阶段 7 首版由用户手动提交执行反馈、复盘和记忆，后续阶段再接入 Agent 生成和提醒。
- 假设：`execution_records.result` 直接映射行动卡终态；未完成可后续再次提交反馈覆盖行动卡当前状态。
- 待确认：暂无；当前范围可以由既有数据库设计和 MVP 清单确定。

## 二、当前状态

- 相关文件和符号：`apps/api/src/database/entities.ts:ActionCard` — 已有行动卡实体，阶段 3 会从诊断输出创建待执行行动卡。
- 相关文件和符号：`apps/api/src/database/entities.ts:ExecutionRecord` — 已有执行反馈实体，但没有业务 Service 和 Controller。
- 相关文件和符号：`apps/api/src/database/entities.ts:Review` — 已有复盘实体，但没有用户侧 API。
- 相关文件和符号：`apps/api/src/database/entities.ts:Memory` — 已有记忆实体，但没有用户侧 API。
- 相关文件和符号：`apps/api/src/conversations/conversations.service.ts:executeMessage` — 成功诊断后会保存一张 `pending` 行动卡。
- 相关文件和符号：`apps/api/test/conversations-service.spec.ts` — 已覆盖行动卡创建，但没有执行反馈、复盘和记忆测试。
- 现有行为：用户可通过咨询生成行动卡，但不能通过正式 API 查看和推进行动闭环。
- 现有测试或检查：API 契约测试覆盖认证、模型、后台和会话路径；尚未覆盖阶段 7 路径。

## 三、功能分析

### 范围和受影响组件

- `apps/api/src/actions/*` — 新增用户侧行动、反馈、复盘和记忆模块。
- `apps/api/src/app.module.ts` — 注册阶段 7 模块。
- `apps/api/test/actions-service.spec.ts` — 覆盖权限、状态更新和输入边界。
- `apps/api/test/api-contract.e2e-spec.ts` — 覆盖 OpenAPI 路径和未认证保护。
- `apps/api/openapi.json` — 重新生成契约。
- `docs/03.plan/02.MVP执行清单.md` 和 `docs/04.testing/12.行动复盘闭环.tdd.md` — 回填阶段状态和验证证据。

### 行为和数据流

```text
GET /v1/action-cards
→ 按 userId/status 分页读取行动卡

POST /v1/action-cards/:id/execution-records
→ 校验 actionCard 属于当前 userId
→ 写入 execution_records
→ 将 action_cards.status 更新为 result
→ result=completed 时写入 completed_at

POST /v1/reviews
→ 校验 reviewType 与可选 actionCardId
→ 写入当前用户复盘

POST /v1/memories
→ 写入当前用户确认或未确认记忆
```

### 边界条件和失败处理

- 无效 UUID — 返回 400。
- 行动卡不存在或不属于当前用户 — 返回 404，避免暴露资源存在性。
- 已放弃行动卡继续提交反馈 — 返回 400。
- 反馈结果不在枚举内 — 返回 400 或校验错误。
- 创建行动复盘时引用其他用户行动卡 — 返回 404。
- 记忆置信度不在 0～1 — 返回校验错误。

### 风险和兼容性

- 风险：写入执行反馈和更新行动卡状态需要保持一致。缓解：Service 在同一业务方法中先校验归属，再保存反馈并更新行动卡；后续如引入显式事务可局部增强，不改 API。
- 风险：暴露用户可写字段可能允许伪造 `userId`。缓解：请求 DTO 不包含 `userId`，统一从 Access Token 当前用户写入。
- 风险：复盘和记忆首版不接 AI 生成，闭环体验有限。缓解：先固定数据契约，为客户端和后续 Agent 生成留接口。

### 方案决策

新增独立 `ActionsModule`，避免把会话 Service 继续扩张成行动、复盘和记忆的聚合对象。接口按用户工作流拆分为行动卡、复盘、记忆三个资源族，所有读写默认限定当前用户。

## 四、实施计划

1. 新增 Actions DTO、Service、Controller、Module，并注册到 AppModule。
2. 补充 Actions Service 单元测试和 API 契约测试。
3. 重新生成 `apps/api/openapi.json`。
4. 更新 MVP 清单、TDD 证据和本分析记录。
5. 执行 `pnpm test`、`pnpm test:coverage`、`pnpm typecheck`、`pnpm build`、`git diff --check`，通过后提交并合并回 `main`。

## 五、实施结果

### 已完成改动

新增 `ActionsModule`，注册用户侧 `/v1/action-cards`、`/v1/action-cards/:id/execution-records`、`/v1/reviews` 和 `/v1/memories` API；实现行动卡分页/详情、执行反馈写入与行动状态同步、复盘创建/分页查询、记忆创建/分页查询/删除。补充阶段 7 Service 测试和 API 契约测试，重新生成 `apps/api/openapi.json`。同时修正 `src/openapi.ts`，让 `pnpm generate:openapi` 默认以离线测试环境生成契约，不依赖本地数据库和生产密钥。

### 验证结果

- `cd apps/api && pnpm test -- actions-service.spec.ts api-contract.e2e-spec.ts` — 通过；2 个测试套件、27 个测试通过。
- `cd apps/api && pnpm test -- actions-service.spec.ts` — 通过；1 个测试套件、13 个测试通过。
- `cd apps/api && pnpm test:coverage` — 通过；18 个测试套件、117 个测试通过，全局分支覆盖率 80.48%。
- `cd apps/api && pnpm test` — 通过；18 个测试套件、117 个测试通过。
- `cd apps/api && pnpm generate:openapi` — 通过；已更新 `apps/api/openapi.json`。
- `cd apps/api && pnpm typecheck` — 通过。
- `cd apps/api && pnpm build` — 通过。
- `cd apps/api && git diff --check` — 通过。

### 限制和后续工作

- 本阶段未实现 Flutter 行动复盘页面；当前交付为后端契约和业务规则。
- 复盘和记忆由用户手动创建，未接入 AI 自动提取。
- 未实现提醒调度、推送通知和行动到期策略。
