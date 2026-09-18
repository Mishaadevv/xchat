import type { Chat, Message, Folder } from "@/core/types";

const STORAGE_KEY = "zeqouxchat-data";

interface StoreData {
  chats: Chat[];
  messages: Record<string, Message[]>;
  folders: Folder[];
}

function load(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        chats: data.chats?.map((c: any) => ({ ...c, createdAt: new Date(c.createdAt), modifiedAt: new Date(c.modifiedAt) })) ?? [],
        messages: data.messages ?? {},
        folders: data.folders ?? [],
      };
    }
  } catch {}
  return { chats: [], messages: {}, folders: [] };
}

function save(data: StoreData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let cache: StoreData = load();

function persist() {
  save(cache);
}

export const db = {
  getChats: () => [...cache.chats],

  getChat: (id: string) => cache.chats.find((c) => c.id === id) ?? null,

  addChat: (chat: Chat) => {
    cache.chats.unshift(chat);
    cache.messages[chat.id] = [];
    persist();
  },

  updateChat: (id: string, updates: Partial<Chat>) => {
    const idx = cache.chats.findIndex((c) => c.id === id);
    if (idx !== -1) {
      cache.chats[idx] = { ...cache.chats[idx], ...updates, modifiedAt: new Date() };
      persist();
    }
  },

  deleteChat: (id: string) => {
    cache.chats = cache.chats.filter((c) => c.id !== id);
    delete cache.messages[id];
    persist();
  },

  duplicateChat: (id: string): Chat | null => {
    const original = cache.chats.find((c) => c.id === id);
    if (!original) return null;
    const newChat: Chat = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title} (copy)`,
      createdAt: new Date(),
      modifiedAt: new Date(),
      pinned: false,
    };
    cache.chats.unshift(newChat);
    cache.messages[newChat.id] = [...(cache.messages[id] ?? [])].map((m) => ({
      ...m,
      id: crypto.randomUUID(),
      chatId: newChat.id,
    }));
    persist();
    return newChat;
  },

  getMessages: (chatId: string) => [...(cache.messages[chatId] ?? [])],

  addMessage: (chatId: string, message: Message) => {
    if (!cache.messages[chatId]) cache.messages[chatId] = [];
    cache.messages[chatId].push(message);
    const chat = cache.chats.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessage = message.content.slice(0, 100);
      chat.modifiedAt = new Date();
    }
    persist();
  },

  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => {
    const msgs = cache.messages[chatId];
    if (msgs) {
      const idx = msgs.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        msgs[idx] = { ...msgs[idx], ...updates };
        persist();
      }
    }
  },

  deleteMessage: (chatId: string, messageId: string) => {
    if (cache.messages[chatId]) {
      cache.messages[chatId] = cache.messages[chatId].filter((m) => m.id !== messageId);
      persist();
    }
  },

  getFolders: () => [...cache.folders],

  addFolder: (folder: Folder) => {
    cache.folders.push(folder);
    persist();
  },

  removeFolder: (id: string) => {
    cache.folders = cache.folders.filter((f) => f.id !== id);
    persist();
  },
};
