import type { Message, Attachment } from "@/core/types";
import { db } from "@/services/db";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { providerService } from "@/services/providers";
import { projectService } from "@/services/projects";
import { sendMessageStream, abortActiveStream } from "@/services/api";
import { webSearch, buildSearchContext } from "@/services/search";
import { taskService } from "@/services/tasks";
import { getToolDefinitions } from "@/services/mcp";
import { scanProjectTree, flattenFileList } from "@/services/project-scanner";
import { memoryService } from "@/services/memory";

function getDefaultModel(): string {
  const stored = (() => { try { return JSON.parse(localStorage.getItem("zeqouxchat-last-model") ?? "{}"); } catch { return {}; } })();
  if (stored.model) return stored.model;
  const providers = providerService.getProviders();
  for (const p of providers) {
    if (p.models.length > 0) return p.models[0];
  }
  return "";
}

function getDefaultProvider(): string {
  const stored = (() => { try { return JSON.parse(localStorage.getItem("zeqouxchat-last-model") ?? "{}"); } catch { return {}; } })();
  if (stored.provider) return stored.provider;
  const providers = providerService.getProviders();
  for (const p of providers) {
    if (p.models.length > 0) return p.id;
  }
  return "";
}

let messages: Message[] = [];
let isStreaming = false;
let inputValue = "";
let model = getDefaultModel();
let provider = getDefaultProvider();
let thinkingMode = false;
let internetMode = false;
let mcpMode = false;
let temperature = 0.7;
let systemPrompt = "You are a helpful AI assistant.";
let maxContextTokens = 128000;
let streamingContent = "";
let errorMessage = "";
// Monotonic generation: stale/superceded streams must not touch state.
let generation = 0;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function loadChat(chatId: string) {
  // Switching chats kills the live stream so it can't write into the wrong chat.
  abortActiveStream();
  generation++;
  messages = db.getMessages(chatId);
  streamingContent = "";
  errorMessage = "";
  const chat = db.getChat(chatId);
  if (chat) {
    model = chat.model;
    provider = chat.provider;
  }
  notify();
}

function clearChat() {
  abortActiveStream();
  generation++;
  messages = [];
  streamingContent = "";
  errorMessage = "";
  notify();
}

// Subscribe to sidebar chat changes instead of polling
let unsubSidebar: (() => void) | null = null;
function ensureSubscribed() {
  if (unsubSidebar) return;
  unsubSidebar = sidebarStore.subscribe(() => {
    const chatId = sidebarStore.getActiveChatId();
    if (chatId) {
      const currentFirstMsg = messages[0];
      const newMsgs = db.getMessages(chatId);
      if (newMsgs.length === 0 || newMsgs[0]?.id !== currentFirstMsg?.id) {
        loadChat(chatId);
      }
    } else {
      clearChat();
    }
  });
}
ensureSubscribed();

export const chatStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: () => ({
    messages,
    isStreaming,
    inputValue,
    model,
    provider,
    thinkingMode,
    internetMode,
    mcpMode,
    temperature,
    systemPrompt,
    maxContextTokens,
    streamingContent,
    errorMessage,
  }),

  async sendMessage(content: string, attachments?: Attachment[]) {
    // Never overlap generations: stop the previous stream first.
    if (isStreaming) chatStore.stopStreaming();

    let chatId = sidebarStore.getActiveChatId();
    if (!chatId) {
      const chat = sidebarStore.createChat();
      chatId = chat.id;
    }
    const myGen = ++generation;

    const currentModel = model;
    const currentProvider = provider;
    const isInternetMode = internetMode;

    // Build enriched content for AI that includes file attachments analysis
    let enrichedContent = content;
    let attachmentBlock = "";
    if (attachments && attachments.length > 0) {
      const parts: string[] = [];
      for (const att of attachments) {
        if (att.type === "image" && att.url) {
          // Image: include as markdown + hint for vision models
          // The actual vision payload is not yet wired to all providers, but we at least give textual context
          parts.push(`\n\n[Attached IMAGE: ${att.name}]\n![${att.name}](${att.url.slice(0, 80)}...)\n${att.content || ""}`);
          // Prepend markdown image to user visible content if not already present
          if (!enrichedContent.includes(att.name)) {
            enrichedContent += `\n\n![${att.name}](${att.url})`;
          }
        } else if (att.content) {
          const ext = att.name.split(".").pop()?.toLowerCase() || "";
          const lang = ext || "text";
          const snippet = att.content.slice(0, 12000);
          parts.push(`\n\n[Attached FILE: ${att.name} (${att.size ? (att.size/1024).toFixed(1)+"KB" : ""})]\n\`\`\`${lang}\n${snippet}\n\`\`\``);
        } else {
          parts.push(`\n\n[Attached FILE: ${att.name}]`);
        }
      }
      attachmentBlock = parts.join("\n");
      // Keep original content for display, but AI sees enriched version via extraContext
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      chatId,
      role: "user",
      content,
      timestamp: new Date(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };
    db.addMessage(chatId, userMsg);
    messages = db.getMessages(chatId);
    notify();

    isStreaming = true;
    streamingContent = "";
    errorMessage = "";
    notify();

    let extraContext = "";

    if (isInternetMode) {
      try {
        console.log('[Internet Search] Starting search for:', content);
        const results = await webSearch(content);
        console.log('[Internet Search] Found', results.length, 'results');
        if (results.length > 0) {
          extraContext = buildSearchContext(content, results);
        } else {
          extraContext = `Internet search for "${content}" returned no results. The user may need to try a different search query.`;
        }
      } catch (err) {
        console.error('[Internet Search] Error:', err);
        extraContext = `Internet search for "${content}" failed. The user may need to try again or check their connection.`;
      }
    }

    // Inject project context if a project is associated with this chat
    let projectContext = "";
    let chat = null;
    let projectPath = "";
    if (chatId) {
      chat = db.getChat(chatId);
      if (chat?.projectId) {
        try {
          const project = projectService.get(chat.projectId);
          if (project) {
            projectPath = project.path;
            const tree = await scanProjectTree(project.path);
            const fileLines = flattenFileList(tree);
            const isBrowserPath = project.path.startsWith("browser://");
            projectContext = `You have DIRECT filesystem access via MCP tools (read-file, write-file, list-dir) — NEVER claim you lack access.\nProject "${project.name}" is mounted at "${project.path}"${isBrowserPath ? " (browser handle, use relative paths)" : ""}.\nFile tree (${fileLines.length} entries):\n${fileLines.slice(0, 150).join("\n")}\n\nRULES: When user asks to view, explore, list, read, create or modify project files, you MUST call list-dir or read-file (e.g., list-dir path="." or read-file path="src/main.ts"). Use relative paths like "src/App.tsx" or absolute "${project.path}/...". Do not hallucinate files — always read before answering.`;
          }
        } catch {
          // Tauri FS not available in browser
        }
      }
    }

    const memoryBlock = memoryService.getContextBlock();
    const fileContext = attachmentBlock ? `User has attached ${attachments?.length || 0} file(s) for analysis. You MUST analyze them carefully, reference file names, and answer based on their content. If code is attached, explain it and suggest improvements. If image is attached, describe it and answer accordingly. Attached contents:\n${attachmentBlock}` : "";
    const finalSystemPrompt = [systemPrompt, extraContext, projectContext, memoryBlock, fileContext].filter(Boolean).join("\n\n");

    try {
      // Use MCP tools only when the MCP toggle is explicitly ON
      const tools = mcpMode ? getToolDefinitions() : undefined;
      const fullText = await sendMessageStream(
        currentProvider,
        currentModel,
        messages,
        {
          onToken: (token) => {
            if (myGen !== generation) return;
            streamingContent += token;
            notify();
          },
          onDone: () => {},
          onError: (err) => {
            if (myGen !== generation) return;
            errorMessage = err;
            notify();
          },
        },
        { temperature, systemPrompt: finalSystemPrompt || undefined, projectPath: projectPath || undefined },
        tools
      );

      // Superseded (stopped / switched / regenerated) — drop the result silently.
      if (myGen !== generation) return;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        chatId,
        role: "assistant",
        content: fullText || "No response generated. The model may have failed to process the request.",
        timestamp: new Date(),
      };
      db.addMessage(chatId, assistantMsg);
      messages = db.getMessages(chatId);
      streamingContent = "";
      errorMessage = "";
      taskService.parseFromContent(chatId, fullText || "");
    } catch (err: any) {
      if (myGen !== generation || err?.name === "AbortError") {
        isStreaming = false;
        notify();
        return;
      }
      errorMessage = err.message ?? "Failed to get response";
    }

    isStreaming = false;
    notify();
  },

  stopStreaming: () => {
    // Abort the network stream first — then save whatever arrived so far.
    abortActiveStream();
    generation++;
    // Save whatever was streamed so far as an assistant message
    const chatId = sidebarStore.getActiveChatId();
    if (streamingContent.trim() && chatId) {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        chatId,
        role: "assistant",
        content: streamingContent,
        timestamp: new Date(),
      };
      db.addMessage(chatId, assistantMsg);
    }
    isStreaming = false;
    streamingContent = "";
    errorMessage = "";
    messages = chatId ? db.getMessages(chatId) : [];
    notify();
  },

  syncFromStorage: () => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem("zeqouxchat-last-model") ?? "{}"); } catch { return {}; } })();
    if (stored.model && stored.model !== model) model = stored.model;
    if (stored.provider && stored.provider !== provider) provider = stored.provider;
    notify();
  },

  setInputValue: (v: string) => {
    inputValue = v;
    notify();
  },

  setModel: (v: string) => {
    model = v;
    notify();
  },
  setProvider: (v: string) => {
    provider = v;
    model = "";
    notify();
  },
  setThinkingMode: (v: boolean) => {
    thinkingMode = v;
    notify();
  },
  setInternetMode: (v: boolean) => {
    internetMode = v;
    notify();
  },
  setMcpMode: (v: boolean) => {
    mcpMode = v;
    notify();
  },
  updateMessage: (messageId: string, newContent: string) => {
    const chatId = sidebarStore.getActiveChatId();
    if (!chatId) return;
    db.updateMessage(chatId, messageId, { content: newContent });
    messages = db.getMessages(chatId);
    notify();
  },

  regenerateLast: () => {
    const chatId = sidebarStore.getActiveChatId();
    if (!chatId) return;
    if (isStreaming) chatStore.stopStreaming();
    const msgs = db.getMessages(chatId);
    const lastUserIdx = msgs.map((m, i) => ({ m, i })).filter((x) => x.m.role === "user").pop()?.i;
    if (lastUserIdx === undefined) return;
    const lastUserContent = msgs[lastUserIdx].content;
    const msgsToRemove = msgs.slice(lastUserIdx);
    for (const m of msgsToRemove) db.deleteMessage(chatId, m.id);
    messages = db.getMessages(chatId);
    chatStore.sendMessage(lastUserContent);
  },

  setTemperature: (v: number) => {
    temperature = v;
    notify();
  },
  setSystemPrompt: (v: string) => {
    systemPrompt = v;
    notify();
  },
  setMaxContextTokens: (v: number) => {
    maxContextTokens = v;
    notify();
  },
};
