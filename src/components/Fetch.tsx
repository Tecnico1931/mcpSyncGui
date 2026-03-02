import { useState, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { runRulesync } from "../lib/tauri";
import { ALL_FEATURES } from "../types";
import type { RulesyncFeatures } from "../types";
import OutputLog from "./OutputLog";

const TARGETS = [
  "rulesync",
  "claudecode",
  "cursor",
  "copilot",
  "codexcli",
  "geminicli",
];

const EXAMPLE_REPOS: { repo: string; path?: string; ref?: string; label: string }[] = [
  { repo: "dyoshikawa/rulesync", label: "dyoshikawa/rulesync" },
];

export default function Fetch() {
  const { projectDir, isRunning, setIsRunning, appendOutput, clearOutput } =
    useAppStore();

  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [path, setPath] = useState("");
  const [target, setTarget] = useState("rulesync");
  const [features, setFeatures] = useState<RulesyncFeatures>({
    rules: false,
    ignore: false,
    mcp: false,
    commands: false,
    subagents: false,
    skills: true,
  });
  const [noFilesWarning, setNoFilesWarning] = useState(false);
  const outputRef = useRef<string[]>([]);

  const toggleFeature = (f: keyof RulesyncFeatures) => {
    setFeatures((prev) => ({ ...prev, [f]: !prev[f] }));
  };

  const handleFetch = async () => {
    if (!projectDir || isRunning || !repo.trim()) return;

    const args: string[] = ["fetch", repo.trim()];
    if (ref.trim()) args.push("--ref", ref.trim());
    if (path.trim()) args.push("--path", path.trim());
    if (target !== "rulesync") args.push("--target", target);

    const activeFeatures = ALL_FEATURES.filter((f) => features[f]);
    if (activeFeatures.length > 0) {
      args.push("--features", activeFeatures.join(","));
    }

    setIsRunning(true);
    setNoFilesWarning(false);
    outputRef.current = [];
    clearOutput();

    const cleanup = await runRulesync(
      args,
      projectDir,
      (line) => {
        outputRef.current.push(line.text);
        appendOutput(line);
      },
      (code) => {
        setIsRunning(false);
        // Detect "no files" outcome from rulesync output
        const allOutput = outputRef.current.join("\n");
        if (
          allOutput.includes("No files were fetched") ||
          allOutput.includes("no files")
        ) {
          setNoFilesWarning(true);
        }
        if (code !== 0) {
          appendOutput({
            text: `\nProcess exited with code ${code}`,
            isError: true,
            ts: Date.now(),
          });
        }
        cleanup?.();
      }
    );
  };

  const applyExample = (ex: typeof EXAMPLE_REPOS[0]) => {
    setRepo(ex.repo);
    if (ex.path) setPath(ex.path);
    if (ex.ref) setRef(ex.ref);
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

          {/* Repo + options */}
          <div className="mb-5 p-4 bg-gray-900 rounded-lg border border-gray-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                GitHub Repository <span className="text-gray-600 font-normal font-mono">owner/repo</span>
              </label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="dyoshikawa/rulesync"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Branch / Tag / Commit <span className="text-gray-600 font-normal">optional</span>
                </label>
                <input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Subdirectory Path <span className="text-gray-600 font-normal">optional</span>
                </label>
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="e.g. skills/ or src/rules"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Interpret files as
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-300 font-mono focus:outline-none focus:border-indigo-500"
              >
                {TARGETS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Features */}
          <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 mb-5">
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

          {/* "No files" tip */}
          {noFilesWarning && (
            <div className="mb-5 p-4 bg-yellow-950/40 border border-yellow-800 rounded-lg text-xs text-yellow-300 space-y-2">
              <div className="font-semibold">No files were fetched</div>
              <p className="text-yellow-400/80">
                rulesync looks for feature directories (<span className="font-mono">rules/</span>,{" "}
                <span className="font-mono">skills/</span>, etc.) at the root of the repo (or the
                subdirectory you specify). Try:
              </p>
              <ul className="list-disc list-inside space-y-1 text-yellow-400/70">
                <li>Set <span className="font-mono">Subdirectory Path</span> to the folder that contains the rule files</li>
                <li>Check the correct branch under <span className="font-mono">Branch / Tag</span></li>
                <li>
                  Change <span className="font-mono">Interpret files as</span> to match the
                  source format (e.g. <span className="font-mono">claudecode</span> for{" "}
                  <span className="font-mono">CLAUDE.md</span> files)
                </li>
              </ul>
            </div>
          )}

          {/* Example repos */}
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800/50">
            <h3 className="text-xs text-gray-500 font-medium mb-2">Example repos</h3>
            <div className="space-y-1">
              {EXAMPLE_REPOS.map((ex) => (
                <button
                  key={ex.repo + (ex.path ?? "")}
                  onClick={() => applyExample(ex)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-mono block transition-colors"
                >
                  {ex.label}
                  {ex.path && (
                    <span className="text-gray-600 ml-1">path: {ex.path}</span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-600 leading-relaxed">
              The repo must contain feature directories (<span className="font-mono text-gray-500">rules/</span>,{" "}
              <span className="font-mono text-gray-500">skills/</span>, etc.) at
              its root or at the specified subdirectory path.
            </p>
          </div>
        </div>
      </div>

      <OutputLog />
    </div>
  );
}
