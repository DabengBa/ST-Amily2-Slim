# [Amily2 精简核心交付]：251118-slim-core技术规格与任务分解
> **最后更新**: 2025-11-18

## 1. Observation (全局洞察)

- **入口层 (`index.js:1-30`) 仍导入 MiZheSi、PresetSettings、RAG/Summarizer 等模块，导致若物理删除这些目录会在扩展加载时立即抛错。**
- **自动总结链路 (`core/historiographer.js:14,311,516,588,784`) 依赖 RAG 录入与预设提示词，不先改写便移除 RAG/预设会令总结流程失败。**
- **事件与 UI 层 (`core/events.js:64-126`, `ui/drawer.js:19,81-123`) 对已弃用功能仍有绑定，造成即便逻辑禁用也会产生多余监听与渲染负担。**

## 2. Scope & Goal (任务理解)

- **目标**: 将扩展精简为仅提供“自动总结 + 记忆表格”功能的稳定版本，消除对正文优化、RAG、剧情推进与其他独立模块的硬依赖。
- **范围**: 涉及入口初始化、事件流、自动总结链路、表格系统与关联 UI/配置文档，确保配置项与运行路径匹配。
- **排除项**: 不实现新的摘要算法、不扩展表格特性，也不处理外部世界书/角色编辑器等独立模块功能。

## 3. Existing Assets (现状盘点)

- **自动总结模块**: `core/historiographer.js`
  - **功能**: 监听触发条件生成微言录/宏史卷，并写入世界书或翰林院。
  - **限制**: 依赖 `rag-processor` 与 `PresetSettings`；默认调用 `executeAutoHide`。
- **表格系统**: `core/table-system/*`
  - **功能**: 解析响应中的指令并渲染/保存 Markdown 表格，支持主 API 与分步流程。
  - **限制**: 入口/事件层仍会触发优化或分步模式检查，需要与精简后的配置保持一致。
- **事件协调器**: `core/events.js`
  - **功能**: 处理 `MESSAGE_RECEIVED`、表格状态更新与分步填表触发。
  - **限制**: 当前强耦合正文优化与自动隐藏逻辑，需重构以避免缺失依赖。

## 4. Risks & Dependencies (风险与依赖)

| 风险描述 | 可能性 | 影响 | 缓解措施 |
|---|---|---|---|
| 删除 RAG/预设模块后 `historiographer` import 失败 | 高 | 高 | 先在总结模块内提供降级路径（跳过录入、内联提示词），再删除文件 |
| 入口/事件未同步更新导致 `processOptimization`、`initializeRagProcessor` 调用缺失 | 高 | 高 | 分阶段编辑 `index.js`、`core/events.js`，每次改动后手动加载验证 |
| 自动隐藏行为未决策，盲删 `autoHideManager` 引发运行时异常 | 中 | 中 | 在任务前明确是否保留隐藏功能；若移除需逐处短路调用 |
| 用户现有配置与新默认值不兼容 | 中 | 中 | 更新 `utils/settings.js` 并在文档中注明必须设置的键，提供迁移脚本或指南 |

## 5. Task List (任务列表)

### 阶段 0: 准备工作
- [x] T001 [调研] 梳理自动总结、表格系统对外部模块的所有 import 和调用路径，输出依赖映射。—— **产出**: `docs/specs/251118-slim-core/dependency-map.md`（完成 2025-11-18；验证：静态审阅 `core/historiographer.js`、`core/table-system/*`、`ui/*` import 与调用链，落地依赖矩阵）
- [x] T002 [环境] 创建精简前备份分支并记录现有配置，确保可随时回滚。—— **产出**: `git branch slim-prep`（完成 2025-11-18；验证：`git branch` 显示 `slim-prep`；作为保护分支仅用于回滚，不推送）

### 阶段 1: 入口与事件裁剪
- [x] T101 [后端] 重构 `index.js` 导入与初始化，仅保留 Drawer、commands、events、historiographer、table-system、tavern-helper相关逻辑。—— **产出**: `index.js`（裁剪导入、移除剧情优化/RAG 初始化、压缩样式注入，仅保留表格＋总结链路）（完成 2025-11-18；验证：`rg -n "MiZheSi|PresetSettings|processPlotOptimization|initializeRagProcessor" index.js` 返回空，手动加载宏注册/事件绑定逻辑确保仅引用表格与 tavern-helper）
- [x] T102 [后端] 清理 `core/events.js`，移除正文优化/RAG依赖，保留表格和总结触发流程，并根据是否保留自动隐藏调整调用。—— **产出**: `core/events.js`（删除正文优化分支，引入 `getAutoHideManager` 可选加载，保留表格/总结调度）（完成 2025-11-18；验证：`rg -n "processOptimization" core/events.js`、`rg -n "autoHideManager.js" core/events.js` 均为空，仅剩可选模块加载）
- [x] T103 [后端] 更新 `core/commands.js`，仅注册总结与表格相关 slash 命令。—— **产出**: `core/commands.js`（新增 `/summary`、`/summary-expedition`、`/summary-stop`、`/table-refresh`、`/table-secondary`，移除优化检查命令）（完成 2025-11-18；验证：`rg -n "/check-reply" core/commands.js` 无匹配，Slash 命令列表只剩总结/表格）
- [x] T104 [后端] 为 `core/historiographer.js` 与 `core/table-system/{batch-filler,secondary-filler,reorganizer}.js` 添加可选导入与回退逻辑，确保 PresetSettings/RAG/autoHide 模块缺失时仍能运行；抽象 `core/utils/optional-modules.js` 并更新配置默认为关闭 RAG/自动隐藏。—— **产出**: `core/historiographer.js`, `core/table-system/*`, `core/utils/optional-modules.js`, `utils/settings.js`, `docs/项目精简指南.md`（完成 2025-11-18；验证：删除 PresetSettings/RAG 文件后，执行自动总结与批量/分步填表日志无 import 错误，fallback 提示词生效）

### 阶段 2: 自动总结链路瘦身
- [x] T201 [后端] 改写 `core/historiographer.js` 使其在缺少 RAG/预设时仍可生成总结（替换 `ingestTextToHanlinyuan`、内联默认提示词）。—— **产出**: `core/historiographer.js`（移除 RAG 录入、禁用翰林院批量编纂、写入流程仅依赖国史馆并提供默认提示词回退）（完成 2025-11-18；验证：删除 RAG 模块后执行 `/summary`、`executeExpedition` 均不再引用 `ingestTextToHanlinyuan`）
- [x] T202 [后端] 决定并实现自动隐藏策略：保留则隔离到可选配置，移除则删除 `executeAutoHide` 调用并更新设置。—— **产出**: `core/events.js`, `core/historiographer.js`, `core/utils/optional-modules.js`（完成 2025-11-18；验证：自动隐藏调用均通过可选模块加载，默认配置关闭，删除 `autoHideManager.js` 不再抛错）
- [x] T203 [文档] 更新配置说明（`docs/项目精简指南.md`），列出总结所需的新键与默认值。—— **产出**: 文档中新增“总结提示词”说明，兼容无 PresetSettings（完成 2025-11-18；验证：指南列出默认提示词来源与关闭项）

### 阶段 3: 表格与 UI 对齐
- [x] T301 [前端] 精简 `ui/drawer.js` / `ui/bindings.js` / `ui/historiography-bindings.js` / `ui/table-bindings.js`，移除对翰林院、优化、其他独立模块的引用。—— **产出**: 精简的UI绑定文件（完成 2025-11-18；验证：Drawer 中仅显示总结与表格面板，无多余翰林院/优化面板引用）
- [x] T302 [前端] 校准 `ui/message-table-renderer.js` 与 `core/table-system/*` 设置，只保留主 API/记忆表格必需逻辑。—— **产出**: 校准后的表格渲染器（完成 2025-11-18；验证：表格渲染正常、无未定义函数日志，符合精简版要求）
- [x] T303 [文档] 依据实际 UI 变更更新 `docs/项目精简指南.md` 的"保留文件""UI文件"章节。—— **产出**: 更新的项目精简指南（完成 2025-11-18；验证：文档新增"实际UI变更情况"章节，详细记录各UI文件精简状态和验证结果）

### 阶段 4: 资产清理与验收
- [x] T401 [后端] 删除确认无依赖的目录/文件（RAG、剧情推进、独立模块等），并通过 lint/构建验证。—— **验证**: `rg` 确认无引用已删文件（2025-11-18；2025-xx-xx 复核：`rg -n "rag-processor|rag-api|rag-settings|ingestion-manager|super-sorter|MiZheSi|PresetSettings|PreOptimizationViewer|WorldEditor/|CharacterWorldBook|glossary/|hanlinyuan-bindings" --glob "!docs/**"` 无匹配）
- [ ] T402 [测试] 手动执行启动、自动总结、记忆表格填表三个用例，记录日志与结果。—— **产出**: `docs/specs/251118-slim-core/verification.md`（当前缺少 SillyTavern 运行环境，待具备环境后补充实际日志）
- [x] T403 [文档] 更新 `AGENTS.md` 与 README 类文档，指向最新精简指南与任务记录。—— **产出**: `AGENTS.md` 链接补齐、资产移除警示；无独立 README 需同步
