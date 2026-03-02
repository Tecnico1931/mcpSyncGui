import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { runRulesync } from "../lib/tauri";
import { ALL_TARGETS, ALL_FEATURES } from "../types";
import type { RulesyncFeatures } from "../types";
import OutputLog from "./OutputLog";

export default function Generate() {
  const { projectDir, isRunning, setIsRunning, appendOutput, clearOutput } =
    useAppStore();

  const [selectedTargets, setSelectedTargets] = useState<string[]>([...ALL_TARGETS]);
  const [features, setFeatures] = useState<RulesyncFeatures>({
    rules: true,
    ignore: true,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  });
  const [globalMode, setGlobalMode] = useState(false);
  const [simulateCommands, setSimulateCommands] = useState(false);

  const toggleTarget = (t: string) => {
    setSelectedTargets((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const toggleFeature = (f: keyof RulesyncFeatures) => {
    setFeatures((prev) => ({ ...prev, [f]: !prev[f] }));
  };

  const handleGenerate = async () => {
    if (!projectDir || isRunning) return;

    const args: string[] = ["generate"];

    if (selectedTargets.length > 0 && selectedTargets.length < ALL_TARGETS.length) {
      args.push("--targets", selectedTargets.join(","));
    }

    const activeFeatures = ALL_FEATURES.filter((f) => features[f]);
    if (activeFeatures.length > 0 && activeFeatures.length < ALL_FEATURES.length) {
      args.push("--features", activeFeatures.join(","));
    }

    if (globalMode) args.push("--global");
    if (simulateCommands) args.push("--experimental-simulate-commands");

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
            text: "\n✓ Generation complete",
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
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-100">Generate</h1>
            <button
              onClick={handleGenerate}
              disabled={isRunning || !projectDir || selectedTargets.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <span>⚡</span>
              {isRunning ? "Running…" : "Generate"}
            </button>
          </div>

          {/* Targets */}
          <div className="mb-5 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-200">Targets</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTargets([...ALL_TARGETS])}
                  className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedTargets([])}
                  className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ALL_TARGETS.map((target) => (
                <label
                  key={target}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(target)}
                    onChange={() => toggleTarget(target)}
                    className="w-3.5 h-3.5 accent-indigo-500"
                  />
                  <span
                    className={`text-xs font-mono ${
                      selectedTargets.includes(target)
                        ? "text-gray-200"
                        : "text-gray-600"
                    } group-hover:text-gray-300`}
                  >
                    {target}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="mb-5 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">
              Features
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

          {/* Options */}
          <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">
              Options
            </h2>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalMode}
                  onChange={(e) => setGlobalMode(e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-500"
                />
                <span className="text-sm text-gray-400">
                  --global (write to global config locations)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateCommands}
                  onChange={(e) => setSimulateCommands(e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-500"
                />
                <span className="text-sm text-gray-400">
                  --experimental-simulate-commands
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <OutputLog />
    </div>
  );
}
