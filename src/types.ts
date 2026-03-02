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

// Local UI state for feature checkboxes (Generate / Import / Fetch screens)
export interface RulesyncFeatures {
  rules?: boolean;
  ignore?: boolean;
  mcp?: boolean;
  commands?: boolean;
  subagents?: boolean;
  skills?: boolean;
  hooks?: boolean;
}

// rulesync.jsonc on disk — features is a string array in current rulesync
export interface RulesyncConfig {
  targets?: string[];
  features?: string[];
  baseDirs?: string[];
  delete?: boolean;
  verbose?: boolean;
  global?: boolean;
}

// Valid targets from current rulesync CLI
export const ALL_TARGETS = [
  "agentsmd",
  "agentsskills",
  "antigravity",
  "augmentcode",
  "augmentcode-legacy",
  "claudecode",
  "claudecode-legacy",
  "cline",
  "codexcli",
  "copilot",
  "cursor",
  "factorydroid",
  "geminicli",
  "goose",
  "junie",
  "kilo",
  "kiro",
  "opencode",
  "qwencode",
  "replit",
  "roo",
  "warp",
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
  "hooks",
];
