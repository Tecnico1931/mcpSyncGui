import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { openDirectory } from "../lib/tauri";
import Dashboard from "./Dashboard";
import RulesEditor from "./RulesEditor";
import Generate from "./Generate";
import Import from "./Import";
import Fetch from "./Fetch";
import Config from "./Config";
import type { Section } from "../types";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "rules", label: "Rules", icon: "✎" },
  { id: "generate", label: "Generate", icon: "⚡" },
  { id: "import", label: "Import", icon: "↓" },
  { id: "fetch", label: "Fetch", icon: "↻" },
  { id: "config", label: "Config", icon: "⚙" },
];

export default function Layout() {
  const { section, setSection, projectDir, setProjectDir } = useAppStore();
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const projectName = projectDir?.split("/").pop() || projectDir || "—";

  const handleOpenDir = async () => {
    const dir = await openDirectory();
    if (dir) {
      setProjectDir(dir);
      setSection("dashboard");
    }
    setShowProjectMenu(false);
  };

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <Dashboard />;
      case "rules":     return <RulesEditor />;
      case "generate":  return <Generate />;
      case "import":    return <Import />;
      case "fetch":     return <Fetch />;
      case "config":    return <Config />;
    }
  };

  return (
    <div className="flex h-full bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-48 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">

        {/* Project header — click to switch project */}
        <div className="relative">
          <button
            onClick={() => setShowProjectMenu((v) => !v)}
            className="w-full px-4 py-3 border-b border-gray-800 text-left hover:bg-gray-800 transition-colors"
          >
            <div className="text-xs font-bold text-indigo-400 tracking-wide flex items-center justify-between">
              <span>rulesync</span>
              <span className="text-gray-600 text-[10px]">▾</span>
            </div>
            <div
              className="text-xs text-gray-500 mt-0.5 truncate"
              title={projectDir ?? ""}
            >
              {projectName}
            </div>
          </button>

          {/* Project switcher dropdown */}
          {showProjectMenu && (
            <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-700 shadow-xl">
              <button
                onClick={handleOpenDir}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <span>📁</span>
                Open Different Folder…
              </button>
              <div
                className="fixed inset-0 -z-10"
                onClick={() => setShowProjectMenu(false)}
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={[
                "flex items-center gap-2.5 w-full px-4 py-2.5 text-sm transition-colors",
                section === id
                  ? "bg-indigo-950 text-indigo-300 border-l-2 border-indigo-500"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800 border-l-2 border-transparent",
              ].join(" ")}
            >
              <span className="text-base leading-none w-4 text-center">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{renderSection()}</main>
    </div>
  );
}
