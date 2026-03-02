import { useEffect, useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import matter from "gray-matter";
import { useAppStore } from "../store/useAppStore";
import {
  listDirectory,
  readFile,
  writeFile,
  createFile,
  deleteFile,
  pathExists,
  runRulesync,
} from "../lib/tauri";
import { ALL_TARGETS } from "../types";
import type { FileEntry } from "../types";

// All subdirectories rulesync uses
const RULESYNC_SUBDIRS = ["rules", "commands", "subagents", "skills", "mcp"];

interface FrontmatterData {
  targets?: string[];
  description?: string;
  globs?: string[];
  root?: boolean;
}

interface FileNode {
  entry: FileEntry;
  children?: FileNode[];
}

function isJsonFile(path: string) {
  return path.endsWith(".json") || path.endsWith(".jsonc");
}

export default function RulesEditor() {
  const {
    projectDir,
    selectedFile,
    setSelectedFile,
    isRunning,
    setIsRunning,
    appendOutput,
    clearOutput,
  } = useAppStore();

  const [tree, setTree] = useState<FileNode[]>([]);
  const [frontmatter, setFrontmatter] = useState<FrontmatterData>({});
  const [body, setBody] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileDir, setNewFileDir] = useState("rules");

  useEffect(() => {
    refreshTree();
  }, [projectDir]);

  useEffect(() => {
    if (selectedFile) loadFile(selectedFile);
  }, [selectedFile]);

  // Cmd+S / Ctrl+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty, frontmatter, body, selectedFile]);

  const refreshTree = async () => {
    if (!projectDir) return;
    const rulesyncDir = `${projectDir}/.rulesync`;
    const exists = await pathExists(rulesyncDir);
    if (!exists) {
      setTree([]);
      return;
    }

    const nodes: FileNode[] = [];
    try {
      const entries = await listDirectory(rulesyncDir);
      for (const entry of entries) {
        if (entry.is_dir && RULESYNC_SUBDIRS.includes(entry.name)) {
          const children = await listDirectory(entry.path);
          nodes.push({
            entry,
            children: children
              .filter((c) => !c.is_dir && (c.name.endsWith(".md") || isJsonFile(c.name)))
              .map((c) => ({ entry: c })),
          });
        } else if (!entry.is_dir && (entry.name.endsWith(".md") || isJsonFile(entry.name))) {
          // Root-level files: mcp.json, hooks.json, .aiignore, etc.
          nodes.push({ entry });
        }
      }
      setTree(nodes);
    } catch {
      setTree([]);
    }
  };

  const loadFile = async (path: string) => {
    try {
      const raw = await readFile(path);
      if (isJsonFile(path)) {
        // JSON files: show raw content, no frontmatter
        setBody(raw);
        setFrontmatter({});
      } else {
        const parsed = matter(raw);
        setFrontmatter((parsed.data as FrontmatterData) ?? {});
        setBody(parsed.content);
      }
      setIsDirty(false);
    } catch {
      setBody("");
      setFrontmatter({});
    }
  };

  const handleSave = useCallback(async () => {
    if (!selectedFile) return;
    let content: string;
    if (isJsonFile(selectedFile)) {
      content = body;
    } else {
      const fm: Record<string, unknown> = {};
      if (frontmatter.targets?.length) fm.targets = frontmatter.targets;
      if (frontmatter.description) fm.description = frontmatter.description;
      if (frontmatter.globs?.length) fm.globs = frontmatter.globs;
      if (frontmatter.root !== undefined) fm.root = frontmatter.root;
      content = matter.stringify(body, fm);
    }
    await writeFile(selectedFile, content);
    setIsDirty(false);
  }, [selectedFile, frontmatter, body]);

  const handleSync = async () => {
    if (!projectDir || isRunning) return;
    setIsRunning(true);
    clearOutput();
    const cleanup = await runRulesync(
      ["generate"],
      projectDir,
      (line) => appendOutput(line),
      (code) => {
        setIsRunning(false);
        if (code !== 0) {
          appendOutput({ text: `\nExited with code ${code}`, isError: true, ts: Date.now() });
        }
        cleanup?.();
      }
    );
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    setIsDirty(true);
  };

  const handleFmChange = (update: Partial<FrontmatterData>) => {
    setFrontmatter((prev) => ({ ...prev, ...update }));
    setIsDirty(true);
  };

  const handleCreateFile = async () => {
    if (!projectDir || !newFileName.trim()) return;
    const fileName = newFileName.endsWith(".md") || isJsonFile(newFileName)
      ? newFileName
      : `${newFileName}.md`;
    const filePath = `${projectDir}/.rulesync/${newFileDir}/${fileName}`;
    await createFile(filePath);
    setShowNewFile(false);
    setNewFileName("");
    await refreshTree();
    setSelectedFile(filePath);
  };

  const handleDeleteFile = async (path: string) => {
    if (!confirm(`Delete ${path.split("/").pop()}?`)) return;
    await deleteFile(path);
    if (selectedFile === path) {
      setSelectedFile(null);
      setBody("");
      setFrontmatter({});
    }
    await refreshTree();
  };

  const toggleTarget = (target: string) => {
    const current = frontmatter.targets ?? [];
    handleFmChange({
      targets: current.includes(target)
        ? current.filter((t) => t !== target)
        : [...current, target],
    });
  };

  const addGlob = (glob: string) => {
    if (!glob.trim()) return;
    handleFmChange({ globs: [...(frontmatter.globs ?? []), glob.trim()] });
  };

  const removeGlob = (glob: string) => {
    handleFmChange({ globs: (frontmatter.globs ?? []).filter((g) => g !== glob) });
  };

  const isJson = selectedFile ? isJsonFile(selectedFile) : false;

  return (
    <div className="h-full flex flex-col">
      <div className="h-full flex">
        {/* File tree */}
        <div className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              .rulesync/
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setShowNewFile(true)}
                className="text-gray-500 hover:text-gray-200 text-sm"
                title="New file"
              >
                +
              </button>
              <button
                onClick={refreshTree}
                className="text-gray-500 hover:text-gray-200 text-xs"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>

          {/* New file form */}
          {showNewFile && (
            <div className="p-2 border-b border-gray-800 bg-gray-950">
              <select
                value={newFileDir}
                onChange={(e) => setNewFileDir(e.target.value)}
                className="w-full mb-1.5 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300"
              >
                {RULESYNC_SUBDIRS.map((d) => (
                  <option key={d} value={d}>
                    {d}/
                  </option>
                ))}
              </select>
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFile();
                  if (e.key === "Escape") setShowNewFile(false);
                }}
                placeholder="filename.md"
                className="w-full px-2 py-1 bg-gray-800 border border-indigo-600 rounded text-xs text-gray-100 placeholder-gray-600 focus:outline-none"
              />
              <div className="flex gap-1 mt-1.5">
                <button
                  onClick={handleCreateFile}
                  className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewFile(false)}
                  className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tree */}
          <div className="flex-1 overflow-auto py-1">
            {tree.length === 0 ? (
              <p className="text-xs text-gray-600 px-3 py-4 text-center">
                No .rulesync/ directory found.
                <br />
                Run init first.
              </p>
            ) : (
              tree.map((node) => (
                <FileTreeNode
                  key={node.entry.path}
                  node={node}
                  selectedFile={selectedFile}
                  onSelect={setSelectedFile}
                  onDelete={handleDeleteFile}
                />
              ))
            )}
          </div>

          {/* Sync button */}
          <div className="p-2 border-t border-gray-800">
            <button
              onClick={handleSync}
              disabled={isRunning}
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
            >
              <span>⚡</span>
              {isRunning ? "Generating…" : "Sync (Generate)"}
            </button>
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedFile ? (
            <>
              {/* File header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
                <span className="text-sm text-gray-400 truncate font-mono">
                  {selectedFile.replace(projectDir + "/", "")}
                </span>
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs rounded transition-colors"
                >
                  {isDirty ? "Save (⌘S)" : "Saved"}
                </button>
              </div>

              {/* Frontmatter form — only for markdown files */}
              {!isJson && (
                <div className="p-4 border-b border-gray-800 bg-gray-900/50 space-y-3">
                  {/* Description */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <input
                      value={frontmatter.description ?? ""}
                      onChange={(e) => handleFmChange({ description: e.target.value })}
                      placeholder="Rule description…"
                      className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Targets */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Targets <span className="text-gray-600">(empty = all)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_TARGETS.map((t) => (
                        <button
                          key={t}
                          onClick={() => toggleTarget(t)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            (frontmatter.targets ?? []).includes(t)
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-800 text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Globs + root */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Globs</label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(frontmatter.globs ?? []).map((g) => (
                          <span
                            key={g}
                            className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs"
                          >
                            {g}
                            <button
                              onClick={() => removeGlob(g)}
                              className="text-gray-600 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      <GlobInput onAdd={addGlob} />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={frontmatter.root ?? false}
                          onChange={(e) => handleFmChange({ root: e.target.checked })}
                          className="accent-indigo-500"
                        />
                        <span className="text-xs text-gray-500">root</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* CodeMirror body */}
              <div className="flex-1 overflow-auto">
                <CodeMirror
                  value={body}
                  height="100%"
                  theme={oneDark}
                  extensions={isJson ? [json()] : [markdown()]}
                  onChange={handleBodyChange}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                    highlightActiveLine: true,
                    autocompletion: false,
                  }}
                  style={{ height: "100%", fontSize: "13px" }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <div className="text-4xl mb-3">✎</div>
                <p className="text-sm">Select a file to edit</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  selectedFile,
  onSelect,
  onDelete,
}: {
  node: FileNode;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.entry.is_dir) {
    return (
      <div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <span>{expanded ? "▾" : "▸"}</span>
          <span className="font-medium">{node.entry.name}/</span>
        </button>
        {expanded && node.children && (
          <div className="pl-3">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.entry.path}
                node={child}
                selectedFile={selectedFile}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
            {node.children.length === 0 && (
              <p className="text-xs text-gray-700 pl-3 py-1">empty</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 cursor-pointer group ${
        selectedFile === node.entry.path
          ? "bg-indigo-950 text-indigo-300"
          : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
      }`}
      onClick={() => onSelect(node.entry.path)}
    >
      <span className="text-xs truncate">{node.entry.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.entry.path);
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 text-xs ml-2 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

function GlobInput({ onAdd }: { onAdd: (glob: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
        placeholder="*.ts"
        className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />
      <button
        onClick={() => {
          if (value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs rounded"
      >
        Add
      </button>
    </div>
  );
}
