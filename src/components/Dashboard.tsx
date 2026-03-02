import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  pathExists,
  readFile,
  listDirectory,
  revealInFinder,
  runRulesync,
  whichRulesync,
} from "../lib/tauri";
import type { RulesyncConfig } from "../types";

export default function Dashboard() {
  const {
    projectDir,
    setSection,
    setRulesyncConfig,
    isRunning,
    setIsRunning,
    appendOutput,
    clearOutput,
  } = useAppStore();

  const [fileCount, setFileCount] = useState(0);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<RulesyncConfig | null>(null);
  const [rulesyncSource, setRulesyncSource] = useState<string>("bundled");
  const autoInitDone = useRef(false);

  useEffect(() => {
    autoInitDone.current = false;
    loadStatus();
    checkRulesyncSource();
  }, [projectDir]);

  const checkRulesyncSource = async () => {
    const systemPath = await whichRulesync();
    setRulesyncSource(systemPath ? `system (${systemPath})` : "bundled sidecar");
  };

  const loadStatus = async () => {
    if (!projectDir) return;

    const configPath = `${projectDir}/rulesync.jsonc`;
    const exists = await pathExists(configPath);
    setHasConfig(exists);

    if (exists) {
      try {
        const raw = await readFile(configPath);
        const clean = raw
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        const config: RulesyncConfig = JSON.parse(clean);
        setCfg(config);
        setRulesyncConfig(config);
      } catch {
        setCfg(null);
        setRulesyncConfig(null);
      }
    } else {
      setCfg(null);
      setRulesyncConfig(null);
      // Auto-init if we haven't done it yet this session
      if (!autoInitDone.current && !isRunning) {
        autoInitDone.current = true;
        runInit(true);
      }
    }

    // Count .md files in .rulesync/
    const rulesyncDir = `${projectDir}/.rulesync`;
    if (await pathExists(rulesyncDir)) {
      try {
        let count = 0;
        const countMd = async (
          entries: Awaited<ReturnType<typeof listDirectory>>
        ) => {
          for (const e of entries) {
            if (e.is_dir) await countMd(await listDirectory(e.path));
            else if (e.name.endsWith(".md")) count++;
          }
        };
        await countMd(await listDirectory(rulesyncDir));
        setFileCount(count);
      } catch {
        setFileCount(0);
      }
    } else {
      setFileCount(0);
    }
  };

  const runInit = async (silent = false) => {
    if (!projectDir || isRunning) return;
    setIsRunning(true);
    if (!silent) clearOutput();

    const cleanup = await runRulesync(
      ["init"],
      projectDir,
      (line) => appendOutput(line),
      (code) => {
        setIsRunning(false);
        if (code === 0) loadStatus();
        cleanup?.();
      }
    );
  };

  const handleGenerateAll = async () => {
    if (!projectDir || isRunning) return;
    setIsRunning(true);
    clearOutput();

    const cleanup = await runRulesync(
      ["generate"],
      projectDir,
      (line) => appendOutput(line),
      (code) => {
        setIsRunning(false);
        if (code !== 0)
          appendOutput({
            text: `\nExited with code ${code}`,
            isError: true,
            ts: Date.now(),
          });
        cleanup?.();
      }
    );
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono truncate" title={projectDir ?? ""}>
            {projectDir}
          </p>
        </div>

        {/* rulesync source badge */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-gray-600">rulesync:</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
            {rulesyncSource}
          </span>
        </div>

        {/* Config status */}
        <div
          className={`mb-6 p-4 rounded-lg border ${
            hasConfig === null
              ? "bg-gray-900 border-gray-800"
              : hasConfig
              ? "bg-green-950/30 border-green-800"
              : "bg-yellow-950/30 border-yellow-800"
          }`}
        >
          {hasConfig === null ? (
            <span className="text-gray-500 text-sm animate-pulse">
              {isRunning ? "Running rulesync init…" : "Checking…"}
            </span>
          ) : hasConfig ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-lg">✓</span>
              <span className="text-green-300 text-sm font-medium">
                rulesync.jsonc found
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-lg animate-spin inline-block">
                  {isRunning ? "↻" : "⚠"}
                </span>
                <span className="text-yellow-300 text-sm font-medium">
                  {isRunning
                    ? "Initializing rulesync…"
                    : "No rulesync.jsonc — re-running init"}
                </span>
              </div>
              {!isRunning && (
                <button
                  onClick={() => runInit(false)}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded transition-colors"
                >
                  Retry Init
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Targets"
            value={cfg?.targets?.length ?? (hasConfig ? "all" : "—")}
            icon="🎯"
          />
          <StatCard
            label="Features"
            value={
              cfg?.features
                ? Object.values(cfg.features).filter(Boolean).length
                : hasConfig
                ? "all"
                : "—"
            }
            icon="✦"
          />
          <StatCard label="Rule Files" value={fileCount} icon="📄" />
        </div>

        {/* Config summary */}
        {cfg && (
          <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">
              Configuration
            </h2>
            <div className="space-y-2 text-sm">
              {cfg.targets && cfg.targets.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <span className="text-gray-500 w-20 flex-shrink-0">Targets:</span>
                  <div className="flex flex-wrap gap-1">
                    {cfg.targets.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cfg.features && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 flex-shrink-0">Features:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(cfg.features)
                      .filter(([, v]) => v)
                      .map(([k]) => (
                        <span
                          key={k}
                          className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs"
                        >
                          {k}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGenerateAll}
            disabled={isRunning || !hasConfig}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-lg transition-colors"
          >
            <span>⚡</span>
            {isRunning ? "Running…" : "Generate All"}
          </button>
          <button
            onClick={() => projectDir && revealInFinder(projectDir)}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
          >
            <span>📂</span>
            Open in Finder
          </button>
          <button
            onClick={() => setSection("rules")}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
          >
            <span>✎</span>
            Edit Rules
          </button>
          <button
            onClick={() => setSection("config")}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
          >
            <span>⚙</span>
            Edit Config
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-100">{value}</div>
    </div>
  );
}
