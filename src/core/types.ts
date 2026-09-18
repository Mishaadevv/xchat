export type View = "chat" | "hub" | "settings" | "downloads" | "extensions" | "projects" | "training" | "memory" | "marketplace";

export interface Chat {
  id: string;
  title: string;
  model: string;
  provider: string;
  lastMessage: string;
  modifiedAt: Date;
  createdAt: Date;
  pinned: boolean;
  unread: boolean;
  projectId?: string;
  folderId?: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  tokenCount?: number;
  toolCallId?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: "image" | "file" | "folder";
  size?: number;
  url?: string;          // data URL or object URL for preview
  mime?: string;
  content?: string;      // text content for code/docs (first ~10k chars)
}

export interface Folder {
  id: string;
  name: string;
  chatIds: string[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
}
