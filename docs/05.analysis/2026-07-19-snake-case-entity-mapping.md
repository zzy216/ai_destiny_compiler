# 修复实体字段数据库列名映射

- 日期：2026-07-19
- 状态：已完成
- 需求来源：用户要求“继续下一步”，执行内测发布数据库准备时发现真实 PostgreSQL 种子数据失败。

## 一、需求说明

### 问题

发布清单中的本地数据库准备已完成迁移检查，但执行 `pnpm seed` 失败，错误为 `column User.passwordHash does not exist`。迁移创建的是 snake_case 列名，例如 `password_hash`，而 TypeORM 实体属性为 camelCase，当前配置缺少统一列名映射策略。

### 预期结果

实体属性继续使用 TypeScript camelCase，运行时访问 PostgreSQL 时统一映射到迁移定义的 snake_case 列名；本地 `migration:run`、`seed` 和发布验收脚本可通过。

### 验收标准

- [x] TypeORM 实体元数据中的 camelCase 属性映射到 snake_case 数据库列名。
- [x] `pnpm seed` 可在已迁移的本地开发库上完成。
- [x] 发布验收脚本 `./scripts/verify-release.sh` 通过。
- [x] 工作区不提交本地 `.env`、凭据或数据库状态。

### 非目标

- 不新增或修改数据库 migration。
- 不改变 API 请求响应字段命名。
- 不执行远程部署、推送或 Apifox 外部导入。

### 假设和待确认问题

- 假设：迁移定义的 snake_case 是数据库真相源；实体映射应向迁移对齐。
- 待确认：真实内测环境仍需按清单提供正式数据库账号、密钥和备份策略。

## 二、当前状态

- 相关文件和符号：`apps/api/src/database/entities.ts` — 实体属性大量使用 camelCase，表名已显式指定。
- 相关文件和符号：`apps/api/src/database/migrations.ts` — 迁移使用 snake_case 列名。
- 相关文件和符号：`apps/api/src/database/database.config.ts` — 当前未配置 TypeORM naming strategy。
- 相关文件和符号：`apps/api/src/database/seed.ts` — 通过 Repository 写入实体属性，真实数据库执行时触发列名不匹配。
- 现有行为：单元测试和契约测试通过，但它们没有验证实体元数据与真实迁移列名一致。
- 现有测试或检查：`./scripts/verify-release.sh` 通过；本地 `pnpm migration:run` 通过且显示无待执行迁移；`pnpm seed` 失败。

## 三、功能分析

### 范围和受影响组件

- `database.config.ts` — 增加全局 snake_case 命名策略。
- 数据库契约测试 — 增加实体属性到数据库列名的元数据回归测试。
- 本分析记录 — 记录发布数据库准备中发现的缺陷和验证结果。

### 行为和数据流

TypeORM Repository 仍接收实体属性名，例如 `passwordHash`；生成 SQL 时通过命名策略转换为 `password_hash`。该变化只影响 ORM 到数据库的映射，不影响 DTO、OpenAPI 或前端字段。

### 边界条件和失败处理

- 显式表名保持不变，避免把 `model_configs` 等表名二次推导。
- `id`、`email` 等本身不是 camelCase 的字段保持原名。
- 本地数据库已有历史表时，只修复 owner/权限和运行验证，不写入仓库。

### 风险和兼容性

- 风险：命名策略可能影响未来自动生成的索引或约束名称。缓解：当前迁移已显式创建约束，且生产运行固定 `synchronize=false`，不会自动改 schema。
- 风险：外部内测环境没有相同本地账号。缓解：只把正式环境准备保留在发布清单，不把本地临时密钥提交。

### 方案决策

采用 TypeORM 全局 naming strategy 将 camelCase 转为 snake_case，而不是为每个 `@Column` 手写 `name`。该方案改动集中、覆盖完整，也能保护后续新增实体字段。

## 四、实施计划

1. 先补数据库契约测试，证明实体元数据列名必须是 snake_case。
2. 增加 TypeORM snake_case naming strategy 并接入 `databaseOptions`。
3. 执行相关 API 测试、类型检查、迁移、种子和发布验收。
4. 回填本分析记录，提交并合并回 `main`。

## 五、实施结果

### 已完成改动

新增 `apps/api/src/database/snake-naming.strategy.ts`，通过 TypeORM naming strategy 将实体属性列名统一转换为 snake_case；在 `apps/api/src/database/database.config.ts` 接入该策略。更新 `apps/api/test/database.contract.e2e-spec.ts`，显式构建实体元数据并验证所有实体列名与迁移使用的 snake_case 约定一致。

TDD 过程：先提交会失败的元数据回归测试，失败点为 `passwordHash` 映射成 `passwordHash`；接入命名策略后同一测试通过。随后使用本地 PostgreSQL 开发库验证 `migration:run`、`seed`、API 启动和关键 HTTP 冒烟。

### 验证结果

- `pnpm test -- database.contract.e2e-spec.ts --runInBand` — 先失败后通过；失败原因为 `passwordHash` 未映射到 `password_hash`
- `pnpm migration:show` — 通过；20 个 migration 均已应用
- `pnpm migration:run` — 通过；无待执行 migration
- `pnpm seed` — 通过；输出 `seed_completed`，知识卡数量 12
- `./scripts/verify-release.sh` — 通过；API 18 个测试套件、121 个测试通过，管理后台 7 个测试文件、8 个测试通过，Flutter 4 个测试通过
- `GET /api/health` — 通过；返回 200，数据库状态 `up`
- `GET /api/docs-json` — 通过；返回 200
- `POST /api/v1/auth/login` — 通过；种子普通用户可登录
- `GET /api/v1/models` — 通过；返回 1 个已发布可选模型
- `POST /api/v1/conversations` — 通过；可创建绑定种子模型的会话

### 限制和后续工作

- 本地开发库为验证临时准备了应用角色、表 owner 和种子数据；这些外部状态不进入 Git。
- 正式内测环境仍需按发布清单准备正式数据库账号、密钥、备份、Apifox 导入和部署后人工冒烟。
