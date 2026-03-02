import { useEffect, useState, type ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";
import { pathExists, readFile, writeFile, runRulesync } from "../lib/tauri";
import { ALL_TARGETS, ALL_FEATURES } from "../types";
import type { RulesyncConfig, RulesyncFeatures } from "../types";
import OutputLog from "./OutputLog";

const DEFAULT_CONFIG: RulesyncConfig = {
  targets: ["claudecode"],
  features: {
    rules: true,
    ignore: true,
    mcp: false,
    commands: false,
    subagents: false,
    skills: false,
  },
  baseDirs: [],
  delete: false,
  verbose: false,
  global: false,
};

export default function Config() {
  const { projectDir, setRulesyncConfig, isRunning, setIsRunning, appendOutput, clearOutput } =
    useAppStore();

  const [config, setConfig] = useState<RulesyncConfig>(DEFAULT_CONFIG);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [baseDirInput, setBaseDirInput] = useState("");

  useEffect(() => {
    loadConfig();
  }, [projectDir]);

  const loadConfig = async () => {
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
        const parsed: RulesyncConfig = JSON.parse(clean);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch {
        setConfig(DEFAULT_CONFIG);
      }
    }
  };

  const handleSave = async () => {
    if (!projectDir) return;
    const configPath = `${projectDir}/rulesync.jsonc`;
    const content = JSON.stringify(config, null, 2);
    await writeFile(configPath, content);
    setRulesyncConfig(config);
    setSaved(true);
    setHasConfig(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInit = async () => {
    if (!projectDir || isRunning) return;
    setIsRunning(true);
    clearOutput();

    const cleanup = await runRulesync(
      ["init"],
      projectDir,
      (line) => appendOutput(line),
      (code) => {
        setIsRunning(false);
        if (code === 0) loadConfig();
        cleanup?.();
      }
    );
  };

  const toggleTarget = (target: string) => {
    const targets = config.targets ?? [];
    setConfig({
      ...config,
      targets: targets.includes(target)
        ? targets.filter((t) => t !== target)
        : [...targets, target],
    });
  };

  const toggleFeature = (feat: keyof RulesyncFeatures) => {
    setConfig({
      ...config,
      features: {
        ...config.features,
        [feat]: !config.features?.[feat],
      },
    });
  };

  const addBaseDir = () => {
    if (!baseDirInput.trim()) return;
    setConfig({
      ...config,
      baseDirs: [...(config.baseDirs ?? []), baseDirInput.trim()],
    });
    setBaseDirInput("");
  };

  const removeBaseDir = (dir: string) => {
    setConfig({
      ...config,
      baseDirs: (config.baseDirs ?? []).filter((d) => d !== dir),
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-100">Configuration</h1>
            <div className="flex gap-2">
              {!hasConfig && (
                <button
                  onClick={handleInit}
                  disabled={isRunning}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {isRunning ? "Running…" : "Run Init"}
                </button>
              )}
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saved ? "✓ Saved" : "Save Config"}
              </button>
            </div>
          </div>

          {/* Targets */}
          <Section title="Targets" description="Which AI tools to generate configs for">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setConfig({ ...config, targets: [...ALL_TARGETS] })}
                className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setConfig({ ...config, targets: [] })}
                className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors"
              >
                Deselect All
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_TARGETS.map((target) => (
                <CheckItem
                  key={target}
                  label={target}
                  checked={(config.targets ?? []).includes(target)}
                  onChange={() => toggleTarget(target)}
                />
              ))}
            </div>
          </Section>

          {/* Features */}
          <Section title="Features" description="Which file types to generate">
            <div className="grid grid-cols-3 gap-2">
              {ALL_FEATURES.map((feat) => (
                <CheckItem
                  key={feat}
                  label={feat}
                  checked={config.features?.[feat] ?? false}
                  onChange={() => toggleFeature(feat)}
                />
              ))}
            </div>
          </Section>

          {/* Base Dirs */}
          <Section title="Base Directories" description="Directories to scan for rule files">
            <div className="flex gap-2 mb-3">
              <input
                value={baseDirInput}
                onChange={(e) => setBaseDirInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBaseDir()}
                placeholder="e.g. src/rules"
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={addBaseDir}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
              >
                Add
              </button>
            </div>
            {(config.baseDirs ?? []).length === 0 ? (
              <p className="text-xs text-gray-600">No base directories configured (uses default).</p>
            ) : (
              <div className="space-y-1">
                {(config.baseDirs ?? []).map((dir) => (
                  <div key={dir} className="flex items-center justify-between px-3 py-1.5 bg-gray-900 rounded border border-gray-800">
                    <span className="text-sm text-gray-300 font-mono">{dir}</span>
                    <button
                      onClick={() => removeBaseDir(dir)}
                      className="text-gray-600 hover:text-red-400 text-xs ml-4"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Options */}
          <Section title="Options">
            <div className="space-y-3">
              <ToggleItem
                label="Delete existing configs before generating"
                description="Removes old generated files first"
                checked={config.delete ?? false}
                onChange={(v) => setConfig({ ...config, delete: v })}
              />
              <ToggleItem
                label="Verbose output"
                checked={config.verbose ?? false}
                onChange={(v) => setConfig({ ...config, verbose: v })}
              />
              <ToggleItem
                label="Global mode"
                description="Write to global config locations instead of project"
                checked={config.global ?? false}
                onChange={(v) => setConfig({ ...config, global: v })}
              />
            </div>
          </Section>
        </div>
      </div>

      <OutputLog />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 accent-indigo-500"
      />
      <span
        className={`text-xs font-mono ${
          checked ? "text-gray-200" : "text-gray-500"
        } group-hover:text-gray-300`}
      >
        {label}
      </span>
    </label>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <div className="text-sm text-gray-300">{label}</div>
        {description && (
          <div className="text-xs text-gray-600 mt-0.5">{description}</div>
        )}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors cursor-pointer ${
          checked ? "bg-indigo-600" : "bg-gray-700"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
