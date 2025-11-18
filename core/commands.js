import { getContext, extension_settings } from "/scripts/extensions.js";
import { extensionName } from "../utils/settings.js";
import { SlashCommand } from "/scripts/slash-commands/SlashCommand.js";
import { SlashCommandParser } from "/scripts/slash-commands/SlashCommandParser.js";
import { executeManualSummary, executeExpedition, stopExpedition } from "./historiographer.js";
import { handleTableUpdate } from "./events.js";
import { fillWithSecondaryApi } from "./table-system/secondary-filler.js";

function parseFloorRange(rawArgs) {
  const tokens = typeof rawArgs === "string" ? rawArgs.trim().split(/\s+/).filter(Boolean) : [];
  const settings = extension_settings[extensionName] || {};
  const context = getContext();
  const chatLength = context.chat?.length || 0;
  const retentionCount = settings.historiographyRetentionCount ?? 5;
  const defaultBatch = settings.historiographySmallTriggerThreshold || 5;
  const summarizableEnd = chatLength - retentionCount;
  const defaultEnd = summarizableEnd > 0 ? summarizableEnd : chatLength;
  const defaultStart = Math.max(1, defaultEnd - defaultBatch + 1);

  if (tokens.length === 1 && !Number.isNaN(Number(tokens[0]))) {
    const size = Math.max(1, Number(tokens[0]));
    return { start: Math.max(1, defaultEnd - size + 1), end: defaultEnd };
  }

  if (tokens.length >= 2) {
    const start = Number(tokens[0]);
    const end = Number(tokens[1]);
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      return start <= end ? { start, end } : { start: end, end: start };
    }
  }

  return { start: defaultStart, end: defaultEnd };
}

async function summaryCommand(args) {
  const context = getContext();
  if (!context.chat || context.chat.length === 0) {
    toastr.info("当前没有聊天记录可供总结。", "微言录");
    return "";
  }

  const { start, end } = parseFloorRange(args);
  toastr.info(`正在总结第 ${start}-${end} 楼对话...`, "微言录");
  await executeManualSummary(start, end, false);
  return "";
}

async function expeditionCommand() {
  await executeExpedition();
  return "";
}

async function stopExpeditionCommand() {
  await stopExpedition();
  return "";
}

function findLatestAssistantMessage() {
  const context = getContext();
  const chat = context.chat || [];
  if (!chat.length) return { message: null, index: -1 };

  for (let i = chat.length - 1; i >= 0; i--) {
    if (!chat[i].is_user) {
      return { message: chat[i], index: i };
    }
  }
  return { message: null, index: -1 };
}

async function tableRefreshCommand() {
  const { message, index } = findLatestAssistantMessage();
  if (!message) {
    toastr.info("未找到可处理的 AI 消息，已跳过表格刷新。", "内存储司");
    return "";
  }
  const settings = extension_settings[extensionName] || {};
  if (settings.table_system_enabled === false) {
    toastr.info("表格系统已关闭，未执行刷新。", "内存储司");
    return "";
  }
  await handleTableUpdate(index);
  toastr.success(`已重新处理第 ${index + 1} 楼的表格指令。`, "内存储司");
  return "";
}

async function tableSecondaryFillCommand() {
  const { message, index } = findLatestAssistantMessage();
  if (!message) {
    toastr.info("未找到可处理的 AI 消息，已跳过分步填表。", "内存储司");
    return "";
  }
  const settings = extension_settings[extensionName] || {};
  if (settings.filling_mode !== "secondary-api") {
    toastr.info("当前填表模式非分步模式，未执行分步填表。", "内存储司");
    return "";
  }
  await fillWithSecondaryApi(message, true);
  toastr.success(`已对第 ${index + 1} 楼执行分步填表。`, "内存储司");
  return "";
}

export async function registerSlashCommands() {
  try {
    if (typeof SlashCommand === "undefined" || typeof SlashCommandParser === "undefined") {
      console.error("[Amily2] 致命错误：SlashCommand 或 SlashCommandParser 模块未能加载。");
      return;
    }

    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "summary",
        callback: summaryCommand,
        helpString: "执行微言录总结：/summary [起始楼层] [结束楼层]，留空则按默认范围",
      }),
    );

    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "summary-expedition",
        callback: expeditionCommand,
        helpString: "对未总结历史批量远征总结",
      }),
    );

    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "summary-stop",
        callback: stopExpeditionCommand,
        helpString: "停止当前进行中的远征总结",
      }),
    );

    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "table-refresh",
        callback: tableRefreshCommand,
        helpString: "重新处理最新 AI 消息中的记忆表格指令",
      }),
    );

    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "table-secondary",
        callback: tableSecondaryFillCommand,
        helpString: "在分步模式下强制执行最新 AI 消息的填表",
      }),
    );

    console.log("[Amily2-新诏] 已注册总结与表格相关命令。");
  } catch (e) {
    console.error("[Amily2] 命令注册过程中发生意外错误:", e);
  }
}
