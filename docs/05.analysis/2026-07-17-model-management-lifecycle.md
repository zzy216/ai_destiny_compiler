# 实现阶段 2 模型管理底座

- 日期：2026-07-17
- 状态：已完成
- 需求来源：用户请求“执行阶段2的内容”

## 一、需求说明

### 问题

阶段 2 已完成模型凭据加密、适配器和连接测试，但模型管理 Controller 仍由 `501` 占位实现，缺少模型创建、查询、版本草稿、发布、停用、删除和默认模型规则。

### 预期结果

完成系统模型和用户自定义模型的生命周期 Service，并接入已有 REST Controller；模型版本可追踪，凭据继续加密保存，响应不泄露密钥。

### 验收标准

- [x] 系统模型和用户自定义模型支持创建、列表、详情、更新草稿和软删除。
- [x] 模型支持草稿版本发布、停用和系统默认模型切换。
- [x] 模型连接测试继续使用草稿优先、已发布版本兜底的规则。
- [x] API 响应不包含明文 API Key、密文或加密元数据。
- [x] 新增行为有测试，类型检查和覆盖率检查通过。
- [x] MVP 执行清单和 TDD 证据记录已更新。

### 非目标

- 本次不实现完整登录、JWT、角色守卫和用户身份注入；认证模块仍按后续阶段处理。
- 本次不实现 Agent Run、会话、SSE 或前端客户端。
- 本次不增加新的数据库表或迁移。

### 假设和待确认问题

- 假设：认证尚未实现期间，Controller 使用种子数据中的固定管理员和测试用户作为临时操作者，仅用于当前 MVP 开发闭环。
- 假设：删除采用软删除并立即清除模型凭据，避免破坏未来会话对历史模型版本的外键引用。
- 待确认：认证阶段完成后，需要把固定操作者替换为真实认证上下文，并补充角色与资源归属校验。

## 二、当前状态

- 相关文件和符号：`apps/api/src/models/models.controller.ts` — 模型、用户自定义模型和管理员模型路由均返回 `contractNotImplemented()`。
- 相关文件和符号：`apps/api/src/models/models.service.ts:ModelsService.testConnection` — 已支持连接测试、凭据解密和安全错误归一化。
- 相关文件和符号：`apps/api/src/database/entities.ts:ModelConfig/ModelConfigVersion/ModelCredential` — 已提供状态、版本指针、默认标记、软删除和凭据字段。
- 相关文件和符号：`apps/api/src/database/seed.ts` — 已提供固定管理员、固定测试用户和系统模型种子数据。
- 现有测试或检查：连接测试覆盖已存在；`api-contract.e2e-spec.ts` 在数据库禁用时验证占位路由仍返回统一的 `501` 契约错误。

## 三、功能分析

### 范围和受影响组件

- `ModelsService` — 承担模型 CRUD、版本创建与发布、状态切换、默认模型互斥、凭据加密和响应脱敏。
- `models.controller.ts` — 将已有契约路由接入 Service，并增加停用路由。
- `models-lifecycle.e2e-spec.ts` — 使用仓储 Mock 验证核心状态流转和安全边界。
- `api-contract.e2e-spec.ts` — 保持数据库禁用时的契约占位行为，避免认证和数据库未启用时伪造业务成功。
- `docs/03.plan/02.MVP执行清单.md`、`docs/04.testing/06.模型管理底座.tdd.md` — 更新阶段状态和 TDD 证据。

### 行为和数据流

创建或更新模型 → 写入新的 `ModelConfigVersion` 草稿 → 更新 `ModelConfig.currentDraftVersionId` → 发布时将草稿版本改为已发布，并把旧已发布版本标记为 `superseded` → 新会话只读取已发布且可选模型。

### 边界条件和失败处理

- 不存在、已删除或归属不匹配的模型 — 返回 `404`。
- 没有草稿版本、发布禁用模型或设置非系统/非已发布默认模型 — 返回 `400`。
- 删除有已发布版本的系统模型 — 拒绝删除，避免违反管理员接口契约。
- 自定义模型非 HTTPS、指向本机/私有地址或包含不安全配置键 — 返回 `400`。
- 配置 API Key 时加密组件不可用 — 返回 `500`，不保存明文。

### 风险和兼容性

- 固定操作者只允许作为认证未完成前的开发过渡；完成认证后必须移除，否则会形成越权风险。
- 多步模型写操作使用 TypeORM 事务；默认模型切换在事务内先清除旧默认再设置新默认。
- 仅软删除模型并清除凭据，保留版本记录以兼容历史引用。

### 方案决策

采用 Service 层集中实现业务规则，Controller 只负责契约和响应包装；版本更新始终创建新版本，不覆盖历史版本。相比在 Controller 中直接操作仓储，该方案更容易为后续会话绑定和 Agent Run 快照复用，也便于测试状态转换。

## 四、实施计划

1. 先新增模型生命周期测试并验证当前 `501`/缺失方法的 RED 状态。
2. 实现 Service 的查询、创建、草稿版本、发布、停用、删除、默认切换和凭据脱敏。
3. 接入 Controller，保持数据库未启用时的统一占位错误。
4. 运行相关测试、全量测试、类型检查和覆盖率，更新计划与 TDD 证据。

## 五、实施结果

### 已完成改动

完成 `ModelsService` 的模型列表、创建、详情、草稿版本更新、发布、停用、软删除和默认模型切换；系统模型与用户自定义模型 Controller 已接入真实 Service，并新增自定义模型发布/停用和系统模型停用路由。创建和更新 API Key 时使用 AES-256-GCM 加密，响应仅返回 `hasCredential` 和脱敏 `secretHint`；自定义模型 Base URL 增加 HTTPS、公网地址和敏感配置键校验。同步生成 `apps/api/openapi.json`，更新契约测试、MVP 清单和 TDD 证据。实际实现与计划一致。

### 验证结果

- `pnpm test -- --runInBand models-lifecycle.e2e-spec.ts` — 通过
- `pnpm test -- --runInBand` — 通过，9 个测试套件、57 个测试
- `pnpm run typecheck` — 通过
- `NODE_ENV=test DATABASE_ENABLED=false pnpm run generate:openapi` — 通过
- `pnpm run test:coverage` — 通过，语句 96.69%、分支 81.72%、函数 96.73%、行 97.43%

### 限制和后续工作

- 认证上下文和真正的管理员权限控制留待认证阶段实现；当前 Controller 使用固定种子操作者仅用于 MVP 开发过渡。
- Agent Run 基础记录 Service 仍未实现，下一步进入该任务。
