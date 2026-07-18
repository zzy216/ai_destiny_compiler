# 实施阶段 4 React 管理后台

- 日期：2026-07-18
- 状态：已完成
- 需求来源：用户确认开始下一阶段“React 管理后台”。

## 一、需求说明

### 问题

阶段 3 已完成 Agent 核心闭环并合并到 `main`，仓库尚未创建 `apps/admin`，管理员无法通过界面维护模型、教练配置和法典知识卡，也无法查询 Agent Run。

### 预期结果

从最新 `main` 创建 `codex/phase-4-react-admin`，交付一个可运行的 React + Vite 管理后台最小完整纵切：管理员可以查看和维护系统模型、教练配置、知识卡，并查看 Agent Run；前端通过 API Client 与 NestJS 对接，页面具备加载、错误、空状态和表单校验。

### 验收标准

- [x] `apps/admin` 可安装依赖、类型检查、构建和启动开发服务器。
- [x] 管理后台包含仪表盘、模型、教练配置、知识卡和 Agent Run 页面，并有统一导航和响应式布局。
- [x] 模型页面支持列表、创建、编辑、发布、停用、设为默认和连接测试，API Key 不在列表或详情响应中回显。
- [x] 教练配置支持查看、编辑草稿和发布；知识卡支持查看、编辑和发布。
- [x] Agent Run 页面支持分页列表和状态展示，详情摘要不默认展示完整对话正文或凭据。
- [x] 前端组件和关键用户流程有单元/组件测试；后端新增管理接口有 Service/Controller 测试。
- [x] 相关测试、类型检查、构建和覆盖率验证通过，并补齐 TDD 证据。

### 非目标

- 不在本阶段实现完整 JWT、角色守卫、CSRF 和真实管理员登录；当前沿用 API 的开发期固定管理员上下文，并在页面显式标注开发模式。
- 不实现复杂 ECharts 统计、用户管理、真实对话全文查看、审计日志和生产部署。
- 不新增 Flutter 客户端和阶段 5 自建认证能力。

### 假设和待确认问题

- 假设：前端使用 React、Vite、TypeScript、React Router、TanStack Query、Ant Design、React Hook Form 和 Zod，与技术落地方案一致。
- 假设：阶段 4 先打通模型、教练配置、知识卡和 Agent Run 的最小管理 API；复杂统计和真实权限留待后续阶段。
- 待确认：暂无；开发期固定管理员 ID 由阶段 5 的认证上下文替换。

## 二、当前状态

- 相关文件：`docs/02.technology/01.技术落地方案.md:324` — 定义 React 管理后台技术栈、页面和模块结构。
- 相关文件：`apps/api/src/models/models.controller.ts`、`apps/api/src/models/models.service.ts` — 已提供系统模型管理 API 和生命周期能力。
- 相关文件：`apps/api/src/database/entities.ts:147`、`:169`、`:245` — 已有 `CoachConfig`、`KnowledgeCard`、`AgentRun` 数据实体。
- 当前状态：已从干净的 `main` 创建 `codex/phase-4-react-admin`；阶段 4 实现已完成，待最终收口后合并。
- 现有测试：API 模型生命周期、Agent Run 和阶段 3 闭环测试已有覆盖；本阶段新增 React 组件、管理 Service/Controller、开发环境保护和 OpenAPI 契约测试。

## 三、功能分析

### 范围和受影响组件

- `apps/admin` — React 管理后台壳、路由、查询、表单、页面和组件测试。
- `apps/api/src/admin` — 教练配置、知识卡和 Agent Run 管理接口；仅返回后台需要的脱敏字段。
- `apps/api/src/app.module.ts` — 注册管理模块。
- `docs/04.testing/09.React管理后台.tdd.md` — 记录本阶段 TDD 用户旅程、RED/GREEN 和验收证据。
- `docs/03.plan/02.MVP执行清单.md` — 更新阶段 4 状态和完成项。

### 行为和数据流

```text
管理员打开 React 管理后台
→ API Client 请求管理端点
→ NestJS 管理 Controller 校验请求并读取 PostgreSQL
→ 返回分页列表或脱敏详情
→ TanStack Query 更新页面状态
→ 表单提交创建/更新草稿
→ 发布、停用、默认和连接测试动作刷新相关查询
```

### 边界条件和失败处理

- API 不可用 — 页面显示可重试的错误状态，不展示伪造的成功数据。
- 列表为空 — 展示明确空状态和创建入口。
- 表单输入无效 — 前端 Zod/React Hook Form 阻止提交；后端 DTO 继续校验。
- API Key — 只提交新凭据，列表和详情只显示 `hasCredential`、`secretHint` 等脱敏信息。
- Agent Run 含敏感结果 — 列表仅展示状态、耗时、Token、模型和时间；详情只返回安全摘要。
- 开发期固定管理员 — 页面标识开发模式，所有接口集中在管理模块，便于阶段 5 替换认证守卫。

### 风险和兼容性

- 管理接口暂未接入真实认证 — 本阶段由开发环境保护守卫阻断生产访问，阶段 5 必须替换为管理员角色守卫、CSRF 防护和限流。
- API 响应契约尚无前端生成类型 — 在 `apps/admin/src/api` 手写最小 DTO 类型，并通过测试固定字段边界。
- 前端首次引入依赖 — 使用独立 `apps/admin/package.json` 和锁文件，不影响 `apps/api` 依赖。

### 方案决策

采用“前端可运行壳 + 后端最小管理 API + 组件/接口测试”的纵切方案。相比只做静态页面，该方案能验证真正的数据流和密钥脱敏；相比一次实现完整认证和统计系统，范围保持在阶段 4 验收目标内。

## 四、实施计划

1. 新增 React + Vite 管理后台骨架、依赖、路由、布局、API Client 和页面测试。
2. 先写前端和后端测试形成 RED，再实现 Dashboard、Models、Coach Config、Knowledge Cards、Agent Runs。
3. 新增管理 API Service/Controller，覆盖教练配置、知识卡和 Agent Run 的分页、草稿、发布和脱敏读取。
4. 更新 TDD 证据和 MVP 执行清单，运行前端/后端测试、类型检查、构建和覆盖率。
5. 提交阶段分支并使用 `git merge --no-ff` 合并到 `main`，不创建阶段 5 分支。

## 五、实施结果

### 已完成改动

新增 `apps/admin` React + Vite 管理后台，完成统一导航、运营总览、模型、教练配置、知识卡和 Agent Run 页面；新增 NestJS 管理模块、分页 DTO、草稿/发布接口、安全摘要映射和生产环境保护守卫；更新 OpenAPI、MVP 清单和 TDD 证据。

### 验证结果

- `cd apps/admin && pnpm test:coverage` — 通过，语句/行覆盖率 81.45%。
- `cd apps/admin && pnpm typecheck && pnpm build` — 通过。
- `cd apps/api && pnpm typecheck && pnpm build && pnpm test` — 通过；15 个测试套件、83 个测试通过。
- `cd apps/api && NODE_ENV=test DATABASE_ENABLED=false pnpm generate:openapi` — 通过。
- `git diff --check` — 通过。

### 限制和后续工作

- 真实管理员认证、JWT、角色权限、CSRF、限流、审计、复杂统计和 Playwright 浏览器 E2E 留待阶段 5 或后续增强；Vite 产物存在大 chunk 警告。
