import { createDrawer } from "./ui/drawer.js";
import { registerSlashCommands } from "./core/commands.js";
import { onMessageReceived, handleTableUpdate } from "./core/events.js";
import { getContext } from "/scripts/extensions.js";
import { injectTableData, generateTableContent } from "./core/table-system/injector.js"; 
import { loadTables, clearHighlights, rollbackState, commitPendingDeletions, saveStateToMessage, getMemoryState, clearUpdatedTables } from './core/table-system/manager.js';
import { fillWithSecondaryApi } from './core/table-system/secondary-filler.js';
import { renderTables } from './ui/table-bindings.js';
import { log } from './core/table-system/logger.js';
import { eventSource, event_types, saveSettingsDebounced } from '/script.js';
import { checkForUpdates, fetchMessageBoardContent } from './core/api.js';
import { setUpdateInfo, applyUpdateIndicator } from './ui/state.js';
import { pluginVersion, extensionName, defaultSettings } from './utils/settings.js';
import { tableSystemDefaultSettings } from './core/table-system/settings.js';
import { extension_settings } from '/scripts/extensions.js';
import { manageLorebookEntriesForChat } from './core/lore.js';
import './core/amily2-updater.js';
import { updateOrInsertTableInChat, startContinuousRendering, stopContinuousRendering } from './ui/message-table-renderer.js';
import { initializeRenderer } from './core/tavern-helper/renderer.js';
import { initializeApiListener, registerApiHandler, amilyHelper, initializeAmilyHelper } from './core/tavern-helper/main.js';

const STYLE_SETTINGS_KEY = 'amily2_custom_styles';
const STYLE_ROOT_SELECTOR = '#amily2_memorisation_forms_panel';
let styleRoot = null;

function getStyleRoot() {
    if (!styleRoot) {
        styleRoot = document.querySelector(STYLE_ROOT_SELECTOR);
    }
    return styleRoot;
}

function applyStyles(styleObject) {
    const root = getStyleRoot();
    if (!root || !styleObject) return;
    delete styleObject._comment;

    for (const [key, value] of Object.entries(styleObject)) {
        if (key.startsWith('--am2-')) {
            root.style.setProperty(key, value);
        }
    }
}

function loadAndApplyStyles() {
    const savedStyles = extension_settings[extensionName]?.[STYLE_SETTINGS_KEY];
    if (savedStyles && typeof savedStyles === 'object' && Object.keys(savedStyles).length > 0) {
        applyStyles(savedStyles);
    }
}

function saveStyles(styleObject) {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    extension_settings[extensionName][STYLE_SETTINGS_KEY] = styleObject;
    saveSettingsDebounced();
}

function resetToDefaultStyles() {
    const root = getStyleRoot();
    if (!root) return;
    const savedStyles = extension_settings[extensionName]?.[STYLE_SETTINGS_KEY];
    if (savedStyles && typeof savedStyles === 'object') {
        for (const key of Object.keys(savedStyles)) {
            if (key.startsWith('--am2-')) {
                root.style.removeProperty(key);
            }
        }
    }
    saveStyles(null);
    toastr.success('已恢复默认界面样式。');
}

function getDefaultCssVars() {
    return {
        "--am2-font-size-base": "14px", "--am2-gap-main": "10px", "--am2-padding-main": "8px 5px",
        "--am2-container-bg": "rgba(0,0,0,0.1)", "--am2-container-border": "1px solid rgba(255, 255, 255, 0.2)",
        "--am2-container-border-radius": "12px", "--am2-container-padding": "10px", "--am2-container-shadow": "inset 0 0 15px rgba(0,0,0,0.2)",
        "--am2-title-font-size": "1.1em", "--am2-title-font-weight": "bold", "--am2-title-text-shadow": "0 0 5px rgba(200, 200, 255, 0.3)",
        "--am2-title-gradient-start": "#c0bde4", "--am2-title-gradient-end": "#dfdff0", "--am2-title-icon-color": "#9e8aff",
        "--am2-title-icon-margin": "10px", "--am2-table-bg": "rgba(0,0,0,0.2)", "--am2-table-border": "1px solid rgba(255, 255, 255, 0.25)",
        "--am2-table-cell-padding": "6px 8px", "--am2-table-cell-font-size": "0.95em", "--am2-header-bg": "rgba(255, 255, 255, 0.1)",
        "--am2-header-color": "#e0e0e0", "--am2-header-editable-bg": "rgba(172, 216, 255, 0.1)", "--am2-header-editable-focus-bg": "rgba(172, 216, 255, 0.25)",
        "--am2-header-editable-focus-outline": "1px solid #79b8ff", "--am2-cell-editable-bg": "rgba(255, 255, 172, 0.1)",
        "--am2-cell-editable-focus-bg": "rgba(255, 255, 172, 0.25)", "--am2-cell-editable-focus-outline": "1px solid #ffc107",
        "--am2-index-col-bg": "rgba(0, 0, 0, 0.3) !important", "--am2-index-col-color": "#aaa !important", "--am2-index-col-width": "40px",
        "--am2-index-col-padding": "10px 5px !important", "--am2-controls-gap": "5px", "--am2-controls-margin-bottom": "10px",
        "--am2-cell-highlight-bg": "rgba(144, 238, 144, 0.3)"
    };
}

function exportStyles() {
    const root = getStyleRoot();
    if (!root) { toastr.error('无法导出样式：找不到根元素。'); return; }
    const computedStyle = getComputedStyle(root);
    const stylesToExport = {};
    const defaultVars = getDefaultCssVars();
    for (const key of Object.keys(defaultVars)) {
        stylesToExport[key] = computedStyle.getPropertyValue(key).trim();
    }
    const blob = new Blob([JSON.stringify(stylesToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Amily2-Theme-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toastr.success('主题文件已开始下载。', '导出成功');
}

function importStyles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    const cleanup = () => {
        if (document.body.contains(input)) {
            document.body.removeChild(input);
        }
    };

    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) {
            cleanup();
            return;
        }
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const importedStyles = JSON.parse(event.target.result);
                if (typeof importedStyles !== 'object' || Array.isArray(importedStyles)) {
                    throw new Error('无效的JSON格式。');
                }
                applyStyles(importedStyles);
                saveStyles(importedStyles);
                toastr.success('主题已成功导入并应用！');
            } catch (error) {
                toastr.error(`导入失败：${error.message}`, '错误');
            } finally {
                cleanup();
            }
        };
        reader.readAsText(file);
    };

    document.body.appendChild(input);
    input.click();
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < len; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return true;
        if (p1 < p2) return false;
    }
    return false;
}

async function handleUpdateCheck() {
    console.log("【Amily2号】帝国已就绪，现派遣外交官，为陛下探查外界新情报...");
    const updateInfo = await checkForUpdates();

    if (updateInfo && updateInfo.version) {
        const isNew = compareVersions(updateInfo.version, pluginVersion);
        if(isNew) {
            console.log(`【Amily2号-情报部】捷报！发现新版本: ${updateInfo.version}。情报已转交内务府。`);
        } else {
             console.log(`【Amily2号-情报部】一切安好，帝国已是最新版本。情报已转交内务府备案。`);
        }
        setUpdateInfo(isNew, updateInfo);
        applyUpdateIndicator();
    }
}

async function handleMessageBoard() {
    const messageData = await fetchMessageBoardContent();
    if (messageData && messageData.message) {
        const messageBoard = $('#amily2_message_board');
        const messageContent = $('#amily2_message_content');
        messageContent.html(messageData.message); 
        messageBoard.show();
        console.log("【Amily2号-内务府】已成功获取并展示来自陛下的最新圣谕。");
    }
}



function loadPluginStyles() {
    const loadStyleFile = (fileName) => {
        const styleId = `amily2-style-${fileName.split('.')[0]}`; 
        if (document.getElementById(styleId)) return; 

        const extensionPath = `scripts/extensions/third-party/${extensionName}/assets/${fileName}?v=${Date.now()}`;

        const link = document.createElement("link");
        link.id = styleId;
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = extensionPath;
        document.head.appendChild(link);
        console.log(`[Amily2号-皇家制衣局] 已为帝国披上华服: ${fileName}`);
    };

    // 颁布三道制衣圣谕
    loadStyleFile("style.css"); // 【第一道圣谕】为帝国主体宫殿披上通用华服
    loadStyleFile("historiography.css"); // 【第二道圣谕】为敕史局披上其专属华服
    loadStyleFile("table.css"); // 【第三道圣谕】为内存储司披上其专属华服
    loadStyleFile("renderer.css"); // 【第四道圣谕】为消息渲染器披上其专属华服
    loadStyleFile("iframe-renderer.css"); // 【第五道圣谕】为 iframe 渲染内容披上其专属华服

}


window.addEventListener("error", (event) => {
  const stackTrace = event.error?.stack || "";
  if (stackTrace.includes("ST-Amily2-Chat-Optimisation")) {
    console.error("[Amily2-全局卫队] 捕获到严重错误:", event.error);
    toastr.error(`Amily2插件错误: ${event.error?.message || "未知错误"}`, "严重错误", { timeOut: 10000 });
  }
});


jQuery(async () => {
  console.log("[Amily2号-帝国枢密院] 开始执行开国大典...");
  initializeApiListener();

  registerApiHandler('getChatMessages', async (data) => {
      return amilyHelper.getChatMessages(data.range, data.options);
  });

  registerApiHandler('setChatMessages', async (data) => {
      return await amilyHelper.setChatMessages(data.messages, data.options);
  });

  registerApiHandler('setChatMessage', async (data) => {
      const field_values = data.field_values || data.content;
      const message_id = data.message_id !== undefined ? data.message_id : data.index;
      const options = data.options || {};
      
      console.log('[Amily2-API] setChatMessage 收到参数:', { field_values, message_id, options, raw_data: data });
      
      return await amilyHelper.setChatMessage(field_values, message_id, options);
  });

  registerApiHandler('createChatMessages', async (data) => {
      return await amilyHelper.createChatMessages(data.messages, data.options);
  });

  registerApiHandler('deleteChatMessages', async (data) => {
      return await amilyHelper.deleteChatMessages(data.ids, data.options);
  });

  registerApiHandler('getLorebooks', async (data) => {
      return await amilyHelper.getLorebooks();
  });

  registerApiHandler('getCharLorebooks', async (data) => {
      return await amilyHelper.getCharLorebooks(data.options);
  });

  registerApiHandler('getLorebookEntries', async (data) => {
      return await amilyHelper.getLorebookEntries(data.bookName);
  });

  registerApiHandler('setLorebookEntries', async (data) => {
      return await amilyHelper.setLorebookEntries(data.bookName, data.entries);
  });

  registerApiHandler('createLorebookEntries', async (data) => {
      return await amilyHelper.createLorebookEntries(data.bookName, data.entries);
  });

  registerApiHandler('createLorebook', async (data) => {
      return await amilyHelper.createLorebook(data.bookName);
  });

  registerApiHandler('triggerSlash', async (data) => {
      return await amilyHelper.triggerSlash(data.command);
  });

  registerApiHandler('getLastMessageId', async (data) => {
      return amilyHelper.getLastMessageId();
  });

  registerApiHandler('toastr', async (data) => {
      if (window.toastr && typeof window.toastr[data.type] === 'function') {
          window.toastr[data.type](data.message, data.title);
      }
      return true;
  });

  registerApiHandler('switchSwipe', async (data) => {
      const { messageIndex, swipeIndex } = data;
      const messages = await amilyHelper.getChatMessages(messageIndex, { include_swipes: true });
      
      if (messages && messages.length > 0 && messages[0].swipes) {
          const content = messages[0].swipes[swipeIndex];
          if (content !== undefined) {
              await amilyHelper.setChatMessages([{
                  message_id: messageIndex,
                  message: content
              }], { refresh: 'affected' });
              
              const context = getContext();
              if (context.chat[messageIndex]) {
                  context.chat[messageIndex].swipe_id = swipeIndex;
              }
              
              return { success: true, message: `已切换至开场白 ${swipeIndex}` };
          }
      }
      
      throw new Error(`无法切换到开场白 ${swipeIndex}`);
  });

  initializeAmilyHelper();

  console.log("[Amily2号-帝国枢密院] 开始执行开国大典...");

  if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = {};
  }
  const combinedDefaultSettings = { ...defaultSettings, ...tableSystemDefaultSettings, render_on_every_message: false, render_enabled: false };

  for (const key in combinedDefaultSettings) {
    if (extension_settings[extensionName][key] === undefined) {
      extension_settings[extensionName][key] = combinedDefaultSettings[key];
    }
  }
  console.log("[Amily2号-帝国枢密院] 帝国基本法已确认，档案室已与国库对接完毕。");

  let attempts = 0;
  const maxAttempts = 100;
  const checkInterval = 100;
  const targetSelector = "#sys-settings-button"; 

  const deploymentInterval = setInterval(async () => {
    if ($(targetSelector).length > 0) {
      clearInterval(deploymentInterval);
      console.log("[Amily2号-帝国枢密院] SillyTavern宫殿主体已确认，开国大典正式开始！");

      try {
        console.log("[Amily2号-开国大典] 步骤一：为宫殿披上华服...");
        loadPluginStyles();

        console.log("[Amily2号-开国大典] 步骤二：皇家仪仗队就位...");
        await registerSlashCommands();

        console.log("[Amily2号-开国大典] 步骤三：开始召唤府邸...");
        createDrawer();

        console.log("[Amily2号-开国大典] 步骤3.8：注册表格占位符宏...");
        try {
            const context = getContext();
            if (context && typeof context.registerMacro === 'function') {
                context.registerMacro('Amily2EditContent', () => {
                    const content = generateTableContent();
                    if (content) {
                        window.AMILY2_MACRO_REPLACED = true;
                    }
                    return content;
                });
                console.log('[Amily2-核心引擎] 已成功注册表格占位符宏: {{Amily2EditContent}}');
            } else {
                console.warn('[Amily2-核心引擎] 无法注册表格宏，可能是 SillyTavern 版本不兼容。');
            }
        } catch (error) {
            console.error('[Amily2-核心引擎] 注册表格宏时发生错误:', error);
        }

        console.log("[Amily2号-开国大典] 步骤四：部署帝国哨兵网络...");
        if (!window.amily2EventsRegistered) {
            eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
            eventSource.on(event_types.IMPERSONATE_READY, onMessageReceived);
            eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => handleTableUpdate(chat_id));
            eventSource.on(event_types.MESSAGE_SWIPED, async (chat_id) => {
                const context = getContext();
                if (context.chat.length < 2) {
                    log('【监察系统】检测到消息滑动，但聊天记录不足，已跳过状态回退。', 'info');
                    return;
                }

                log('【监察系统】检测到消息滑动 (SWIPED)，开始执行状态回退...', 'warn');
                rollbackState();

                const latestMessage = context.chat[chat_id] || context.chat[context.chat.length - 1];
                if (latestMessage.is_user) {
                    log('【监察系统】滑动后最新消息是用户，跳过填表。', 'info');
                    renderTables();
                    return;
                }

                const settings = extension_settings[extensionName];
                const fillingMode = settings.filling_mode || 'main-api';

                if (fillingMode === 'main-api') {
                    log(`【监察系统】主填表模式，回退后强制刷新消息ID: ${chat_id}。`, 'info');
                    await handleTableUpdate(chat_id, true);
                } else if (fillingMode === 'secondary-api' || fillingMode === 'optimized') {
                    log('【监察系统】分步/优化模式，回退后强制二次填表最新消息。', 'info');
                    await fillWithSecondaryApi(latestMessage, true);
                } else {
                    log('【监察系统】未配置填表模式，跳过填表。', 'info');
                }

                renderTables();
                log('【监察系统】滑动后填表完成，UI 已刷新。', 'success');
            });
            eventSource.on(event_types.MESSAGE_EDITED, (mes_id) => {
                handleTableUpdate(mes_id);
                updateOrInsertTableInChat(); 
            });

            eventSource.on(event_types.CHAT_CHANGED, () => {
                manageLorebookEntriesForChat();
                setTimeout(() => {
                    log("【监察系统】检测到“朝代更迭”(CHAT_CHANGED)，开始重修史书并刷新宫殿...", 'info');
                    clearHighlights();
                    clearUpdatedTables();
                    loadTables();
                    renderTables();

                    if (extension_settings[extensionName].render_on_every_message) {
                        startContinuousRendering();
                    } else {
                        stopContinuousRendering();
                    }
                }, 100);
            });

            eventSource.on(event_types.MESSAGE_DELETED, (message, index) => {
                log(`【监察系统】检测到消息 ${index} 被删除，开始精确回滚UI状态。`, 'warn');
                clearHighlights();
                loadTables(index);
                renderTables();
            });

            eventSource.on(event_types.MESSAGE_RECEIVED, updateOrInsertTableInChat);
            eventSource.on(event_types.chat_updated, updateOrInsertTableInChat);
            
            window.amily2EventsRegistered = true;
        }
        
        console.log("[Amily2号-开国大典] 步骤五：启用记忆表格注入策略...");

        async function executeAmily2Injection(...args) {
            console.log('[Amily2-核心引擎] 开始执行统一注入 (聊天长度:', args[0]?.length || 0, ')');

            try {
                await injectTableData(...args);
            } catch (error) {
                console.error('[Amily2-内存储司] 表格注入失败:', error);
            }
        }

        console.log('[Amily2-策略] 采用“完全主导”策略，覆盖 `vectors_rearrangeChat`。');
        window['vectors_rearrangeChat'] = executeAmily2Injection;

        console.log("【Amily2号】帝国秩序已完美建立。Amily2号的府邸已恭候陛下的莅临。");

        console.log("[Amily2号-开国大典] 步骤七：初始化版本显示系统...");
        if (typeof window.amily2Updater !== 'undefined') {
            setTimeout(() => {
                console.log("[Amily2号-版本系统] 正在启动版本检测器...");
                window.amily2Updater.initialize();
            }, 2000);
        } else {
            console.warn("[Amily2号-版本系统] 版本检测器未找到，可能加载失败");
        }

        handleUpdateCheck();
        handleMessageBoard();

        initializeRenderer(); 

        if (extension_settings[extensionName].render_on_every_message) {
            startContinuousRendering();
        }

        setTimeout(() => {
            try {
                loadAndApplyStyles();
                
                const importThemeBtn = document.getElementById('amily2-import-theme-btn');
                const exportThemeBtn = document.getElementById('amily2-export-theme-btn');
                const resetThemeBtn = document.getElementById('amily2-reset-theme-btn');

                if (importThemeBtn) importThemeBtn.addEventListener('click', importStyles);
                if (exportThemeBtn) exportThemeBtn.addEventListener('click', exportStyles);
                if (resetThemeBtn) resetThemeBtn.addEventListener('click', resetToDefaultStyles);

                log('【凤凰阁】内联主题系统已通过延迟加载成功初始化并绑定事件。', 'success');
            } catch (error) {
                log(`【凤凰阁】内联主题系统初始化失败: ${error}`, 'error');
            }
        }, 500); 

      } catch (error) {
        console.error("!!!【开国大典失败】在执行系列法令时发生严重错误:", error);
      }

    } else {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(deploymentInterval);
        console.error(`[Amily2号] 部署失败：等待 ${targetSelector} 超时。`);
      }
    }
  }, checkInterval);
});
