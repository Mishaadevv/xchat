import { useEffect } from "react";
import { useStore } from "@/lib/useStore";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { chatStore } from "../store/chatStore";
import { ChatEmpty } from "./ChatEmpty";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";

export function ChatArea() {
  const { messages } = useStore(chatStore.subscribe, chatStore.getState);
  const { activeChatId } = useStore(sidebarStore.subscribe, sidebarStore.getState);

  useEffect(() => {
    chatStore.syncFromStorage();
  }, []);

  if (!activeChatId) {
    return <ChatEmpty />;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
      <ChatHeader />
      <ChatMessages />
      <ChatInput />
    </div>
  );
}
