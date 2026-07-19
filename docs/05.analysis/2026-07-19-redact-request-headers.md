# 修复请求日志敏感头脱敏

- 日期：2026-07-19
- 状态：已完成
- 需求来源：内测发布 HTTP 冒烟时发现 API 请求日志输出完整 `Authorization` 头。

## 一、需求说明

### 问题

本地发布冒烟请求带有 Bearer Token 时，API 请求日志输出了完整请求头，包含 `authorization` 明文。该行为会让访问令牌、Cookie、API Key 等凭据进入日志系统，属于发布前安全阻塞项。

### 预期结果

请求日志继续保留方法、路径、状态码和耗时等排障字段，但敏感请求头必须被统一脱敏，不再输出明文凭据。

### 验收标准

- [x] `authorization`、`cookie`、`set-cookie`、`x-api-key` 等敏感头在日志对象中被替换为 `[Redacted]`。
- [x] 请求日志中仍保留非敏感请求上下文和已有结构化字段。
- [x] 相关 API 测试、类型检查、发布验收和冒烟检查通过。

### 非目标

- 不移除请求日志能力。
- 不改变 API 请求响应契约。
- 不清理本地数据库中的临时冒烟用户；该状态不进入 Git。

### 假设和待确认问题

- 假设：采用 Pino 原生 redaction 能覆盖 `pino-http` 默认序列化出的请求头字段。
- 待确认：暂无；这是发布前安全缺陷，应直接修复。

## 二、当前状态

- 相关文件和符号：`apps/api/src/common/request-logger.ts:createRequestLogger` — 创建 `pino-http` logger，但未配置敏感字段脱敏。
- 相关文件和符号：`apps/api/test/request-logger.e2e-spec.ts` — 只覆盖稳定字段和中间件创建，不覆盖日志脱敏。
- 现有行为：HTTP 冒烟日志输出完整 `authorization` 请求头。
- 现有测试或检查：`./scripts/verify-release.sh` 已通过，但未捕获该日志泄露风险。

## 三、功能分析

### 范围和受影响组件

- `request-logger.ts` — 配置 Pino redaction 路径。
- `request-logger.e2e-spec.ts` — 增加日志脱敏单元测试。
- 本分析记录 — 记录安全问题、修复依据和验证结果。

### 行为和数据流

Express 请求进入 `pino-http` 中间件后，默认序列化 `req.headers`。Pino 在输出日志前按 redaction path 替换敏感字段；自定义的 `method`、`path`、`statusCode`、`durationMs` 字段保持不变。

### 边界条件和失败处理

- 头字段大小写由 Node HTTP 归一化为小写，redaction path 按小写配置。
- 非敏感头不脱敏，避免降低排障价值。
- 错误日志和成功日志都走同一 logger 配置。

### 风险和兼容性

- 风险：配置路径遗漏某个常见敏感头。缓解：覆盖 Authorization、Cookie、Set-Cookie、X-API-Key、X-Auth-Token 和代理认证头。
- 风险：测试直接依赖日志字符串较脆弱。缓解：使用 JSON 行解析验证字段，不匹配完整日志格式。

### 方案决策

使用 Pino 原生 `redact` 配置，而不是在中间件中手写 header 复制逻辑。该方案集中、低侵入，并同时覆盖成功与错误日志。

## 四、实施计划

1. 补充请求日志测试，构造带敏感头的请求并断言日志输出脱敏。
2. 在 `createRequestLogger` 的 Pino logger 配置中增加敏感路径 redaction。
3. 执行 `pnpm test -- request-logger.e2e-spec.ts`、API 类型检查、发布验收脚本和 HTTP 冒烟。
4. 回填本分析记录，提交并合并回 `main`。

## 五、实施结果

### 已完成改动

在 `apps/api/src/common/request-logger.ts` 中新增 `REQUEST_LOG_REDACT_PATHS`，并将其接入 Pino logger 的 `redact` 配置，统一脱敏 `authorization`、`cookie`、`set-cookie`、`x-api-key`、`x-auth-token` 和 `proxy-authorization` 请求头。更新 `apps/api/test/request-logger.e2e-spec.ts`，解析 Pino JSON 日志并断言敏感头被替换为 `[Redacted]`，非敏感头继续保留。

### 验证结果

- `cd apps/api && pnpm test -- request-logger.e2e-spec.ts` — 通过；3 个测试通过
- `cd apps/api && pnpm typecheck` — 通过
- `./scripts/verify-release.sh` — 通过；API 18 个测试套件、122 个测试通过，管理后台 7 个测试文件、8 个测试通过，Flutter 4 个测试通过
- `GET /api/v1/models` 携带探测用 `Authorization` 和 `X-API-Key` 请求头 — 通过；返回 401，运行时日志中两个请求头均显示为 `[Redacted]`

### 限制和后续工作

- 本地数据库中为发布冒烟创建过临时邀请码、临时用户和会话；这些属于本机验证状态，不进入 Git。
- 后续接入集中日志平台时，应保留或复核同等敏感字段脱敏规则。
