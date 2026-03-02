import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { runRulesync, pathExists } from "../lib/tauri";
import { ALL_FEATURES, ALL_TARGETS } from "../types";
import type { RulesyncFeatures } from "../types";
import OutputLog from "./OutputLog";

// Known config file paths for each tool (for auto-detection)
const TOOL_CONFIG_PATHS: Record<string, string[]> = {
  claudecode:       ["CLAUDE.md", ".claude/"],
  "claudecode-legacy": ["CLAUDE.md"],
  cursor:           [".cursorrules", ".cursor/rules/"],
  copilot:          [".github/copilot-instructions.md"],
  cline:            [".clinerules"],
  windsurf:         [".windsurfrules"],
  roo:              [".roo-rules"],
  codexcli:         ["AGENTS.md"],
  geminicli:        ["GEMINI.md"],
  goose:            [".goosehints"],
  zed:              [".zed/"],
  kiro:             [".kiro/"],
  opencode:         [".opencode/"],
  warp:             [".warp/"],
};

export default function Import() {
  const { projectDir, isRunning, setIsRunning, appendOutput, clearOutput } =
    useAppStore();

  const [source, setSource] = useState<string>("claudecode");
  const [detectedTools, setDetectedTools] = useState<Set<string>>(new Set());
  const [features, setFeatures] = useState<RulesyncFeatures>({
    rules: true,
    ignore: false,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
    hooks: false,
  });

  // Auto-detect tools that have existing config files in the project
  useEffect(() => {
    if (!projectDir) return;
    detectTools();
  }, [projectDir]);

  const detectTools = async () => {
    const found = new Set<string>();
    for (const [tool, paths] of Object.entries(TOOL_CONFIG_PATHS)) {
      for (const p of paths) {
        if (await pathExists(`${projectDir}/${p}`)) {
          found.add(tool);
          break;
        }
      }
    }
    setDetectedTools(found);
    // Auto-select first detected tool if any
    if (found.size > 0) {
      const first = ALL_TARGETS.find((t) => found.has(t));
      if (first) setSource(first);
    }
  };

  const toggleFeature = (f: keyof RulesyncFeatures) => {
    setFeatures((prev) => ({ ...prev, [f]: !prev[f] }));
  };

  const handleImport = async () => {
    if (!projectDir || isRunning) return;

    const args: string[] = ["import", "--targets", source];
    const activeFeatures = ALL_FEATURES.filter((f) => features[f]);
    if (activeFeatures.length > 0) {
      args.push("--features", activeFeatures.join(","));
    }

    setIsRunning(true);
    clearOutput();

    const cleanup = await runRulesync(
      args,
      projectDir,
      (line) => appendOutput(line),
      (code) => {
        setIsRunning(false);
        if (code !== 0) {
          appendOutput({ text: `\nProcess exited with code ${code}`, isError: true, ts: Date.now() });
        } else {
          appendOutput({ text: "\n✓ Import complete", isError: false, ts: Date.now() });
        }
        cleanup?.();
      }
    );
  };

  // Sort: detected first, then alphabetical
  const sortedTargets = [...ALL_TARGETS].sort((a, b) => {
    const aDetected = detectedTools.has(a);
    const bDetected = detectedTools.has(b);
    if (aDetected && !bDetected) return -1;
    if (!aDetected && bDetected) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Import</h1>
              <p className="text-sm text-gray-500 mt-1">
                Import existing config files into .rulesync/
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={isRunning || !projectDir}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <span>↓</span>
              {isRunning ? "Running…" : "Import"}
            </button>
          </div>

          {/* Detected banner */}
          {detectedTools.size > 0 && (
            <div className="mb-4 px-3 py-2 bg-green-950/30 border border-green-800 rounded-lg text-xs text-green-400 flex items-center gap-2">
              <span>✓</span>
              <span>
                Detected {detectedTools.size} tool{detectedTools.size !== 1 ? "s" : ""} in this
                project:{" "}
                <span className="font-mono">
                  {[...detectedTools].join(", ")}
                </span>
              </span>
            </div>
          )}

          {/* Source selector */}
          <div className="mb-5 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">
              Source Tool
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {sortedTargets.map((t) => {
                const detected = detectedTools.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => setSource(t)}
                    className={`relative px-2 py-1.5 rounded text-xs font-mono text-left transition-colors ${
                      source === t
                        ? "bg-indigo-600 text-white"
                        : detected
                        ? "bg-green-950/40 border border-green-800/60 text-green-300 hover:bg-green-900/40"
                        : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {t}
                    {detected && source !== t && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                  </button>
                );
              })}
            </div>
            {TOOL_CONFIG_PATHS[source] && (
              <p className="text-xs text-gray-600 mt-3">
                Imports from:{" "}
                <span className="font-mono text-gray-500">
                  {TOOL_CONFIG_PATHS[source].join(", ")}
                </span>
                {detectedTools.has(source) ? (
                  <span className="text-green-600 ml-2">✓ detected</span>
                ) : (
                  <span className="text-gray-700 ml-2">not detected in project</span>
                )}
              </p>
            )}
          </div>

          {/* Features */}
          <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">
              Features to Import
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {ALL_FEATURES.map((feat) => (
                <label
                  key={feat}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={features[feat] ?? false}
                    onChange={() => toggleFeature(feat)}
                    className="w-3.5 h-3.5 accent-indigo-500"
                  />
                  <span
                    className={`text-xs font-mono ${
                      features[feat] ? "text-gray-200" : "text-gray-600"
                    } group-hover:text-gray-300`}
                  >
                    {feat}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <OutputLog />
    </div>
  );
}
