import { Search } from "lucide-react";
import { sidebarStore } from "../store/sidebarStore";

export function SearchBar({ expanded }: { expanded: boolean }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        placeholder={expanded ? "Search chats..." : ""}
        className="w-full h-9 pl-9 pr-3 bg-secondary rounded-md text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring transition-all"
        onChange={(e) => sidebarStore.setSearchQuery(e.target.value)}
      />
    </div>
  );
}
