# rulesync GUI

A cross-platform desktop app for [rulesync](https://github.com/dyoshikawa/rulesync) — the CLI tool that generates AI coding agent configuration files (Claude Code, Cursor, Copilot, Gemini CLI, Codex, and more) from a single set of unified rule files.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Tauri](https://img.shields.io/badge/Tauri-2.x-blue)
![React](https://img.shields.io/badge/React-19-61dafb)

## What it does

rulesync lets you define your project's AI rules once in `.rulesync/` markdown files and generate the right config for every tool automatically. This GUI wraps the full rulesync workflow so you never have to touch the CLI.

**Screens:**

| Screen | What it does |
|--------|-------------|
| Dashboard | Project status — detects config, auto-runs `init` if missing, shows targets/features/file counts |
| Rules Editor | Browse `.rulesync/` files, edit frontmatter (targets, description, globs) and body with CodeMirror 6 |
| Generate | Pick targets and features, run `rulesync generate`, stream live output |
| Import | Import rules from existing Claude Code, Cursor, or Copilot configs |
| Fetch | Pull skills from any GitHub repo with `rulesync fetch owner/repo` |
| Config | Visual editor for `rulesync.jsonc` — no manual JSON editing required |

## Tech stack

- **[Tauri 2](https://tauri.app)** — native desktop shell (Rust backend)
- **React 19 + TypeScript + Vite** — frontend
- **Tailwind CSS v4** — styling
- **CodeMirror 6** — markdown rule file editor
- **Zustand** — global state with localStorage persistence
- **rulesync** — bundled as a Tauri sidecar (no separate install needed)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) for your platform

### Setup

```bash
# 1. Clone
git clone https://github.com/Tecnico1931/mcpSyncGui.git
cd mcpSyncGui

# 2. Download rulesync sidecar binaries
bash scripts/download-binaries.sh

# 3. Install JS dependencies
npm install

# 4. Run in development
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
```

Produces a `.dmg` on macOS, `.msi` / `.exe` installer on Windows, and `.AppImage` / `.deb` on Linux.

## Project structure

```
mcpSyncGui/
├── src/
│   ├── components/       # React screens (Dashboard, RulesEditor, Generate, …)
│   ├── store/            # Zustand global state
│   ├── lib/tauri.ts      # Typed wrappers for all Tauri commands
│   └── types.ts          # Shared TypeScript types
├── src-tauri/
│   ├── src/lib.rs        # Rust commands (file I/O, rulesync runner)
│   ├── binaries/         # rulesync sidecar binaries (git-ignored, see below)
│   └── tauri.conf.json
└── scripts/
    └── download-binaries.sh   # Fetches latest rulesync release binaries
```

> **Note:** `src-tauri/binaries/` is excluded from git because the binaries are 60–120 MB each. Run `bash scripts/download-binaries.sh` after cloning to fetch them.

## Auto-detection

On launch the app automatically:

1. Reopens the last remembered project (stored in localStorage)
2. Falls back to the process CWD if it looks like a project
3. Scans CWD subdirectories for `rulesync.jsonc`
4. Falls back to the home directory

If `rulesync.jsonc` is not found in the chosen directory, the Dashboard silently runs `rulesync init` to create it.

If `rulesync` is installed on your system PATH, the app uses that version. Otherwise it falls back to the bundled sidecar.

## License

MIT
