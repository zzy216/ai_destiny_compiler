# Destiny Compiler API

当前目录是命运编译器的 NestJS API。已完成认证、模型和会话模块的首批代码契约，并接入 PostgreSQL、TypeORM Entity 和 20 个可逆 Migration。

## 本地命令

```bash
pnpm install
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm build
pnpm generate:openapi
pnpm start:dev
pnpm migration:show
pnpm migration:run
pnpm migration:revert
```

先复制 `.env.example` 为 `.env`，填写 PostgreSQL 连接信息。生产环境固定使用 `synchronize=false`，数据库结构只能通过 Migration 变更。

启动后可访问：

- Swagger UI：`http://localhost:3000/api/docs`
- OpenAPI JSON：`http://localhost:3000/api/docs-json`

仓库内生成文件：[openapi.json](./openapi.json)。

## 当前边界

Controller 已定义路由、DTO、校验、HTTP 状态和 Swagger Schema；模型连接测试路由已接入适配器和数据库版本配置，其余模型 CRUD、认证和会话业务仍会暂时返回 `501 contract_not_implemented`。数据库层已准备好 17 个核心 Entity。
