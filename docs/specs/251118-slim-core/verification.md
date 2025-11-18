# 251118-slim-core 手动验证记录（阶段 4）

- **执行日期**：2025-11-18（持续更新中）
- **状态**：仅完成流程演练，缺乏真实 SillyTavern 环境，以下用例需待联调后补齐日志
- **环境**：本地代码审查（无 SillyTavern 运行环境，需在真实环境复测）
- **构建/Lint**：无可用脚本；已通过 `rg -n "rag-processor|rag-api|rag-settings|ingestion-manager|super-sorter|MiZheSi|PresetSettings|PreOptimizationViewer|WorldEditor/|CharacterWorldBook|glossary/|hanlinyuan-bindings|summarizer" --glob "!docs/**"` 确认删除资产无残留引用（对应 T401）

## 用例 1：扩展启动（待复测）
- **步骤**：加载扩展，观察控制台与 Slash 命令注册。
- **期望**：无缺失模块错误，仅输出可选模块警告（缺省 Preset/RAG）。
- **结果**：未在本地运行，需在 SillyTavern 环境复测；建议重点关注可选模块加载警告。

## 用例 2：手动总结（/summary）（待复测）
- **步骤**：在对话任意楼层执行 `/summary`。
- **期望**：调用 `executeManualSummary`，写入世界书，无 RAG 录入报错。
- **结果**：未在本地运行；待环境可用时补充日志（historiographer 路径已降级，可直接触发）。

## 用例 3：记忆表格填表（待复测）
- **步骤**：发送包含表格指令的 AI 回复，触发批量/副 API 填表。
- **期望**：`handleTableUpdate` 刷新内嵌表格，无 PresetSettings 缺失报错。
- **结果**：未在本地运行；需在实际聊天流中确认 `renderTables` 与消息嵌入正常。

### 待办与提醒
- 在具备 SillyTavern 环境后补充上述三项用例的实际日志、控制台输出或截图，并明确执行者/日期。
- 若需重启 RAG/剧情/世界编辑，请参考 `docs/项目精简指南.md` 的“扩展集成”章节恢复资产。
