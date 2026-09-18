import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/useStore";
import { appStore } from "@/app/store/appStore";
import { providerService } from "@/services/providers";
import { Sidebar } from "@/features/sidebar/components/Sidebar";
import { ChatArea } from "@/features/chat/components/ChatArea";
import { HubPage } from "@/features/hub/components/HubPage";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { DownloadsPage } from "@/features/downloads/components/DownloadsPage";
import { ExtensionsPage } from "@/features/extensions/components/ExtensionsPage";
import { RightPanel } from "@/features/right-panel/components/RightPanel";
import { ProjectsPage } from "@/features/projects/components/ProjectsPage";
import { TrainingPage } from "@/features/training/components/TrainingPage";
import { MemoryPage } from "@/features/memory/components/MemoryPage";
import { MarketplacePage } from "@/features/marketplace/components/MarketplacePage";

function MainContent() {
  const { currentView } = useStore(appStore.subscribe, appStore.getState);

  const viewMap: Record<string, React.ReactNode> = {
    hub: <HubPage />,
    settings: <SettingsPage />,
    downloads: <DownloadsPage />,
    extensions: <ExtensionsPage />,
    projects: <ProjectsPage />,
    training: <TrainingPage />,
    memory: <MemoryPage />,
    marketplace: <MarketplacePage />,
    chat: <ChatArea />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex-1 flex min-w-0 min-h-0"
      >
        {viewMap[currentView] ?? <ChatArea />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  // Auto-detect Ollama and free providers on startup
  useEffect(() => {
    providerService.autoRefreshFreeProviders().catch(() => {});
  }, []);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <Sidebar />
      <MainContent />
      <RightPanel />
    </div>
  );
}
