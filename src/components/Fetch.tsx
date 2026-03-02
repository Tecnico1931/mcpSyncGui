import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { runRulesync } from "../lib/tauri";
import { ALL_FEATURES } from "../types";
import type { RulesyncFeatures } from "../types";
import OutputLog from "./OutputLog";

export default function Fetch() {
  const { projectDir, isRunning, setIsRunning, appendOutput, clearOutput } =
    useAppStore();

  const [repo, setRepo] = useState("");
  const [features, setFeatures] = useState<RulesyncFeatures>({
    rules: false,
    ignore: false,
    mcp: false,
    commands: false,
    subagents: false,
    skills: true,
  });

  const toggleFeature = (f: keyof RulesyncFeatures) => {
    setFeatures((prev) => ({ ...prev, [f]: !prev[f] }));
  };

  const handleFetch = async () => {
    if (!projectDir || isRunning || !repo.trim()) return;

    const args: string[] = ["fetch", repo.trim()];

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
            text: "\n✓ Fetch complete",
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
              <h1 className="text-2xl font-bold text-gray-100">Fetch</h1>
              <p className="text-sm text-gray-500 mt-1">
                Fetch skills and rules from a GitHub repository
              </p>
            </div>
            <button
              onClick={handleFetch}
              disabled={isRunning || !projectDir || !repo.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <span>↻</span>
              {isRunning ? "Running…" : "Fetch"}
            </button>
          </div>

          {/* Repo input */}
          <div className="mb-5 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200 mb-2">
              GitHub Repository
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Enter a GitHub repo in{" "}
              <span className="font-mono">owner/repo</span> format
            </p>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder="dyoshikawa/rulesync"
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Features */}
          <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">
              Features to Fetch
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

          {/* Example repos */}
          <div className="mt-5 p-4 bg-gray-900/50 rounded-lg border border-gray-800/50">
            <h3 className="text-xs text-gray-500 font-medium mb-2">
              Example repos
            </h3>
            <div className="space-y-1">
              {["dyoshikawa/rulesync"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRepo(r)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-mono block transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <OutputLog />
    </div>
  );
}
