import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { runRulesync } from "../lib/tauri";
import { ALL_FEATURES } from "../types";
import type { RulesyncFeatures } from "../types";
import OutputLog from "./OutputLog";

const IMPORT_SOURCES = ["claudecode", "cursor", "copilot"] as const;
type ImportSource = (typeof IMPORT_SOURCES)[number];

export default function Import() {
  const { projectDir, isRunning, setIsRunning, appendOutput, clearOutput } =
    useAppStore();

  const [source, setSource] = useState<ImportSource>("claudecode");
  const [features, setFeatures] = useState<RulesyncFeatures>({
    rules: true,
    ignore: false,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  });

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
          appendOutput({
            text: `\nProcess exited with code ${code}`,
            isError: true,
            ts: Date.now(),
          });
        } else {
          appendOutput({
            text: "\n✓ Import complete",
            isError: false,
            ts: Date.now(),
          });
        }
        cleanup?.();
      }
    );
  };

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

          {/* Source selector */}
          <div className="mb-5 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">
              Source Tool
            </h2>
            <div className="flex gap-3">
              {IMPORT_SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    source === s
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-3">
              {source === "claudecode" &&
                "Imports from CLAUDE.md and .claude/ directory"}
              {source === "cursor" &&
                "Imports from .cursorrules and .cursor/rules/"}
              {source === "copilot" &&
                "Imports from .github/copilot-instructions.md"}
            </p>
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
