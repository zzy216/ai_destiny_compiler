# 实现 Agent Run 基础记录 Service

- 日期：2026-07-17
- 状态：已完成
- 需求来源：用户请求“提交当前修改，同时进行下一个阶段的内容”；MVP 执行清单明确的下一项为“Agent Run 基础记录 Service”。

## 一、需求说明

### 问题

`agent_runs` Entity 和数据库 Migration 已存在，但尚无 Service 负责创建运行记录、处理幂等重试和收敛运行状态。

### 预期结果

提供可被后续会话编排复用的 Agent Run 基础 Service：创建运行时保存模型/教练脱敏快照，重复幂等键返回已有记录，运行结束后只能从 `running` 进入合法终态。

### 验收标准

- [x] 同一用户和幂等键只创建一条 Agent Run，重试返回已有记录。
- [x] 创建记录默认状态为 `running`，并保存必需关联字段和快照。
- [x] 成功、失败、超时和取消均写入合法终态及完成时间。
- [x] 已结束运行不能再次更新；Token、成本和耗时不能为负数。
- [x] 模型/教练快照及错误信息不得写入敏感凭据、Prompt、聊天正文或堆栈。
- [x] 相关测试、类型检查和覆盖率检查通过，并更新阶段清单与 TDD 证据。

### 非目标

- 本轮不实现会话创建、消息保存、模型调用、结构化诊断、行动卡或 SSE。
- 本轮不新增数据库表和 Migration。
- 本轮不实现真实认证、角色守卫和资源权限注入。

### 假设和待确认问题

- 假设：Service 先采用可选 Repository 注入，与现有模型 Service 一致；数据库关闭时返回统一契约占位错误。
- 假设：幂等冲突以已有记录为准，调用方无需再次执行模型调用。
- 待确认：进入阶段 3 后，由会话编排层负责校验消息、模型版本和教练配置的外键归属。

## 二、当前状态

- 相关文件和符号：`apps/api/src/database/entities.ts:AgentRun` — 已定义运行字段、状态和非负值检查约束。
- 相关文件和符号：`apps/api/src/database/migrations.ts:CreateAgentRuns1784200000014` — 已创建 `agent_runs` 表、幂等唯一约束和索引。
- 相关文件和符号：`apps/api/src/conversations/conversations.dto.ts` — 已约定客户端发送 UUID 幂等键并返回 `agentRunId`。
- 现有行为：没有 Agent Run Service、模块或运行状态测试。
- 现有测试或检查：数据库契约仅验证 Entity 和 Migration 注册，不验证业务状态流转。

## 三、功能分析

### 范围和受影响组件

- `AgentRunsService` — 封装 Repository 读写、幂等复用、快照脱敏和状态转换。
- `AgentRunsModule` — 注册 Service 与可选 TypeORM Repository，供后续会话模块接入。
- `agent-runs.e2e-spec.ts` — 使用 Repository Mock 验证业务规则。
- 阶段计划和 TDD 记录 — 回填完成证据。

### 行为和数据流

创建请求 → 按 `(userId, idempotencyKey)` 查询 → 已存在则返回已有 Run → 不存在则创建 `running` Run → 模型调用完成后更新为 `succeeded` 或失败终态。

### 边界条件和失败处理

- 幂等键为空、超过 100 字符或非 UUID 格式 — 返回 400。
- 必需关联字段或快照缺失 — 返回 400。
- 快照递归包含 `apiKey`、`authorization`、`token`、`secret`、`password`、Prompt 或聊天正文 — 拒绝写入。
- 不存在的 Run — 返回 404。
- 非 `running` 状态再次完成/失败 — 返回 409。
- Repository 未注入 — 返回现有统一 501 占位错误。

### 风险和兼容性

- 进程在模型调用期间崩溃可能留下 `running` 记录；超时回收和后台巡检留待后续阶段。
- 数据库唯一约束仍是并发幂等的最终保障；本轮 Mock 测试覆盖正常路径，真实 PostgreSQL 并发验证留待数据库集成环境。
- 快照仅允许业务调用方传入脱敏数据，Service 进行键名拦截，不复制完整 Prompt 或聊天内容。

### 方案决策

采用独立 Service 和显式状态转换方法，避免让会话编排直接更新 Entity。使用 `findOne` 优先复用幂等记录，并把 TypeORM 唯一冲突归一化为已有记录或冲突错误；不在本轮引入状态机库或新的 API Controller。

## 四、实施计划

1. 新增 Agent Run Service 测试，先验证当前缺少实现的 RED 状态。
2. 新增 Service、Module 和最小安全校验/状态转换实现。
3. 运行相关测试、全量测试、类型检查和覆盖率。
4. 更新 MVP 清单、TDD 证据和本分析记录，并用中文 Conventional Commit 提交本阶段改动。

## 五、实施结果

### 已完成改动

新增 `AgentRunsService` 和 `AgentRunsModule`，接入 `AppModule`。Service 支持幂等创建、并发唯一冲突复用、成功/失败/超时/取消终态更新、用户归属校验、非负计量校验、三张以内知识卡快照和敏感字段拦截。新增 7 个测试场景覆盖正常流程、边界条件、并发幂等和错误安全处理。

### 验证结果

- `pnpm test -- --runInBand agent-runs.e2e-spec.ts` — 通过，7 个测试
- `pnpm test -- --runInBand` — 通过，10 个测试套件、64 个测试
- `pnpm run typecheck` — 通过
- `pnpm run build` — 通过
- `pnpm run test:coverage` — 通过，语句 96.87%、分支 82.96%、函数 97.09%、行 97.58%

### 限制和后续工作

- Service 已完成基础记录，但尚未接入会话、消息、模型调用和 SSE；下一阶段进入 Agent 核心闭环。
- `running` 记录的超时回收和后台巡检留待后续运行治理能力。
- 真实 PostgreSQL 并发和外键集成验证留待数据库集成环境。
