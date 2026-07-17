# 实现阶段 3 Agent 核心闭环

- 日期：2026-07-17
- 状态：分析中
- 需求来源：用户请求“执行下一步计划”，承接《MVP 执行清单》阶段 3

## 一、需求说明

### 问题

阶段 2 已完成模型管理和 Agent Run 基础记录，但 `ConversationsController` 仍为 `501 contract_not_implemented`，尚不能完成一次真实咨询。

### 预期结果

固定测试用户可以通过 API 创建绑定已发布模型版本的会话，提交消息后完成教练配置和知识卡匹配、模型调用、结构化诊断校验、行动卡持久化、助手消息保存，并通过 SSE 收到运行事件。

### 验收标准

- [ ] 创建会话只绑定当前可用的已发布模型版本，并保存不含凭据的模型快照。
- [ ] 用户消息按会话递增序号保存；相同用户和 UUID 幂等键不会重复创建 Agent Run 或消息。
- [ ] 执行时读取已发布教练配置并匹配最多三个已发布知识卡。
- [ ] 模型输出必须通过诊断结构校验；失败时保存安全错误并返回 `run.failed`。
- [ ] 成功结果创建主要行动卡、保存已完成助手消息并关联 Agent Run。
- [ ] 消息接口返回 `text/event-stream`，至少发送 `run.started`、`message.delta`、`message.completed` 或 `run.failed`。
- [ ] 相关测试、全量测试、类型检查、构建和覆盖率检查达到项目阶段验收要求。

### 非目标

- 完整注册登录、JWT、角色守卫、限流和真实用户身份注入。
- Flutter 客户端、React 管理后台和行动反馈/复盘功能。
- 将模型供应商凭据写入会话、消息、模型快照、日志或错误响应。

### 假设和待确认问题

- 假设：阶段 3 继续使用 `DEVELOPMENT_USER_ID` 作为固定测试用户，认证在阶段 5 实现。
- 假设：当前适配器先以一次非流式 completion 作为模型调用基础，API 层仍通过 SSE 发送增量事件；真正供应商 token 流式适配可在后续优化。
- 待确认：认证阶段需将固定用户替换为认证上下文，并补充资源归属测试。

## 二、当前状态

- 相关文件和符号：`apps/api/src/conversations/conversations.controller.ts:ConversationsController` — 四个接口均为占位实现。
- 相关文件和符号：`apps/api/src/conversations/conversations.module.ts:ConversationsModule` — 尚未注册 Service、Repository 或模型依赖。
- 相关文件和符号：`apps/api/src/models/models.service.ts:ModelsService` — 已有模型生命周期和连接测试，但没有供会话执行使用的已发布模型运行时读取方法。
- 相关文件和符号：`apps/api/src/models/model-adapters.ts:HttpModelAdapter` — 已支持 OpenAI-compatible/Ollama 非流式 completion 和 usage 解析。
- 相关文件和符号：`apps/api/src/agent-runs/agent-runs.service.ts:AgentRunsService` — 已支持幂等启动、终态记录和敏感错误校验。
- 相关 Entity：`Conversation`、`Message`、`AgentRun`、`ActionCard`、`CoachConfig`、`KnowledgeCard` 已存在，Migration 已建立必要外键和唯一约束。
- 现有测试或检查：模型、Agent Run、契约和数据库结构测试已有覆盖；会话接口尚无业务实现测试。

## 三、功能分析

### 范围和受影响组件

- `ModelsService` — 提供已发布模型版本和解密后仅驻留内存的运行时配置。
- `ConversationsService` — 负责会话、消息、教练/知识卡选择、模型调用、结构化输出和行动卡事务编排。
- `ConversationsController` — 固定测试用户下提供 JSON 查询接口和 SSE 消息接口。
- `ConversationsModule` — 注册会话 Service、实体 Repository，并导入模型和 Agent Run 模块。
- DTO、测试和文档 — 明确响应结构、输入边界和阶段证据。

### 行为和数据流

创建会话：模型 ID → 校验系统/用户已发布可选模型 → 读取发布版本 → 生成脱敏快照 → 保存会话。

发送消息：幂等键 → 查找或创建用户消息 → 读取会话绑定模型/教练/知识卡 → 创建 Agent Run → 调用模型 → 校验诊断 JSON → 保存助手消息和行动卡 → 完成 Agent Run → 发出 SSE 事件。

### 边界条件和失败处理

- 模型不存在、未发布或不可选 — 返回 `404`/`400`，不创建会话。
- 会话或消息不属于固定用户 — 返回 `404`，不泄漏资源存在性。
- 空白/超长内容、非法 UUID、重复序号 — 由 DTO、Service 和数据库约束共同拒绝。
- 模型超时、供应商错误或非结构化输出 — Agent Run 记录安全错误，助手消息标记失败，并发出 `run.failed`。
- 重试同一幂等键 — 返回已有运行结果或复用运行记录，不重复创建用户消息。
- 模型快照和错误摘要 — 过滤凭据、Prompt 和消息正文等敏感字段。

### 风险和兼容性

- 外部模型调用可能耗时或失败 — 使用已有适配器超时控制和 Agent Run 终态记录。
- 事务与循环外键 — 采用现有实体约束，必要时在写入顺序上先保存消息和运行记录，再补齐关联字段。
- SSE 客户端断开 — 保证运行记录仍可落库；供应商 token 级流式传输暂不纳入本次实现。
- 认证缺失 — 明确固定测试用户仅为阶段过渡，避免伪装为生产授权模型。

### 方案决策

复用现有 `ModelsService` 和 `AgentRunsService`，新增最小的运行时读取接口与会话编排 Service；不在 Controller 中直接访问数据库或凭据。结构化输出使用严格 JSON 对象校验，行动卡只创建主行动卡，保持与当前数据库唯一索引一致。

## 四、实施计划

1. 新增会话编排 Service 的单元/集成测试，覆盖会话绑定、幂等、结构化输出、行动卡和失败事件。
2. 增加模型运行时读取、会话/消息/行动卡持久化和 SSE Controller 接入。
3. 更新模块依赖、OpenAPI、MVP 清单和 TDD 证据。
4. 执行相关测试、全量测试、类型检查、构建和覆盖率检查；修复失败后创建阶段完成提交。

## 五、实施结果

### 已完成改动

待实施。

### 验证结果

- 待实施。

### 限制和后续工作

- 真实认证上下文、供应商 token 级流式适配和行动反馈留待后续阶段。
