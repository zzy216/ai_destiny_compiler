# 补充项目生成文件的 Git 忽略规则

- 日期：2026-07-17
- 状态：已完成
- 需求来源：用户请求“哪些文件是不需要提交的帮我加到忽略里面，然后使用中文对本次修改进行提交”

## 一、需求说明

### 问题

项目已有部分 Git 忽略规则，但 TypeScript 开启了增量编译，可能产生不应提交的 `*.tsbuildinfo` 文件。

### 预期结果

补充生成文件的忽略规则，避免本地编译元数据进入版本库，并以中文提交本次修改。

### 验收标准

- [x] `.gitignore` 忽略 `*.tsbuildinfo`。
- [x] 源码、锁文件、OpenAPI 文件和文档仍可正常被 Git 跟踪。
- [x] Git 状态确认忽略规则生效，并创建中文提交。

### 非目标

- 不删除或修改现有本地生成目录。
- 不新增与当前项目无关的编辑器或工具专用忽略规则。

### 假设和待确认问题

- 假设：`tsconfig.json` 中的 `incremental: true` 会生成 TypeScript 增量编译元数据，因此使用全局 `*.tsbuildinfo` 规则覆盖项目内所有此类文件。
- 待确认：暂无。

## 二、当前状态

- 相关文件和符号：`.gitignore` — 当前已忽略 `.DS_Store`、`node_modules/`、`dist/`、`coverage/`、环境文件和日志。
- 相关文件和符号：`apps/api/tsconfig.json:compilerOptions.incremental` — 已开启增量编译。
- 现有行为：`apps/api/coverage/`、`apps/api/dist/`、`apps/api/node_modules/` 和 `apps/api/.env` 当前已被忽略；工作区开始时无未提交改动。
- 现有测试或检查：本次为 Git 配置变更，暂无专门测试。

## 三、功能分析

### 范围和受影响组件

- `.gitignore` — 增加 TypeScript 增量编译元数据的忽略规则。
- `docs/05.analysis/2026-07-17-ignore-generated-files.md` — 记录需求、依据、实施和验证结果。

### 行为和数据流

TypeScript 增量编译产生 `*.tsbuildinfo` → Git 根据 `.gitignore` 将其视为忽略文件 → 该文件不会进入待提交变更。

### 边界条件和失败处理

- 已被 Git 跟踪的 `*.tsbuildinfo` 不会因新增忽略规则自动移出版本库；当前仓库未发现此类已跟踪文件。
- `.env.example` 继续通过现有否定规则保留跟踪。

### 风险和兼容性

- 全局匹配 `*.tsbuildinfo` 可能忽略任意目录下的同类生成文件，但这些文件均为本地编译元数据，不影响运行时或源码交付。

### 方案决策

采用最小改动，在现有日志规则后增加 `*.tsbuildinfo`。不扩展到未被项目配置或当前产物证明的编辑器缓存规则，避免误忽略可能需要共享的项目配置。

## 四、实施计划

1. 更新根目录 `.gitignore`，增加 `*.tsbuildinfo`。
2. 创建本分析记录，并在完成后回填验证结果。
3. 使用 Git 检查忽略规则、工作区状态和提交内容，然后创建中文提交。

## 五、实施结果

### 已完成改动

在根目录 `.gitignore` 中增加 `*.tsbuildinfo`，用于忽略 TypeScript 增量编译生成的本地元数据；新增本分析记录并完成验证信息回填。实际改动与计划一致。

### 验证结果

- `git diff --check` — 通过
- `git check-ignore -v --no-index apps/api/tsconfig.tsbuildinfo` — 通过，命中 `.gitignore:9:*.tsbuildinfo`
- `git ls-files -- '*.tsbuildinfo'` — 通过，未发现已跟踪文件
- `git status --short --ignored` — 通过，现有 `apps/api/.env`、`coverage/`、`dist/`、`node_modules/` 等本地产物保持忽略

### 限制和后续工作

- 暂无。
