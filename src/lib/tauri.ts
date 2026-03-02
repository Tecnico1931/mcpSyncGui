import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileEntry, OutputLine } from "../types";

// ─── Environment ─────────────────────────────────────────────────────────────

export async function getCwd(): Promise<string | null> {
  return invoke<string | null>("get_cwd");
}

export async function getHomeDir(): Promise<string | null> {
  return invoke<string | null>("get_home_dir");
}

/** Scans dir + one level of subdirs for rulesync.jsonc; returns matching dirs. */
export async function findRulesyncConfigs(dir: string): Promise<string[]> {
  return invoke<string[]>("find_rulesync_configs", { dir });
}

/** Returns path to system-installed rulesync, or null if not in PATH. */
export async function whichRulesync(): Promise<string | null> {
  return invoke<string | null>("which_rulesync");
}

/** Runs `rulesync --version` and returns the version string (e.g. "7.10.0"). */
export async function getRulesyncVersion(): Promise<string | null> {
  return invoke<string | null>("get_rulesync_version");
}

// ─── File System ─────────────────────────────────────────────────────────────

export async function openDirectory(): Promise<string | null> {
  return invoke<string | null>("open_directory");
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  return invoke<void>("write_file", { path, content });
}

export async function listDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { path });
}

export async function createFile(path: string): Promise<void> {
  return invoke<void>("create_file", { path });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke<void>("delete_file", { path });
}

export async function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

export async function revealInFinder(path: string): Promise<void> {
  return invoke<void>("reveal_in_finder", { path });
}

// ─── rulesync ────────────────────────────────────────────────────────────────

export async function runRulesync(
  args: string[],
  cwd: string,
  onOutput: (line: OutputLine) => void,
  onDone: (code: number) => void
): Promise<UnlistenFn> {
  let unlistenOutput: UnlistenFn | null = null;
  let unlistenDone: UnlistenFn | null = null;

  const cleanup = () => {
    unlistenOutput?.();
    unlistenDone?.();
  };

  unlistenOutput = await listen<{ line: string; stderr: boolean }>(
    "rulesync-output",
    (event) => {
      onOutput({
        text: event.payload.line,
        isError: event.payload.stderr,
        ts: Date.now(),
      });
    }
  );

  unlistenDone = await listen<number>("rulesync-done", (event) => {
    onDone(event.payload);
    cleanup();
  });

  invoke<number>("run_rulesync", { args, cwd }).catch((err) => {
    onOutput({ text: `Error: ${String(err)}`, isError: true, ts: Date.now() });
    onDone(-1);
    cleanup();
  });

  return cleanup;
}
