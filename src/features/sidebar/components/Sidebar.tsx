import { useState, useEffect } from "react";
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Blocks,
  Brain,
  Download,
  Puzzle,
  Settings,
  Pencil,
  Copy,
  Pin,
  Trash2,
  FolderPlus,
  FolderX,
  Folder,
  Database,
  Store,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/useStore";
import { sidebarStore } from "../store/sidebarStore";
import { appStore } from "@/app/store/appStore";
import { chatStore } from "@/features/chat/store/chatStore";
import { downloadService } from "@/services/downloads";
import { SearchBar } from "./SearchBar";
import { ChatListItem } from "./ChatListItem";
import { i18n } from "@/services/i18n";
import { navVisibility, type NavId } from "@/services/navVisibility";

export function Sidebar() {
  const { expanded, chats, activeChatId, folders } = useStore(
    sidebarStore.subscribe,
    sidebarStore.getState
  );
  const { currentView } = useStore(appStore.subscribe, appStore.getState);
  const { isStreaming } = useStore(chatStore.subscribe, chatStore.getState);
  const locale = useStore(i18n.subscribe, i18n.getLocale);
  const { hidden } = useStore(navVisibility.subscribe, navVisibility.getState);
  const [downloadCount, setDownloadCount] = useState(0);

  const allNavItems = [
    { id: "hub" as NavId, icon: Blocks, label: i18n.t("nav.hub") },
    { id: "projects" as NavId, icon: Folder, label: i18n.t("nav.projects") },
    { id: "training" as NavId, icon: Brain, label: i18n.t("nav.training") },
    { id: "memory" as NavId, icon: Database, label: i18n.t("nav.memory") },
    { id: "marketplace" as NavId, icon: Store, label: i18n.t("nav.marketplace") },
    { id: "downloads" as NavId, icon: Download, label: i18n.t("nav.downloads") },
    { id: "extensions" as NavId, icon: Puzzle, label: i18n.t("nav.extensions") },
  ] as const;

  const navItems = allNavItems.filter((item) => !hidden.has(item.id));
  const hiddenCount = hidden.size;
  const hiddenItems = allNavItems.filter((item) => hidden.has(item.id));

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showFolderMenu, setShowFolderMenu] = useState(false);

  useEffect(() => {
    setDownloadCount(downloadService.getAll().filter((d) => d.status === "downloading").length);
    const unsub = downloadService.subscribe(() => {
      setDownloadCount(downloadService.getAll().filter((d) => d.status === "downloading").length);
    });
    return () => { unsub(); };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chatId });
  };

  const closeContextMenu = () => setContextMenu(null);
  const chatGroups = getChatGroups(chats);

  return (
    <TooltipProvider delayDuration={300}>
      <motion.aside
        initial={false}
        animate={{ width: expanded ? 280 : 72 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 overflow-hidden"
      >
        <div className={cn(
          "flex items-center h-14 px-3",
          expanded ? "justify-end" : "justify-center"
        )}>
          <button
            onClick={() => sidebarStore.toggleExpanded()}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-sidebar-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn("px-3", expanded ? "block" : "flex justify-center")}>
          <button
            onClick={() => {
              const stored = (() => { try { return JSON.parse(localStorage.getItem("zeqouxchat-last-model") ?? "{}"); } catch { return {}; } })();
              sidebarStore.createChat(stored.model, stored.provider);
              appStore.setView("chat");
            }}
            className={cn(
              "bg-primary text-primary-foreground rounded-lg flex items-center justify-center gap-2 text-sm font-medium hover:opacity-90 transition-opacity",
              expanded ? "w-full h-10" : "h-10 w-10"
            )}
          >
            <Plus className="h-4 w-4" />
            {expanded && <span>{i18n.t("chat.new")}</span>}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 mt-3"
            >
              <SearchBar expanded={expanded} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 min-h-0 mt-2" onClick={closeContextMenu}>
          <ScrollArea className="h-full px-2">
            {chats.length === 0 && expanded && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-muted-foreground">{i18n.t("sidebar.no_chats")}</p>
                <p className="text-xs text-muted-foreground mt-1">{i18n.t("sidebar.start_chat")}</p>
              </div>
            )}

            {expanded
              ? Object.entries(chatGroups).map(([label, groupChats]) =>
                  groupChats.length > 0 ? (
                    <div key={label}>
                      <p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {label}
                      </p>
                      {groupChats.map((chat) => (
                        <div key={chat.id} onContextMenu={(e) => handleContextMenu(e, chat.id)}>
                          {renaming === chat.id ? (
                            <div className="px-3 py-1">
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => {
                                  if (renameValue.trim()) sidebarStore.renameChat(chat.id, renameValue.trim());
                                  setRenaming(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    if (renameValue.trim()) sidebarStore.renameChat(chat.id, renameValue.trim());
                                    setRenaming(null);
                                  }
                                  if (e.key === "Escape") setRenaming(null);
                                }}
                                className="w-full h-8 px-2 bg-background border border-border rounded-md text-sm outline-none"
                              />
                            </div>
                          ) : (
                            <ChatListItem
                              chat={chat}
                              active={chat.id === activeChatId}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null
                )
              : chats.map((chat) => (
                  <div key={chat.id} onContextMenu={(e) => handleContextMenu(e, chat.id)}>
                    <ChatListItem chat={chat} active={chat.id === activeChatId} />
                  </div>
                ))}
          </ScrollArea>
        </div>

        <Separator />

        <div className={cn("py-2", expanded ? "px-2" : "px-1")}>
          {(
            expanded ? (
              <>
                <NavButton
                  icon={MessageSquare}
                  label={i18n.t("nav.chats")}
                  active={currentView === "chat"}
                  onClick={() => appStore.setView("chat")}
                  badge={isStreaming}
                  expanded
                />
                {navItems.map((item) => (
                  <NavButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={currentView === item.id}
                    onClick={() => appStore.setView(item.id as any)}
                    badge={item.id === "downloads" ? (downloadCount || undefined) : undefined}
                    expanded
                    onHide={() => {
                      navVisibility.hide(item.id);
                      if (currentView === item.id) appStore.setView("chat");
                    }}
                  />
                ))}
                <Separator className="my-2" />
                <NavButton
                  icon={Settings}
                  label={i18n.t("nav.settings")}
                  active={currentView === "settings"}
                  onClick={() => appStore.setView("settings")}
                  expanded
                />
                {hiddenCount > 0 && (
                  <div className="mt-2 px-1 space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 rounded-md bg-secondary/50 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" />{hiddenCount} {locale === "ru" ? "скрыто" : "hidden"}</span>
                      <button onClick={() => navVisibility.showAll()} className="text-primary hover:underline font-medium">{i18n.t("nav.show_all")}</button>
                    </div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {hiddenItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navVisibility.show(item.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <item.icon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          <Eye className="h-3 w-3 ml-auto shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <NavButton icon={MessageSquare} label={i18n.t("nav.chats")} active={currentView === "chat"} onClick={() => appStore.setView("chat")} badge={isStreaming} />
                {navItems.map((item) => (
                  <NavButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={currentView === item.id}
                    onClick={() => appStore.setView(item.id as any)}
                    badge={item.id === "downloads" ? (downloadCount || undefined) : undefined}
                    onHide={() => {
                      navVisibility.hide(item.id);
                      if (currentView === item.id) appStore.setView("chat");
                    }}
                  />
                ))}
                <Separator className="my-2" />
                <NavButton icon={Settings} label={i18n.t("nav.settings")} active={currentView === "settings"} onClick={() => appStore.setView("settings")} />
                {hiddenCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navVisibility.showAll()}
                        className="w-full mt-2 h-8 flex items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center rounded-full px-1">{hiddenCount}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{i18n.t("nav.show_all")} ({hiddenCount})</TooltipContent>
                  </Tooltip>
                )}
              </>
            )
          )}
        </div>
      </motion.aside>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeContextMenu} />
          <div
            className="fixed z-50 w-48 bg-popover border border-border rounded-xl shadow-lg py-1.5"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <ContextMenuItem icon={Pencil} label="Rename" onClick={() => {
              const chat = chats.find((c) => c.id === contextMenu.chatId);
              if (chat) { setRenameValue(chat.title); setRenaming(contextMenu.chatId); }
              closeContextMenu();
            }} />
            <ContextMenuItem icon={Copy} label="Duplicate" onClick={() => {
              sidebarStore.duplicateChat(contextMenu.chatId);
              closeContextMenu();
            }} />
            <ContextMenuItem icon={Pin} label="Toggle Pin" onClick={() => {
              sidebarStore.togglePin(contextMenu.chatId);
              closeContextMenu();
            }} />
            <div className="relative" onMouseEnter={() => setShowFolderMenu(true)} onMouseLeave={() => setShowFolderMenu(false)}>
              <ContextMenuItem icon={FolderPlus} label="Move to Folder" onClick={() => {}} />
              {showFolderMenu && (
                <div className="absolute left-full top-0 ml-1 w-44 bg-popover border border-border rounded-xl shadow-lg py-1.5 z-50">
                  {folders.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">{i18n.t("sidebar.no_folders")}</p>
                  )}
                  {folders.map((f) => (
                    <ContextMenuItem key={f.id} icon={Folder} label={f.name} onClick={() => {
                      sidebarStore.moveChatToFolder(contextMenu.chatId, f.id);
                      setShowFolderMenu(false);
                      closeContextMenu();
                    }} />
                  ))}
                  <Separator className="my-1" />
                  <ContextMenuItem icon={Plus} label={i18n.t("sidebar.new_folder")} onClick={() => {
                    const name = prompt(i18n.t("sidebar.folder_name_prompt"));
                    if (name) {
                      sidebarStore.createFolder(name);
                      setShowFolderMenu(false);
                      closeContextMenu();
                    }
                  }} />
                  <ContextMenuItem icon={FolderX} label={i18n.t("sidebar.remove_from_folder")} onClick={() => {
                    sidebarStore.moveChatToFolder(contextMenu.chatId, null);
                    setShowFolderMenu(false);
                    closeContextMenu();
                  }} />
                </div>
              )}
            </div>
            <Separator className="my-1" />
            <ContextMenuItem icon={Trash2} label="Delete" danger onClick={() => {
              sidebarStore.deleteChat(contextMenu.chatId);
              closeContextMenu();
            }} />
          </div>
        </>
      )}
    </TooltipProvider>
  );
}

function NavButton({ icon: Icon, label, active, onClick, badge, expanded: _expanded, onHide }: {
  icon: any; label: string; active: boolean; onClick: () => void; badge?: number | boolean; expanded?: boolean; onHide?: () => void;
}) {
  if (_expanded) {
    return (
      <div className="group relative flex items-center gap-1">
        <button
          onClick={onClick}
          className={cn(
            "flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative text-left",
            active ? "bg-sidebar-muted font-medium" : "text-muted-foreground hover:bg-sidebar-muted"
          )}
        >
          <div className="relative shrink-0">
            <Icon className="h-4 w-4 shrink-0" />
            {badge === true && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="truncate flex-1">{label}</span>
          {typeof badge === "number" && badge > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
              {badge}
            </span>
          )}
        </button>
        {onHide && (
          <button
            onClick={(e) => { e.stopPropagation(); onHide(); }}
            title={label + " — hide"}
            className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="group relative w-full">
          <button
            onClick={onClick}
            className={cn(
              "w-full flex items-center justify-center h-10 rounded-lg transition-colors relative",
              active ? "bg-sidebar-muted" : "text-muted-foreground hover:bg-sidebar-muted"
            )}
          >
            <div className="relative">
              <Icon className="h-4 w-4" />
              {badge === true && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
              )}
              {typeof badge === "number" && badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full bg-primary text-primary-foreground min-w-[14px] h-[14px] flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
          </button>
          {onHide && (
            <button
              onClick={(e) => { e.stopPropagation(); onHide(); }}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-background border border-border shadow-sm hidden group-hover:flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function ContextMenuItem({ icon: Icon, label, danger, onClick }: {
  icon: any; label: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-1.5 text-sm transition-colors",
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function getChatGroups(chats: import("@/core/types").Chat[]): Record<string, import("@/core/types").Chat[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 6 * 86400000);
  const last30 = new Date(today.getTime() - 29 * 86400000);

  const pinned = chats.filter((c) => c.pinned);
  const unpinned = chats.filter((c) => !c.pinned);

  const groups: Record<string, typeof chats> = {};
  if (pinned.length) groups[i18n.t("sidebar.pinned")] = pinned;

  for (const chat of unpinned) {
    const d = new Date(chat.modifiedAt);
    let label: string;
    if (d >= today) label = i18n.t("sidebar.today");
    else if (d >= yesterday) label = i18n.t("sidebar.yesterday");
    else if (d >= last7) label = i18n.t("sidebar.last_7");
    else if (d >= last30) label = i18n.t("sidebar.last_30");
    else label = i18n.t("sidebar.older");
    if (!groups[label]) groups[label] = [];
    groups[label].push(chat);
  }
  return groups;
}
