import { MessageSquare, Pin } from "lucide-react";
import { type Chat } from "@/core/types";
import { cn } from "@/lib/utils";
import { sidebarStore } from "../store/sidebarStore";

interface ChatListItemProps {
  chat: Chat;
  active: boolean;
}

export function ChatListItem({ chat, active }: ChatListItemProps) {
  return (
    <button
      onClick={() => sidebarStore.setActiveChat(chat.id)}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors group",
        active
          ? "bg-accent"
          : "hover:bg-accent/50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          active ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}>
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{chat.title}</span>
            {chat.pinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {chat.lastMessage}
          </p>
        </div>
        {chat.unread && (
          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
        )}
      </div>
    </button>
  );
}
