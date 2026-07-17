# 将代码提交流程封装为技能

- 日期：2026-07-18
- 状态：已完成
- 需求来源：用户请求“把代码提交逻辑改为一个技能。首先从主分支开一个分支，做需求。需求做完则提交并且合并到主分支。然后新需求再开一个分支。”

## 一、需求说明

### 问题

现有分支与提交规则主要写在 MVP 计划文档中，执行新需求时需要重复查找并手动遵循；同时旧规则以“阶段”为中心，不能直接约束任意新需求的开始、提交和合并。

### 预期结果

新增一个项目技能，统一执行“从最新 `main` 创建需求分支 → 在需求分支完成开发和提交 → 合并回 `main` → 下一需求重新从 `main` 创建分支”的流程。

### 验收标准

- [x] 新增合法的 `code-submission-workflow` 技能，能被需求开发、修复、重构和配置变更类任务触发。
- [x] 技能明确要求先检查 `main` 工作区，再创建需求分支，不允许直接在 `main` 开发。
- [x] 技能明确需求完成后的提交、验收、`--no-ff` 合并和冲突处理规则。
- [x] 技能明确合并后保留需求分支，下一需求从最新 `main` 重新开分支。
- [x] 技能元数据通过校验，项目文档与技能的流程描述一致。

### 非目标

- 不自动推送远程分支或创建 Pull Request。
- 不改写已有 Git 历史，不删除现有阶段分支。
- 不创建自动化 Git Hook 或脚本；流程由技能约束代理行为。

### 假设和待确认问题

- 假设：需求分支使用 `codex/feature-{英文slug}` 命名；阶段分支仍可沿用项目已有的 `codex/phase-{编号}-{英文slug}` 命名。
- 假设：合并使用本地 `git merge --no-ff`；远程同步、推送和 PR 仍需单独授权。
- 待确认：暂无；后续如需接入 CI、PR 或自动化脚本，再单独扩展技能。

## 二、当前状态

- 相关文件：`.agents/skills/requirement-analysis-log/SKILL.md` — 现有项目技能，规定实施需求的分析记录流程。
- 相关文件：`docs/03.plan/01.MVP下一步实施计划.md`、`docs/03.plan/02.MVP执行清单.md` — 已记录阶段分支和合并规则，但没有可复用的通用技能。
- Git 状态：已从 `main` 创建本需求分支 `codex/feature-code-submission-workflow`；当前仅有新技能模板未跟踪。
- 现有检查：上一需求已验证阶段 3 使用阶段分支提交并通过 `--no-ff` 合并到 `main`。

## 三、功能分析

### 范围和受影响组件

- `code-submission-workflow/SKILL.md` — 定义需求分支、开发、提交、验收和合并的强制流程。
- `code-submission-workflow/agents/openai.yaml` — 提供技能列表中的中文名称、描述和默认提示词。
- MVP 计划文档 — 增加通用技能引用，保留阶段特有的命名和验收要求。
- 本分析记录 — 保存本次技能设计、实施和验证证据。

### 行为和数据流

```text
新需求
→ 检查当前状态
→ 切换并确认最新 main
→ 创建 codex/feature-{slug}
→ 需求分析与开发
→ 测试、检查、文档回填
→ 在需求分支提交
→ 切换 main 并 --no-ff 合并
→ 保留需求分支
→ 等待下一需求并重复
```

### 边界条件和失败处理

- `main` 或当前工作区不干净 — 停止分支操作，报告未提交修改，保留用户内容。
- 需求验收失败 — 不创建完成提交，不合并到 `main`，继续在需求分支修复或等待用户决定。
- 合并冲突 — 停止并报告冲突文件；不使用强制重置或覆盖用户修改。
- 用户要求推送或创建 PR — 在本地合并完成后，再按用户明确授权执行。

### 风险和兼容性

- 技能规则与旧阶段文档重复 — 以技能作为通用执行入口，阶段文档保留阶段编号、验收和历史说明。
- 本地 `main` 不是远程最新 — 技能只确认本地基线；需要远程同步时提示用户或按明确授权执行。
- 需求分支残留 — 合并后保留分支，避免丢失审查和回滚依据。

### 方案决策

新增独立的项目技能，而不是继续扩展需求分析技能。需求分析技能负责“为什么改、改什么、如何验证”，提交工作流技能负责“从哪里开始、在哪个分支工作、何时提交和如何合并”；两者职责清晰且可以组合使用。

## 四、实施计划

1. 用技能创建工具初始化 `.agents/skills/code-submission-workflow/`，补齐 `SKILL.md` 和 `agents/openai.yaml`。
2. 将通用分支、提交、合并和失败处理规则写入技能，并在 MVP 计划中增加技能引用。
3. 运行技能校验、Markdown/Git 差异检查，提交本需求分支。
4. 使用 `git merge --no-ff` 将本需求分支合并到 `main`，不创建下一需求分支。

## 五、实施结果

### 已完成改动

新增 `.agents/skills/code-submission-workflow/SKILL.md` 和 `agents/openai.yaml`，定义从 `main` 开始、创建 `codex/feature-{slug}` 需求分支、需求验收后提交并使用 `--no-ff` 合并回 `main` 的完整流程；合并后保留需求分支，下一项需求重新从 `main` 开始。MVP 计划和执行清单已增加技能引用；本次需求分支为 `codex/feature-code-submission-workflow`。

### 验证结果

- `python3 /Users/zzy/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/code-submission-workflow` — 未执行成功，当前 Python 环境缺少 `yaml` 模块。
- `ruby -e 'require "yaml"; ...'` — 通过，`agents/openai.yaml` 可解析且包含必需元数据。
- `awk ... .agents/skills/code-submission-workflow/SKILL.md` — 通过，技能名称和描述前置字段有效。
- `rg -n "main|codex/feature|merge --no-ff|requirement-analysis-log" .agents/skills/code-submission-workflow/SKILL.md` — 通过，核心流程指令齐全。
- `git diff --check` — 通过。

### 限制和后续工作

- 技能校验脚本仍需在安装 `PyYAML` 的环境中重新运行；本次不修改全局 Python 环境。
- 不自动推送远程、不创建 Pull Request；下一项需求需由用户明确提出后再从 `main` 创建分支。
