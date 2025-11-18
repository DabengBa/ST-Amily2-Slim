# Amily2 精简版必要知识手册

> **目标形态**：仅保留“自动总结 + 记忆表格”链路，其余正文优化 / RAG / 剧情推进 / 独立面板已经完全裁剪。  
> **延伸阅读**：详细步骤、配置与验证案例请查阅 `./docs/项目精简指南.md`、`./docs/specs/251118-slim-core/tasks.md`、`./docs/specs/251118-slim-core/dependency-map.md`、`./docs/specs/251118-slim-core/verification.md`。
> **资产状态**：RAG、剧情推进、独立编辑器等外围资产已物理移除，需恢复请参考 `./docs/项目精简指南.md` 的“扩展集成”章。

## 1. 启动流程（入口层 `index.js`）
- 仅导入 Drawer、Slash 命令、事件调度、记忆表格、Tavern Helper 等必须模块；删除剧情优化、RAG 等依赖后不会再抛 `Failed to load module`。
- `loadPluginStyles()` 只挂载 `style.css`、`historiography.css`、`table.css`、`renderer.css`、`iframe-renderer.css`。
- 事件注册仅覆盖：
  - `MESSAGE_RECEIVED` / `IMPERSONATE_READY` → `onMessageReceived`
  - 表格回放：`MESSAGE_RECEIVED`/`MESSAGE_SWIPED`/`MESSAGE_EDITED`/`MESSAGE_DELETED`  
  - UI 渲染：`CHAT_CHANGED`、`chat_updated`
- `window['vectors_rearrangeChat']` 只负责调用 `injectTableData`（无 RAG 注入 fallback）。
- Slash 命令在初始化阶段注册，宏 `{{Amily2EditContent}}` 始终可用。

## 2. 事件调度（`core/events.js`）
- 主体逻辑：消息到达 → 可选自动隐藏 → 触发表格系统 / 副 API → 后台触发自动总结。
- 自动隐藏通过 `core/utils/optional-modules.js#getAutoHideManager` 懒加载；默认配置 `autoHideEnabled: false`。缺少 `autoHideManager.js` 时仅打印警告。
- 正文优化、RAG 逻辑已删除；`window.lastPreOptimizationResult` 与 `preOptimizationTextUpdated` 广播也一并移除。

## 3. Slash 命令（`core/commands.js`）
| 命令 | 功能 |
|------|------|
| `/summary [start] [end]` | 微言录总结，参数留空时依据 `historiographySmallTriggerThreshold` |
| `/summary-expedition` / `/summary-stop` | 批量远征总结与中止 |
| `/table-refresh` | 重新执行最新 AI 消息的主流程填表 |
| `/table-secondary` | 在 `filling_mode = secondary-api` 时强制走副 API |

## 4. 模块职责速览
- `core/historiographer.js`：内置 Preset fallback + 可选 Ngms API + 可选 RAG；若 `historiographyIngestToRag` 关闭则完全跳过翰林院逻辑。
- `core/table-system/*`：批量 / 分步 / 管理等子模块保留；当缺少预设提示模块时自动采用默认提示词与流程。
- `core/utils/optional-modules.js`：集中处理 PresetToolkit、RAG Processor、AutoHideManager、Ngms API 的惰性加载。
- `ui/*`：待精简的面板仍存在，但 Drawer 仅绑定总结 + 表格；若需裁剪 UI 细节参见 `docs/项目精简指南.md` 的“UI 文件”章节。

## 5. 配置基线（`utils/settings.js`）
- 必填：`table_system_enabled: true`、`filling_mode: 'main-api'`、`historiographySmallAutoEnable`、`historiographySmallTriggerThreshold`、`historiographyRetentionCount`、`lorebookTarget`。
- 默认关闭：`plotOpt_enabled`、`optimizationEnabled`、全部 RAG 相关键、`historiographyIngestToRag`、`autoHideEnabled`、`table_independent_rules_enabled`。
- 若需重新启用自动隐藏/Ngms/RAG，请先确认相应模块仍在 `core/` 中并通过 `optional-modules` 加载。

## 6. 验证建议
1. **启动**：浏览器控制台无缺模块 / RAG 初始化日志；Slash 命令注册成功。
2. **总结**：调用 `/summary`，观察 `executeManualSummary` 正常写入世界书并落库、无 RAG 报错。
3. **表格**：发送带表格命令的 AI 回复，让 `handleTableUpdate` 写回状态并刷新 UI、消息查看器内嵌表格。
4. **自动触发**：累计消息超过阈值后，`checkAndTriggerAutoSummary` 应后台运行且无缺依赖日志。

如需更多上下文（UI 调整、资产删除、验收记录等），请参考 `./docs` 目录下的各专项文档。
