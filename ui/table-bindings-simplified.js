import { extension_settings, getContext } from "/scripts/extensions.js";
import { characters, this_chid, saveSettingsDebounced, eventSource, event_types } from "/script.js";
import { extensionName } from "../utils/settings.js";
import { getMemoryState, getHighlights, updateCell, addHighlight, removeHighlight } from '../core/table-system/manager.js';
import { startBatchFilling, fillCurrentFloor } from '../core/table-system/batch-filler.js';
import { executeBatchFilling } from '../core/table-system/secondary-filler.js';
import { reorganizeTableContent } from '../core/table-system/reorganizer.js';

// {{CODE-Cycle-Integration:
//   Task_ID: [T301]
//   Timestamp: [2025-11-18T04:28:39.753Z]
//   Phase: [D-Develop]
//   Context-Analysis: "简化版ui/table-bindings.js，移除复杂优化功能，保留核心表格操作"
//   Principle_Applied: "Aether-Engineering-SOLID-S, KISS-Principle"
// }}
// {{START_MODIFICATIONS}}

const log = (message, type = 'info') => {
    console.log(`[Amily2-Slim-表格] ${message}`, type);
};

// 简化的表格状态更新函数
function updateTableUI() {
    const tables = getMemoryState();
    const highlights = getHighlights();
    
    // 更新表格显示
    if (tables && tables.length > 0) {
        tables.forEach((table, tableIndex) => {
            updateTableDisplay(table, tableIndex, highlights);
        });
    }
}

// 更新单个表格显示
function updateTableDisplay(table, tableIndex, highlights) {
    const tableElement = document.getElementById(`amily2-chat-table-${tableIndex}`);
    if (!tableElement) return;

    const tbody = tableElement.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    table.rows.forEach((row, rowIndex) => {
        const rowElement = document.createElement('tr');
        const rowStatus = table.rowStatuses ? table.rowStatuses[rowIndex] : 'normal';
        if (rowStatus === 'pending-deletion') {
            rowElement.classList.add('pending-deletion-row');
        }
        
        row.forEach((cell, colIndex) => {
            const cellElement = document.createElement('td');
            const highlightKey = `${tableIndex}-${rowIndex}-${colIndex}`;
            if (highlights.has(highlightKey)) {
                cellElement.classList.add('amily2-cell-highlight');
            }
            
            cellElement.textContent = cell;
            cellElement.addEventListener('blur', () => {
                updateTableCell(tableIndex, rowIndex, colIndex, cellElement.textContent);
            });
            
            rowElement.appendChild(cellElement);
        });
        
        tbody.appendChild(rowElement);
    });
}

// 更新表格单元格
function updateTableCell(tableIndex, rowIndex, colIndex, newValue) {
    try {
        updateCell(tableIndex, rowIndex, colIndex, newValue);
        log(`已更新表格[${tableIndex}]行[${rowIndex}]列[${colIndex}]值为: ${newValue}`);
    } catch (error) {
        log(`更新表格单元格失败: ${error.message}`, 'error');
    }
}

// 简化的按钮绑定函数
function bindTableButtons() {
    // 批量填表按钮
    const batchFillBtn = document.getElementById('fill-table-now-btn');
    if (batchFillBtn && !batchFillBtn.dataset.eventsBound) {
        batchFillBtn.addEventListener('click', async () => {
            const settings = extension_settings[extensionName];
            if (!settings?.table_system_enabled) {
                toastr.warning('表格系统总开关已关闭，请先启用总开关。');
                return;
            }
            
            try {
                batchFillBtn.disabled = true;
                batchFillBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 填表中...';
                await startBatchFilling();
                toastr.success('批量填表完成！', 'Amily2-Slim');
            } catch (error) {
                log(`批量填表失败: ${error.message}`, 'error');
                toastr.error(`批量填表失败: ${error.message}`, 'Amily2-Slim');
            } finally {
                batchFillBtn.disabled = false;
                batchFillBtn.innerHTML = '<i class="fas fa-table"></i> 立即填表';
            }
        });
        batchFillBtn.dataset.eventsBound = 'true';
        log('批量填表按钮已绑定');
    }

    // 重新整理按钮
    const reorganizeBtn = document.getElementById('reorganize-table-btn');
    if (reorganizeBtn && !reorganizeBtn.dataset.eventsBound) {
        reorganizeBtn.addEventListener('click', async () => {
            const settings = extension_settings[extensionName];
            if (!settings?.table_system_enabled) {
                toastr.warning('表格系统总开关已关闭，请先启用总开关。');
                return;
            }
            
            try {
                reorganizeBtn.disabled = true;
                reorganizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 整理中...';
                await reorganizeTableContent();
                toastr.success('表格内容整理完成！', 'Amily2-Slim');
            } catch (error) {
                log(`整理表格失败: ${error.message}`, 'error');
                toastr.error(`整理表格失败: ${error.message}`, 'Amily2-Slim');
            } finally {
                reorganizeBtn.disabled = false;
                reorganizeBtn.innerHTML = '<i class="fas fa-sort"></i> 重新整理';
            }
        });
        reorganizeBtn.dataset.eventsBound = 'true';
        log('重新整理按钮已绑定');
    }

    // 填当前楼层按钮
    const fillCurrentBtn = document.getElementById('fill-current-floor-btn');
    if (fillCurrentBtn && !fillCurrentBtn.dataset.eventsBound) {
        fillCurrentBtn.addEventListener('click', async () => {
            const settings = extension_settings[extensionName];
            if (!settings?.table_system_enabled) {
                toastr.warning('表格系统总开关已关闭，请先启用总开关。');
                return;
            }
            
            try {
                fillCurrentBtn.disabled = true;
                fillCurrentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 填表中...';
                await fillCurrentFloor();
                toastr.success('当前楼层填表完成！', 'Amily2-Slim');
            } catch (error) {
                log(`填当前楼层失败: ${error.message}`, 'error');
                toastr.error(`填当前楼层失败: ${error.message}`, 'Amily2-Slim');
            } finally {
                fillCurrentBtn.disabled = false;
                fillCurrentBtn.innerHTML = '<i class="fas fa-layer-group"></i> 填当前楼层';
            }
        });
        fillCurrentBtn.dataset.eventsBound = 'true';
        log('填当前楼层按钮已绑定');
    }
}

// 简化的模板编辑器绑定
function bindTemplateEditors() {
    const ruleTemplateTextarea = document.getElementById('ai_rule_template');
    const flowTemplateTextarea = document.getElementById('ai_flow_template');
    const saveRuleTemplateBtn = document.getElementById('ai-rule-template-save-btn');
    const saveFlowTemplateBtn = document.getElementById('ai-flow-template-save-btn');
    
    if (!ruleTemplateTextarea || !flowTemplateTextarea || !saveRuleTemplateBtn || !saveFlowTemplateBtn) {
        log('模板编辑器元素未找到，跳过绑定');
        return;
    }
    
    if (saveRuleTemplateBtn.dataset.eventsBound) return;
    
    // 加载默认模板（简化版）
    const DEFAULT_AI_RULE_TEMPLATE = `根据聊天记录提取关键信息：
- 角色姓名、性格特点
- 重要事件、时间线
- 角色关系发展
- 关键对话和情节

请按表格格式输出，确保信息准确完整。`;

    const DEFAULT_AI_FLOW_TEMPLATE = `你是Amily2号记忆表格助手。根据用户提供的聊天记录：

1. 分析聊天内容，提取关键信息
2. 按表格格式整理信息
3. 确保信息准确性和完整性
4. 输出格式化的表格内容

请开始分析和整理。`;

    // 设置默认模板
    ruleTemplateTextarea.value = extension_settings[extensionName]?.aiRuleTemplate || DEFAULT_AI_RULE_TEMPLATE;
    flowTemplateTextarea.value = extension_settings[extensionName]?.aiFlowTemplate || DEFAULT_AI_FLOW_TEMPLATE;
    
    // 绑定保存事件
    saveRuleTemplateBtn.addEventListener('click', () => {
        extension_settings[extensionName].aiRuleTemplate = ruleTemplateTextarea.value;
        saveSettingsDebounced();
        toastr.success('规则提示词已保存！', 'Amily2-Slim');
        log('规则提示词已保存');
    });
    
    saveFlowTemplateBtn.addEventListener('click', () => {
        extension_settings[extensionName].aiFlowTemplate = flowTemplateTextarea.value;
        saveSettingsDebounced();
        toastr.success('流程提示词已保存！', 'Amily2-Slim');
        log('流程提示词已保存');
    });
    
    saveRuleTemplateBtn.dataset.eventsBound = 'true';
    saveFlowTemplateBtn.dataset.eventsBound = 'true';
    log('模板编辑器已绑定');
}

// 简化的聊天表格显示设置绑定
function bindChatTableDisplaySetting() {
    const showTableCheckbox = document.getElementById('show_table_in_chat');
    const continuousRenderCheckbox = document.getElementById('continuous_render_latest_message');
    
    if (!showTableCheckbox || !continuousRenderCheckbox) {
        log('聊天表格显示设置元素未找到，跳过绑定');
        return;
    }
    
    const settings = extension_settings[extensionName];
    
    // 设置初始值
    showTableCheckbox.checked = settings?.show_table_in_chat === true;
    continuousRenderCheckbox.checked = settings?.continuousRenderLatestMessage === true;
    
    // 绑定事件
    showTableCheckbox.addEventListener('change', () => {
        extension_settings[extensionName].show_table_in_chat = showTableCheckbox.checked;
        saveSettingsDebounced();
        toastr.success(`聊天内表格显示已${showTableCheckbox.checked ? '开启' : '关闭'}。`, 'Amily2-Slim');
        log(`聊天内表格显示状态: ${showTableCheckbox.checked}`);
    });
    
    continuousRenderCheckbox.addEventListener('change', () => {
        extension_settings[extensionName].continuousRenderLatestMessage = continuousRenderCheckbox.checked;
        saveSettingsDebounced();
        toastr.success(`持续渲染最新消息功能已${continuousRenderCheckbox.checked ? '开启' : '关闭'}。`, 'Amily2-Slim');
        log(`持续渲染功能状态: ${continuousRenderCheckbox.checked}`);
    });
    
    log('聊天表格显示设置已绑定');
}

// 主要的表格事件绑定函数
export function bindTableEvents() {
    log('开始绑定表格事件...');
    
    try {
        bindTableButtons();
        bindTemplateEditors();
        bindChatTableDisplaySetting();
        
        // 监听聊天变化，更新表格显示
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => {
            setTimeout(updateTableUI, 100);
        });
        
        eventSource.on(event_types.MESSAGE_DELETED, () => {
            setTimeout(updateTableUI, 100);
        });
        
        eventSource.on(event_types.MESSAGE_EDITED, () => {
            setTimeout(updateTableUI, 100);
        });
        
        log('表格事件绑定完成 - 精简版');
    } catch (error) {
        log(`表格事件绑定失败: ${error.message}`, 'error');
    }
}

// {{END_MODIFICATIONS}}