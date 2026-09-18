import type { Chat, Folder } from "@/core/types";
import { db } from "@/services/db";
import { providerService } from "@/services/providers";

let expanded = true;
let searchQuery = "";
let activeChatId: string | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getFilteredChats(): Chat[] {
  let chats = db.getChats();
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    chats = chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessage?.toLowerCase().includes(q)
    );
  }
  return chats;
}

export const sidebarStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: () => ({
    expanded,
    searchQuery,
    activeChatId,
    chats: getFilteredChats(),
    folders: db.getFolders(),
  }),

  toggleExpanded: () => {
    expanded = !expanded;
    notify();
  },
  setExpanded: (v: boolean) => {
    expanded = v;
    notify();
  },

  setSearchQuery: (q: string) => {
    searchQuery = q;
    notify();
  },
  getSearchQuery: () => searchQuery,
  refreshChats: () => { notify(); },

  setActiveChat: (id: string | null) => {
    activeChatId = id;
    notify();
  },
  getActiveChatId: () => activeChatId,

  createChat: (model?: string, provider?: string) => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem("zeqouxchat-last-model") ?? "{}"); } catch { return {}; } })();
    const providers = providerService.getProviders();
    const defaultModel = model ?? stored.model ?? (providers.find((p) => p.models.length > 0)?.models[0] ?? "");
    const defaultProvider = provider ?? stored.provider ?? (providers.find((p) => p.models.length > 0)?.id ?? "");
    const chat: Chat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      model: defaultModel,
      provider: defaultProvider,
      lastMessage: "",
      createdAt: new Date(),
      modifiedAt: new Date(),
      pinned: false,
      unread: false,
    };
    db.addChat(chat);
    activeChatId = chat.id;
    if (!expanded) expanded = true;
    notify();
    return chat;
  },

  renameChat: (id: string, title: string) => {
    db.updateChat(id, { title });
    notify();
  },

  deleteChat: (id: string) => {
    db.deleteChat(id);
    if (activeChatId === id) activeChatId = null;
    notify();
  },

  duplicateChat: (id: string) => {
    const chat = db.duplicateChat(id);
    if (chat) {
      activeChatId = chat.id;
      notify();
    }
  },

  togglePin: (id: string) => {
    const chat = db.getChat(id);
    if (chat) {
      db.updateChat(id, { pinned: !chat.pinned });
      notify();
    }
  },

  createFolder: (name: string) => {
    const folder: Folder = { id: crypto.randomUUID(), name, chatIds: [] };
    db.addFolder(folder);
    notify();
  },

  deleteFolder: (id: string) => {
    db.removeFolder(id);
    notify();
  },

  moveChatToFolder: (chatId: string, folderId: string | null) => {
    const folders = db.getFolders();
    for (const f of folders) {
      const idx = f.chatIds.indexOf(chatId);
      if (idx !== -1) f.chatIds.splice(idx, 1);
    }
    if (folderId) {
      const folder = folders.find((f) => f.id === folderId);
      if (folder) folder.chatIds.push(chatId);
    }
    notify();
  },
};
