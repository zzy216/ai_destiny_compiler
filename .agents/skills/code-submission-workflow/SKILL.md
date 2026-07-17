---
name: code-submission-workflow
description: 统一管理需求开发的 Git 分支、提交和合并流程。适用于功能开发、缺陷修复、重构、配置变更、文档改动及其他需要修改项目文件的任务：开始需求时从最新本地 main 创建需求分支，完成并验收后提交，再使用 --no-ff 合并回 main；下一项需求重新从 main 创建新分支。
---

# 代码提交工作流

执行本技能时，严格保持“一项需求一个分支”。需求分支完成并提交后必须合并回 `main`；合并后保留需求分支，但不在该分支继续做下一项需求。

与 `$requirement-analysis-log` 配合使用：提交工作流负责 Git 生命周期，需求分析技能负责记录需求目标、范围、决策和验证证据。

## 一、开始新需求

1. 检查仓库状态和当前分支：

   ```bash
   git status --short --branch
   git branch --show-current
   ```

2. 新需求开始时必须切换到本地 `main`：

   ```bash
   git switch main
   git status --short --branch
   ```

   `main` 不干净时停止，不 stash、reset 或覆盖用户修改。远程同步不是默认步骤；需要 `fetch`、`pull` 或处理远程分歧时先取得用户授权。

3. 从干净的 `main` 创建本需求分支，分支名使用英文短横线 slug：

   ```bash
   git switch -c codex/feature-{英文slug}
   ```

   分支已存在时停止并报告，不覆盖或复用未确认归属的分支。阶段任务可继续使用项目约定的 `codex/phase-{编号}-{英文slug}`，但仍必须从最新 `main` 创建。

4. 在需求分支上先使用 `$requirement-analysis-log` 建立或更新需求分析记录，再修改代码或文档。

## 二、开发与提交

1. 只修改当前需求范围内的代码、测试、配置和文档；保留用户已有的无关修改并报告重叠。
2. 按项目要求执行相关测试、类型检查、构建、覆盖率和文档检查。需求未验收通过前，不创建完成提交，不合并到 `main`。
3. 提交前执行：

   ```bash
   git diff --check
   git status --short
   ```

4. 使用中文 Conventional Commit。允许按证据拆分多个提交，最后必须有一个清晰的需求完成提交：

   ```text
   test: 补充……测试
   feat: 实现……
   fix: 修复……
   refactor: 重构……
   docs: 更新……
   chore: 调整……
   ```

   提交前显式添加本需求文件，禁止提交密钥、`.env`、凭据、构建产物和无关文件。

## 三、完成并合并

需求验收通过、提交完成且需求分支工作区干净后，立即合并回 `main`：

```bash
git status --short --branch
git switch main
git status --short --branch
git merge --no-ff codex/feature-{英文slug} -m "merge: 合并需求 {需求slug}"
git status --short --branch
git log --graph --oneline --decorate -n 6
```

合并前确认：

- `main` 工作区干净；
- 需求分支包含完成提交；
- 验收、测试和分析记录已回填；
- 合并提交使用 `merge: 合并需求 {需求slug}`。

合并后：

- 保留需求分支，作为审查和回滚依据；
- 不在已合并分支继续实现下一项需求；
- 不自动推送远程、不自动创建 PR；
- 向用户报告需求提交、合并提交和验证结果。

## 四、失败处理

- `main` 不干净 — 停止并报告，不 stash、reset、checkout 覆盖或删除用户修改。
- 测试、类型检查、构建或验收失败 — 留在需求分支修复，不合并。
- 分支已存在 — 停止并确认分支归属，不强制删除或覆盖。
- 合并冲突 — 停止报告冲突文件；若冲突由本次刚发起且没有用户介入，可执行 `git merge --abort`，否则保留现场并请求处理。
- 需要推送、创建 PR、删除已合并分支或同步远程 — 仅在用户明确授权后执行。

## 五、下一项需求

收到新的需求后，重新从最新本地 `main` 开始本技能流程，创建新的 `codex/feature-{英文slug}` 分支。没有新需求时，不自动创建分支、不自动开始工作。
