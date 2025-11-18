import { extension_settings, getContext } from "/scripts/extensions.js";
import { characters, this_chid, getRequestHeaders, saveSettingsDebounced, eventSource, event_types } from "/script.js";
import { defaultSettings, extensionName, saveSettings } from "../utils/settings.js";
import { pluginAuthStatus, activatePluginAuthorization, getPasswordForDate } from "../utils/auth.js";
import { fetchModels, testApiConnection } from "../core/api.js";
import { setAvailableModels, populateModelDropdown, getLatestUpdateInfo } from "./state.js";
import { fixCommand, testReplyChecker } from "../core/commands.js";
import { createDrawer } from '../ui/drawer.js';
import { messageFormatting } from '/script.js';
import { showContentModal, showHtmlModal } from './page-window.js';

// {{CODE-Cycle-Integration:
//   Task_ID: [T301]
//   Timestamp: [2025-11-18T04:27:04.761Z]
//   Phase: [D-Develop]
//   Context-Analysis: "精简版ui/bindings.js，移除已裁剪功能，保留核心授权、API和基础UI功能"
//   Principle_Applied: "Aether-Engineering-SOLID-S, KISS-Principle"
// }}
// {{START_MODIFICATIONS}}

function displayDailyAuthCode() {
    const displayEl = document.getElementById('amily2_daily_code_display');
    const copyBtn = document.getElementById('amily2_copy_daily_code');

    if (displayEl && copyBtn) {
        const todayCode = getPasswordForDate(new Date());
        displayEl.textContent = todayCode;

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(todayCode).then(() => {
                toastr.success('授权码已复制到剪贴板！');
            }, () => {
                toastr.error('复制失败，请手动复制。');
            });
        });
    }
}

function updateApiProviderUI() {
    const settings = extension_settings[extensionName] || {};
    const provider = settings.apiProvider || 'openai';

    $('#amily2_api_provider').val(provider);
    $('#amily2_api_provider').trigger('change');
}

export function bindModalEvents() {
    const refreshButton = document.getElementById('amily2_refresh_models');
    if (refreshButton && !document.getElementById('amily2_test_api_connection')) {
        const testButton = document.createElement('button');
        testButton.id = 'amily2_test_api_connection';
        testButton.className = 'menu_button interactable';
        testButton.innerHTML = '<i class="fas fa-plug"></i> 测试连接';
        refreshButton.insertAdjacentElement('afterend', testButton);
    }

    const container = $("#amily2_drawer_content").length ? $("#amily2_drawer_content") : $("#amily2_chat_optimiser");

    // 精简版的折叠面板逻辑
    container.find('.collapsible-legend').each(function() {
        $(this).on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const legend = $(this);
            const content = legend.siblings('.collapsible-content');
            const icon = legend.find('.collapse-icon');
            
            const isCurrentlyVisible = content.is(':visible');
            const isCollapsedAfterClick = isCurrentlyVisible;

            if (isCollapsedAfterClick) {
                content.hide();
                icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            } else {
                content.show();
                icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            }
            
            const sectionId = legend.text().trim();
            if (!extension_settings[extensionName]) {
                extension_settings[extensionName] = {};
            }
            extension_settings[extensionName][`collapsible_${sectionId}_collapsed`] = isCollapsedAfterClick;
            saveSettingsDebounced();
        });
    });
    
    displayDailyAuthCode(); 
    function updateModelInputView() {
        const settings = extension_settings[extensionName] || {};
        const forceProxy = settings.forceProxyForCustomApi === true;
        const model = settings.model || '';

        container.find('#amily2_force_proxy').prop('checked', forceProxy);
        container.find('#amily2_manual_model_input').val(model);

        const apiKeyWrapper = container.find('#amily2_api_key_wrapper');
        const autoFetchWrapper = container.find('#amily2_model_autofetch_wrapper');
        const manualInput = container.find('#amily2_manual_model_input');

        if (forceProxy) {
            apiKeyWrapper.hide();
            autoFetchWrapper.show(); 
            manualInput.hide();
        } else {
            apiKeyWrapper.show();
            autoFetchWrapper.show();
            manualInput.hide();
        }
    }

    if (!container.length || container.data("events-bound")) return;

    const snakeToCamel = (s) => s.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const updateAndSaveSetting = (key, value) => {
        console.log(`[Amily-谕令确认] 收到指令: 将 [${key}] 设置为 ->`, value);
        if (!extension_settings[extensionName]) {
            extension_settings[extensionName] = {};
        }
        extension_settings[extensionName][key] = value;
        saveSettingsDebounced();
        console.log(`[Amily-谕令镌刻] [${key}] 的新状态已保存。`);
    };

    // 基础UI事件绑定 - 仅保留核心功能
    container
        .off("change.amily2.force_proxy")
        .on("change.amily2.force_proxy", '#amily2_force_proxy', function () {
            if (!pluginAuthStatus.authorized) return;
            updateAndSaveSetting('forceProxyForCustomApi', this.checked);
            updateModelInputView();
            $('#amily2_refresh_models').trigger('click');
        });
    
    container
        .off("change.amily2.manual_model")
        .on("change.amily2.manual_model", '#amily2_manual_model_input', function() {
            if (!pluginAuthStatus.authorized) return;
            updateAndSaveSetting('model', this.value);
            toastr.success(`模型ID [${this.value}] 已自动保存!`, "Amily2号");
        });

    // 授权相关
    container
        .off("click.amily2.auth")
        .on("click.amily2.auth", "#auth_submit", async function () {
            const authCode = $("#amily2_auth_code").val().trim();
            if (authCode) {
                await activatePluginAuthorization(authCode);
            } else {
                toastr.warning("请输入授权码", "Amily2号");
            }
        });

    // 主要操作按钮 - 精简版
    container
        .off("click.amily2.actions")
        .on(
            "click.amily2.actions",
            "#amily2_refresh_models, #amily2_test_api_connection, #amily2_test",
            async function () {
                if (!pluginAuthStatus.authorized) return;
                const button = $(this);
                const originalHtml = button.html();
                button
                    .prop("disabled", true)
                    .html('<i class="fas fa-spinner fa-spin"></i> 处理中');
                try {
                    switch (this.id) {
                        case "amily2_refresh_models":
                            const models = await fetchModels();
                            if (models.length > 0) {
                                setAvailableModels(models);
                                localStorage.setItem(
                                  "cached_models_amily2",
                                  JSON.stringify(models),
                                );
                                populateModelDropdown();
                            }
                            break;
                        case "amily2_test_api_connection":
                            await testApiConnection();
                            break;
                        case "amily2_test":
                            await testReplyChecker();
                            break;
                    }
                } catch (error) {
                    console.error(`[Amily2-工部] 操作按钮 ${this.id} 执行失败:`, error);
                    toastr.error(`操作失败: ${error.message}`, "Amily2号");
                } finally {
                    button.prop("disabled", false).html(originalHtml);
                }
            },
        );

    // API提供商切换 - 精简版
    container
        .off("change.amily2.api_provider")
        .on("change.amily2.api_provider", "#amily2_api_provider", function () {
            if (!pluginAuthStatus.authorized) return;
            
            const provider = $(this).val();
            console.log(`[Amily2号-UI] API提供商切换为: ${provider}`);

            updateAndSaveSetting('apiProvider', provider);

            const $urlWrapper = $('#amily2_api_url_wrapper');
            const $keyWrapper = $('#amily2_api_key_wrapper');
            const $presetWrapper = $('#amily2_preset_wrapper');

            $urlWrapper.hide();
            $keyWrapper.hide();
            $presetWrapper.hide();

            const $modelWrapper = $('#amily2_model_selector');
            
            switch(provider) {
                case 'openai':
                case 'openai_test':
                    $urlWrapper.show();
                    $keyWrapper.show();
                    $modelWrapper.show();
                    $('#amily2_api_url').attr('placeholder', 'https://api.openai.com/v1').attr('type', 'text');
                    $('#amily2_api_key').attr('placeholder', 'sk-...');
                    break;
                    
                case 'google':
                    $urlWrapper.hide();
                    $keyWrapper.show();
                    $modelWrapper.show();
                    $('#amily2_api_key').attr('placeholder', 'Google API Key');
                    break;
                    
                case 'sillytavern_backend':
                    $urlWrapper.show();
                    $modelWrapper.show();
                    $('#amily2_api_url').attr('placeholder', 'http://localhost:5000/v1').attr('type', 'text');
                    break;
                    
                case 'sillytavern_preset':
                    $presetWrapper.show();
                    $modelWrapper.hide();
                    break;
            }

            $('#amily2_model').empty().append('<option value="">请刷新模型列表</option>');
        });

    // 基础输入框处理 - 仅保留核心设置
    container
        .off("change.amily2.text")
        .on("change.amily2.text", "#amily2_api_url, #amily2_api_key", function () {
            if (!pluginAuthStatus.authorized) return;
            const key = snakeToCamel(this.id.replace("amily2_", ""));
            updateAndSaveSetting(key, this.value);
            toastr.success(`配置 [${key}] 已自动保存!`, "Amily2号");
        });

    // 模型选择
    container
        .off("change.amily2.select")
        .on("change.amily2.select", "select#amily2_model", function () {
            if (!pluginAuthStatus.authorized) return;
            const key = snakeToCamel(this.id.replace("amily2_", ""));
            updateAndSaveSetting(key, this.value);

            if (this.id === 'amily2_model') {
                populateModelDropdown();
            }
        });

    // 滑块控件 - 精简版
    container
        .off("input.amily2.range")
        .on(
            "input.amily2.range",
            'input[type="range"][id^="amily2_"]:not([id^="amily2_optimization_"])',
            function () {
                if (!pluginAuthStatus.authorized) return;
                const key = snakeToCamel(this.id.replace("amily2_", ""));
                const value = this.id.includes("temperature")
                    ? parseFloat(this.value)
                    : parseInt(this.value, 10);
                $(`#${this.id}_value`).text(value);
                updateAndSaveSetting(key, value);
            },
        );

    setTimeout(updateEditorView, 100);
    updateModelInputView();

    container.data("events-bound", true);

    console.log('[Amily2-Slim] 已精简UI绑定：仅保留核心授权、API和基础UI');
}

const DEFAULT_BG_IMAGE_URL = "https://cdn.jsdelivr.net/gh/Wx-2025/ST-Amily2-images@main/img/Amily-2.png";

function applyAndSaveColors(container) {
    const bgColor = container.find('#amily2_bg_color').val();
    const btnColor = container.find('#amily2_button_color').val();
    const textColor = container.find('#amily2_text_color').val();

    const colors = {
        '--amily2-bg-color': bgColor,
        '--amily2-button-color': btnColor,
        '--amily2-text-color': textColor
    };

    Object.entries(colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value, 'important');
    });

    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    extension_settings[extensionName]['customColors'] = colors;
    saveSettingsDebounced();
}

function loadAndApplyCustomColors(container) {
    const savedColors = extension_settings[extensionName]?.customColors;
    if (savedColors) {
        container.find('#amily2_bg_color').val(savedColors['--amily2-bg-color']);
        container.find('#amily2_button_color').val(savedColors['--amily2-button-color']);
        container.find('#amily2_text_color').val(savedColors['--amily2-text-color']);
        applyAndSaveColors(container);
    }

    const savedOpacity = extension_settings[extensionName]?.bgOpacity;
    if (savedOpacity !== undefined) {
        $('#amily2_bg_opacity').val(savedOpacity);
        $('#amily2_bg_opacity_value').text(savedOpacity);
        document.documentElement.style.setProperty('--amily2-bg-opacity', savedOpacity);
    }

    const savedBgImage = extension_settings[extensionName]?.customBgImage;
    const imageUrl = savedBgImage ? `url("${savedBgImage}")` : `url("${DEFAULT_BG_IMAGE_URL}")`;
    document.documentElement.style.setProperty('--amily2-bg-image', imageUrl);
}

// 简化的图标位置切换
$(document).on('change', 'input[name="amily2_icon_location"]', function() {
    if (!pluginAuthStatus.authorized) return;
    const newLocation = $(this).val();
    extension_settings[extensionName]['iconLocation'] = newLocation;
    saveSettingsDebounced();
    console.log(`[Amily-禁卫军] 收到迁都指令 -> ${newLocation}。圣意已存档。`);
    toastr.info(`正在将帝国徽记迁往 [${newLocation === 'topbar' ? '顶栏' : '扩展区'}]...`, "迁都令", { timeOut: 2000 });
    $('#amily2_main_drawer').remove(); 
    $(document).off("mousedown.amily2Drawer"); 
    $('#amily2_extension_frame').remove();

    setTimeout(createDrawer, 50); 
});

// {{END_MODIFICATIONS}}
