export type Section =
  | "dashboard"
  | "rules"
  | "generate"
  | "import"
  | "fetch"
  | "config";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface RulesFile {
  name: string;
  path: string;
  content?: string;
}

export interface OutputLine {
  text: string;
  isError: boolean;
  ts: number;
}

export interface RulesyncFeatures {
  rules?: boolean;
  ignore?: boolean;
  mcp?: boolean;
  commands?: boolean;
  subagents?: boolean;
  skills?: boolean;
}

export interface RulesyncConfig {
  targets?: string[];
  features?: RulesyncFeatures;
  baseDirs?: string[];
  delete?: boolean;
  verbose?: boolean;
  global?: boolean;
}

export const ALL_TARGETS = [
  "aider",
  "amp",
  "bolt",
  "cline",
  "claudecode",
  "codex",
  "continue",
  "copilot",
  "cursor",
  "emacs",
  "gemini-cli",
  "goose",
  "jetbrains",
  "lovable",
  "neovim",
  "pear",
  "qodo",
  "replit",
  "roo",
  "sider",
  "sourcery",
  "tabnine",
  "v0",
  "windsurf",
  "zed",
] as const;

export type Target = (typeof ALL_TARGETS)[number];

export const ALL_FEATURES: (keyof RulesyncFeatures)[] = [
  "rules",
  "ignore",
  "mcp",
  "commands",
  "subagents",
  "skills",
];
