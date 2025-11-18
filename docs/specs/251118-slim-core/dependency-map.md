# 251118-slim-core / 自动总结与记忆表格依赖映射
> **最后更新**：2025-11-18；编写依据 `core/historiographer.js`、`core/table-system/*` 及相关 UI/工具层代码（main 分支 2025-11-18 提交）。

本文档梳理 Amily2 精简版本需保留的两条核心链路（自动总结 + 记忆表格）在当前代码中的外部依赖，便于后续裁剪 RAG/正文优化/剧情推进等模块时明确“不可断开”的接口与必须实现的降级策略。

---

## 1. 自动总结代理（`core/historiographer.js`）

### 1.1 对外依赖清单

| 外部模块 | 引入符号 | 主要用途 | 断开影响 |
| --- | --- | --- | --- |
| `/scripts/extensions.js` | `getContext`, `extension_settings` | 获取聊天上下文、全局配置，是所有触发/参数读取的入口。 | 无法计算楼层范围、读取用户设置。 |
| `/script.js` | `characters` | 在 `lorebookTarget === "character_main"` 时解析角色所绑定的世界书。 | 无法定位写入/检索目标世界书。 |
| `/scripts/world-info.js` | `world_names`, `loadWorldInfo`, `createNewWorldInfo`, `createWorldInfoEntry`, `saveWorldInfo` | 检索并更新“流水总帐”条目、创建专用世界书。 | 自动总结无法记录进度或写入新条目。 |
| `../utils/settings.js` | `extensionName` | 读取 `extension_settings[extensionName]`。 | 所有设置均变为 `undefined`。 |
| `./lore.js` | `getChatIdentifier` | 生成 `Amily2-Lore-<chatId>` 专用世界书名。 | 无法创建/定位专用世界书。 |
| `./tavernhelper-compatibility.js` | `compatibleWriteToLorebook` | 兼容老版/新版 Tavern Helper 写入 API，负责锁条目 + 更新内容。 | 自动总结写入世界书必定失败。 |
| `./rag-processor.js` | `ingestTextToHanlinyuan` | 当 `historiographyIngestToRag=true` 时向翰林院 RAG 注入总结文本。 | 功能开关为真时会抛错，需要降级逻辑。 |
| `../ui/page-window.js` | `showSummaryModal`, `showHtmlModal` | 手动总结/日志弹窗。 | UI 交互丢失（不会影响核心流程）。 |
| `../PresetSettings/index.js` | `getPresetPrompts`, `getMixedOrder` | 在 `getSummary`/`executeExpedition` 内拼装系统/用户提示链。 | 主模型 prompt 缺失，API 请求易发送空负载。 |
| `./api.js` | `callAI`, `generateRandomSeed` | 提供主模型 API 适配器 + 随机种子。 | 无法请求默认 API。 |
| `./api/Ngms_api.js` | `callNgmsAI` | 当 `settings.ngmsEnabled` 为真时的替代 API。 | 打开 Ngms 时直接抛错。 |
| `./autoHideManager.js` | `executeAutoHide` | 写入世界书后触发自动隐藏。 | 精简版若删除自动隐藏需在此提供空实现或条件调用。 |
| `./utils/rag-tag-extractor.js` | `extractBlocksByTags`, `applyExclusionRules` | `getRawMessagesForSummary` 中做内容裁剪。 | Tag/规则设置失效，需同步 UI。 |

### 1.2 调用链概述

1. **自动触发**：`checkAndTriggerAutoSummary()`（`core/historiographer.js:42` 起）读取设置并计算未总结楼层；依赖 `characters`/`getChatIdentifier` 获取写入目标。
2. **内容提取**：`getRawMessagesForSummary()`（:260 起）用 `extractBlocksByTags` + `applyExclusionRules` 过滤历史消息后生成 `"【第 N 楼】作者: 内容"` 列表。
3. **提示拼装**：`getSummary()`（:308 起）调用 `getPresetPrompts('small_summary')`、`getMixedOrder`，按用户配置插入 jailbreak/summary/核心内容指令，并通过 `callAI` 或 `callNgmsAI` 获取摘要。
4. **写入流程**：`writeSummary()`（:365 起）根据设置分别：
   - 调用 `ingestTextToHanlinyuan` 送往翰林院（需 `rag-processor.js`）。
   - 调用 `compatibleWriteToLorebook` 更新世界书，并在成功后执行 `executeAutoHide()`。
5. **批量总结**：`executeExpedition()`（:486 起）/`executeManualSummary()`（:205 起）共用上述函数；区别在于楼层选择、UI 以及 Ngms/预设 prompt 的组合。

> **关键风险**：若先删除 `rag-processor`、`PresetSettings`、`autoHideManager` 等文件，`core/historiographer.js` 会在 import 阶段即崩溃。裁剪顺序必须先在该文件内部做“依赖可选化/降级逻辑”，再执行物理删除。

---

## 2. 记忆表格系统（`core/table-system/*` + 关联 UI）

### 2.1 模块级依赖矩阵

| 子模块 | 关键引入 | 作用 | 断开影响 |
| --- | --- | --- | --- |
| `manager.js` | `/scripts/extensions.js` (`getContext`, `extension_settings`), `/script.js` (`saveChat`, `saveSettingsDebounced`), `../../utils/utils.js` (`getChatPiece`, `saveChatDebounced`), `../../utils/settings.js` (`extensionName`), `../../ui/table-bindings.js` (`renderTables`), `../../ui/message-table-renderer.js` (`updateOrInsertTableInChat`), `./secondary-filler.js` (`fillWithSecondaryApi`) | 维护内存态、默认模板、聊天消息中嵌入表格 JSON；负责在 UI 与聊天之间同步状态。 | 任何入口（事件、UI）都会因 `manager.js` 中断而无法访问表格，且聊天消息中的 `Amily2TableData` 不再解析。 |
| `batch-filler.js` | `/scripts/extensions.js`, `/script.js` (`characters`), `/scripts/world-info.js`, `./logger.js`, `../../ui/table-bindings.js`, `../../PresetSettings/index.js`, `../api.js`, `../api/NccsApi.js`, `../utils/rag-tag-extractor.js` | 主 API 批量填表（按选中历史消息 + prompt 模板），并在写入后调用 `renderTables()`。 | 主流程失效，Drawer “批量填表”按钮无效。 |
| `secondary-filler.js` | `/scripts/extensions.js`, `/scripts/world-info.js`, `/script.js` (`saveChat`), `../../ui/table-bindings.js`, `../../ui/message-table-renderer.js`, `../../PresetSettings/index.js`, `../api.js`, `../api/NccsApi.js`, `../utils/rag-tag-extractor.js`, `../tavernhelper-compatibility.js` (`safeLorebookEntries`) | 分步填表/副 API，依赖世界书摘录、提示词预设与二次 API 选择。 | 若删除 PresetSettings/RAG，自动分步填表直接抛错；`safeLorebookEntries` 缺失时“世界书上下文”不可用。 |
| `reorganizer.js` | `/scripts/extensions.js`, `/script.js`, `../../ui/table-bindings.js`, `../../PresetSettings/index.js`, `../api.js`, `../api/NccsApi.js` | 表格重整（批量排序/限行），完全沿用批量填表 prompt。 | UI 中“重整表格”操作不可用。 |
| `injector.js` | `/script.js` (`setExtensionPrompt`, `saveChat`), `/scripts/extensions.js`, `../../ui/table-bindings.js`, `../../ui/message-table-renderer.js`, `./manager.js`, `./settings.js`, `../../utils/settings.js`, `./logger.js` | 将 `<Amily2Edit>` 宏注入聊天输入、保存状态。 | 记忆表格无法在对话中注入最新数据。 |
| `table-bindings.js`（UI） | `../core/table-system/manager.js`, `../core/table-system/batch-filler.js`, `/scripts/extensions.js`, `/script.js` (`saveSettingsDebounced`, `eventSource`, `event_types`, `characters`, `this_chid`), `../core/api/NccsApi.js`, `../core/table-system/settings.js`, `../core/tavernhelper-compatibility.js` | Drawer UI，负责展示表格、触发批量/副填表、响应事件。 | UI 无法渲染表格或触发后端逻辑。 |
| `message-table-renderer.js`（UI） | `../core/table-system/manager.js`, `/scripts/extensions.js`, `/scripts/extensions.js` (`getContext`), `../utils/settings.js` | 聊天消息内嵌表格的渲染/高亮。 | 聊天窗口内的表格块消失，影响可视化。 |

### 2.2 依赖特性与影响

1. **PresetSettings 强绑定**  
   - `batch-filler.js:8`, `secondary-filler.js:8`, `reorganizer.js:6` 均调用 `getPresetPrompts`、`getMixedOrder` 来拼装 prompt 列表。  
   - 若裁剪 `PresetSettings/*`，需要在这些文件内提供默认 prompt 数组以及顺序（否则 `messages` 只有随机种子，API 直接返回空内容）。

2. **RAG 标签/排除规则共用 utils**  
   - `core/table-system/*` 与 `core/historiographer.js` 共享 `../utils/rag-tag-extractor.js`。移除 RAG 时需为表格系统保留该工具或在设置中禁用相关开关（`table_independent_rules_enabled`、`historiographyTagExtractionEnabled`）。

3. **世界书/ Tavern Helper 读写**  
   - `secondary-filler.js` 通过 `safeLorebookEntries` 拉取所选条目拼接 `<世界书>` 片段。  
   - `batch-filler.js` 允许将表格结果写回世界书（`loadWorldInfo` + `saveWorldInfo`）。  
   - 因此，裁剪 WorldEditor/Glossary 等独立模块时，必须保留 `core/tavernhelper-compatibility.js` 暴露的包装函数。

4. **API 适配器**  
   - Main API：`callAI`（`../api.js`）  
   - NCCS：`callNccsAI`（`../api/NccsApi.js`）  
   - 分步模式（`secondary-api`）会根据 `settings.nccsEnabled` 决定调用哪条路径并打印调试日志。  
   - 如果未来仅保留单一模型，需在这些模块中封装一个“空适配器”而非直接删除 import。

5. **UI 反馈与状态同步**  
   - `manager.js` 在保存表格后调用 `renderTables()` + `updateOrInsertTableInChat()`，并通过 `saveChatDebounced()` 将最新状态持久化。  
   - `ui/table-bindings.js` 订阅 `eventSource`（`/script.js`）的 `event_types.MESSAGE_RECEIVED` 等事件来刷新数据。移除事件中心需提供模拟器或最小实现。

> **结论**：记忆表格链路不仅依赖多条 API/Preset/RAG 工具，还与 Tavern Helper 的世界书读取紧密耦合。在“只保留自动总结 + 记忆表格”的目标下，必须先为这些依赖准备可选实现或内联默认值，再执行大规模删减。

---

## 3. 下一步建议

1. **改造顺序**：先在 `core/historiographer.js`、`core/table-system/*` 内引入降级逻辑（如 `tryImport` 或条件判断），确保缺失模块时仍返回早期退出提示；再进入 Stage 1/2 的裁剪任务。
2. **配置映射**：结合本文依赖表，更新 `docs/项目精简指南.md` 的“保留键值对”章节，指出“删除 RAG/PresetSettings 之前必须把 `historiographyIngestToRag`、`table_independent_rules_enabled` 等开关设为 false”。
3. **自动化校验**：新增 `rg`/`eslint` 级别的脚本，扫描是否仍存在对已删除目录（如 `core/rag-processor.js`）的 import，避免运行期崩溃。

> 本文档将随着 Stage 1/2 的代码变动持续更新；若新增降级模块，请在此处补充新的依赖行并给出回退策略。

