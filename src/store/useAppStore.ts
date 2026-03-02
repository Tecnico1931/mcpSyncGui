import { create } from "zustand";
import type { Section, RulesFile, OutputLine, RulesyncConfig } from "../types";

interface AppState {
  projectDir: string | null;
  recentProjects: string[];
  section: Section;
  rulesyncConfig: RulesyncConfig | null;
  rulesFiles: RulesFile[];
  selectedFile: string | null;
  outputLog: OutputLine[];
  isRunning: boolean;

  setProjectDir: (dir: string) => void;
  clearProject: () => void;
  setSection: (section: Section) => void;
  setRulesyncConfig: (config: RulesyncConfig | null) => void;
  setRulesFiles: (files: RulesFile[]) => void;
  setSelectedFile: (file: string | null) => void;
  appendOutput: (line: OutputLine) => void;
  clearOutput: () => void;
  setIsRunning: (running: boolean) => void;
  addRecentProject: (dir: string) => void;
}

const RECENT_KEY = "rulesync-recent-projects";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(projects: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(projects));
}

export const useAppStore = create<AppState>((set, get) => ({
  projectDir: null,
  recentProjects: loadRecent(),
  section: "dashboard",
  rulesyncConfig: null,
  rulesFiles: [],
  selectedFile: null,
  outputLog: [],
  isRunning: false,

  setProjectDir: (dir: string) => {
    set({ projectDir: dir, section: "dashboard" });
    get().addRecentProject(dir);
  },

  clearProject: () => {
    set({ projectDir: null, rulesyncConfig: null, rulesFiles: [], selectedFile: null });
  },

  setSection: (section: Section) => set({ section }),

  setRulesyncConfig: (config) => set({ rulesyncConfig: config }),

  setRulesFiles: (files) => set({ rulesFiles: files }),

  setSelectedFile: (file) => set({ selectedFile: file }),

  appendOutput: (line) =>
    set((state) => ({
      outputLog: [...state.outputLog.slice(-499), line],
    })),

  clearOutput: () => set({ outputLog: [] }),

  setIsRunning: (running) => set({ isRunning: running }),

  addRecentProject: (dir: string) => {
    const recent = [dir, ...get().recentProjects.filter((p) => p !== dir)].slice(0, 5);
    set({ recentProjects: recent });
    saveRecent(recent);
  },
}));
