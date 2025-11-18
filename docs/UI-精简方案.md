# Amily2 精简版 - UI文件精简方案

## 1. 现状分析

### 1.1 现有UI文件
- `ui/drawer.js` - ✅ 已精简，仅加载总结+表格面板
- `ui/bindings.js` - ❌ 包含大量优化/MiZheSi功能，需移除
- `ui/historiography-bindings.js` - ✅ 保留，总结功能相关
- `ui/table-bindings.js` - ⚠️ 混淆代码，需重写简化版
- `ui/message-table-renderer.js` - ✅ 简化版已精简

## 2. 精简目标

### 2.1 保留功能
- ✅ 总结功能 (`historiography-bindings.js`)
- ✅ 表格系统核心功能
- ✅ 聊天内表格渲染
- ✅ 基本的UI绑定（授权、模型选择等）

### 2.2 移除功能
- ❌ 正文优化相关绑定
- ❌ MiZheSi功能
- ❌ RAG相关UI
- ❌ 剧情优化UI
- ❌ 复杂的优化设置界面

## 3. 具体修改方案

### 3.1 ui/bindings.js 精简
**移除的导入:**
- 优化相关的导入和功能
- MiZheSi相关功能

**移除的函数/事件:**
- `loadSillyTavernPresets()` - 可简化
- 优化相关的checkbox事件绑定
- 颜色定制相关复杂功能
- RAG相关UI事件

### 3.2 ui/table-bindings.js 简化
**策略:**
- 保留核心表格操作
- 移除复杂的API集成UI
- 简化事件绑定
- 保留基本的填表功能

### 3.3 ui/message-table-renderer.js 优化
**已精简:**
- 移除复杂的持续渲染逻辑
- 保留核心表格显示功能

## 4. 实施步骤

### 阶段1: ui/bindings.js 精简
1. 移除优化相关的事件绑定
2. 简化授权和模型选择功能
3. 保留基本的UI交互

### 阶段2: ui/table-bindings.js 重写
1. 创建简化版的表格绑定
2. 保留核心表格操作
3. 移除复杂的API集成

### 阶段3: 验证和测试
1. 测试精简后的UI功能
2. 确认无缺失模块错误
3. 更新文档

## 5. 预期结果

- ✅ UI文件大幅简化
- ✅ 移除冗余功能代码
- ✅ 保持核心功能完整性
- ✅ 减少维护复杂度