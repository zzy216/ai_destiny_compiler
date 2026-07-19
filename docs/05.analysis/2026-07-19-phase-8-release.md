# 实施阶段 8 测试和发布

- 日期：2026-07-19
- 状态：已完成
- 需求来源：用户要求“继续下一步”，依据 MVP 清单在阶段 7 合并后进入阶段 8。

## 一、需求说明

### 问题

阶段 0 到阶段 7 已完成主要 MVP 业务闭环，但发布前仍缺少统一验收入口、发布检查文档和面向安全边界的最终契约测试。当前验证命令分散在各应用目录，后续内测前容易遗漏后端、管理后台、Flutter 客户端或生成契约检查。

### 预期结果

从最新 `main` 创建 `codex/phase-8-release`，补齐 MVP 发布前检查能力：提供一键本地验收脚本、阶段 8 发布清单、必要的安全/契约回归测试，并更新 MVP 执行清单和 TDD 证据。

### 验收标准

- [x] 仓库提供可重复执行的发布前验收脚本，覆盖 API、管理后台和 Flutter 客户端的测试、类型检查或构建。
- [x] API 契约测试覆盖敏感字段不外泄、受保护路径认证、管理路径权限和基础安全响应头。
- [x] 发布清单明确本地环境、数据库迁移、种子数据、OpenAPI、备份和回滚检查项。
- [x] MVP 执行清单标记阶段 8 已完成，并保留 Apifox 导入的可执行替代方案。
- [x] 新增或更新阶段 8 TDD 证据。
- [x] 阶段完成前通过相关测试、全量测试、类型检查、构建、覆盖率和 `git diff --check`。

### 非目标

- 不实际推送远程、创建 PR、部署服务器或发布到应用商店。
- 不接入真实 Apifox 账号或外部 CI 服务。
- 不新增业务功能或数据库表。

### 假设和待确认问题

- 假设：阶段 8 的“发布”定义为内测发布准备，不执行真实线上发布。
- 假设：没有外部 CI 时，用仓库脚本作为统一验收入口，后续可迁移到 CI。
- 待确认：暂无；当前范围可以由既有 MVP 清单和阶段工作流确定。

## 二、当前状态

- 相关文件和符号：`apps/api/package.json` — 已有测试、覆盖率、类型检查、构建和 OpenAPI 生成命令。
- 相关文件和符号：`apps/admin/package.json` — 已有测试、覆盖率、类型检查和构建命令。
- 相关文件和符号：`apps/client/pubspec.yaml` — Flutter 客户端已有测试和分析基础配置。
- 相关文件和符号：`apps/api/test/api-contract.e2e-spec.ts` — 已覆盖主要 OpenAPI 路径、统一错误和认证保护，但发布安全边界仍可加强。
- 相关文件和符号：`docs/03.plan/02.MVP执行清单.md` — 阶段 8 尚未开始，Apifox 导入仍未完成。
- 现有行为：各端可以分别执行验证，但没有根目录一键验收脚本和阶段 8 发布检查清单。
- 现有测试或检查：阶段 7 已通过 API 全量测试、覆盖率、类型检查、构建和 OpenAPI 生成；管理后台与 Flutter 需要纳入阶段 8 统一检查。

## 三、功能分析

### 范围和受影响组件

- `scripts/verify-release.sh` — 新增根目录发布前验收入口。
- `apps/api/test/api-contract.e2e-spec.ts` — 加强发布安全契约检查。
- `docs/03.plan/02.MVP执行清单.md` — 更新阶段 8 状态和后续执行顺序。
- `docs/04.testing/13.测试和发布.tdd.md` — 新增阶段 8 TDD 与发布验收证据。
- `docs/06.release/01.MVP内测发布清单.md` — 新增内测发布检查清单。

### 行为和数据流

```text
./scripts/verify-release.sh
→ apps/api: pnpm test:coverage + pnpm typecheck + pnpm build + pnpm generate:openapi
→ apps/admin: pnpm test:coverage + pnpm typecheck + pnpm build
→ apps/client: flutter test + flutter analyze
→ git diff --check
```

### 边界条件和失败处理

- 缺少 `pnpm` — 脚本直接失败并提示安装依赖。
- 缺少 `flutter` — 脚本直接失败并提示跳过条件不满足，避免误报通过。
- 某个子项目命令失败 — 脚本停止并返回非零状态。
- OpenAPI 重新生成后出现未提交差异 — 由后续 `git status` 和阶段提交检查发现。

### 风险和兼容性

- 风险：发布脚本耗时较长。缓解：脚本只用于阶段验收和发布前检查，日常开发仍可运行子项目命令。
- 风险：本机 Flutter 环境不可用导致阶段 8 无法完成。缓解：优先检查环境，真实不可用时在分析记录中如实标记未执行。
- 风险：Apifox 未接入外部账号。缓解：生成并提交 `apps/api/openapi.json`，发布清单记录导入步骤作为可执行替代。

### 方案决策

优先补齐本地可重复验收和发布文档，而不是引入外部 CI 或部署平台。这样能在不依赖第三方账号的情况下，把 MVP 发布前的质量门槛固定到仓库内。

## 四、实施计划

1. 新增 `scripts/verify-release.sh`，串联 API、管理后台、Flutter 和差异检查。
2. 补充 API 契约测试，覆盖安全头、管理权限和敏感字段不外泄。
3. 新增阶段 8 TDD 证据和 MVP 内测发布清单。
4. 更新 MVP 执行清单和本分析记录。
5. 执行相关测试、全量验收脚本、类型检查、构建、覆盖率和 `git diff --check`，通过后提交并合并回 `main`。

## 五、实施结果

### 已完成改动

新增 `scripts/verify-release.sh`，把 API 覆盖率、类型检查、构建、OpenAPI 生成，管理后台覆盖率、类型检查、构建，Flutter 测试、静态分析和空白差异检查串成统一发布前验收入口。加强 `apps/api/test/api-contract.e2e-spec.ts`，新增安全响应头、受保护 OpenAPI 操作 bearer auth 声明、公开响应 schema 不暴露存储态密钥字段的发布安全契约测试。新增 MVP 内测发布清单和阶段 8 TDD 证据，并更新 MVP 执行清单。

### 验证结果

- `cd apps/api && pnpm test -- api-contract.e2e-spec.ts` — 通过；1 个测试套件、14 个测试通过。
- `./scripts/verify-release.sh` — 通过；API 18 个测试套件、120 个测试通过；管理后台 7 个测试文件、8 个测试通过；Flutter 4 个测试通过；API/管理后台类型检查和构建、OpenAPI 生成、Flutter analyze、`git diff --check` 均通过。

### 限制和后续工作

- 未接入外部 CI、真实部署环境或应用商店发布流程；本阶段只固定仓库内内测发布准备。
- Apifox 导入需要在外部工具中手动执行，仓库侧以 `apps/api/openapi.json` 和内测发布清单作为可重复输入。
