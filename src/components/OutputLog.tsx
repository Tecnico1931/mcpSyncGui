import { useRef, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

// Very basic ANSI escape code stripper / colorizer
function ansiToHtml(text: string): string {
  return text
    .replace(/\u001b\[31m/g, '<span class="ansi-red">')
    .replace(/\u001b\[32m/g, '<span class="ansi-green">')
    .replace(/\u001b\[33m/g, '<span class="ansi-yellow">')
    .replace(/\u001b\[34m/g, '<span class="ansi-blue">')
    .replace(/\u001b\[35m/g, '<span class="ansi-magenta">')
    .replace(/\u001b\[36m/g, '<span class="ansi-cyan">')
    .replace(/\u001b\[1m/g, "<strong>")
    .replace(/\u001b\[0m/g, "</span></strong>")
    .replace(/\u001b\[\d+m/g, "");
}

export default function OutputLog() {
  const { outputLog, isRunning, clearOutput } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputLog]);

  if (outputLog.length === 0 && !isRunning) return null;

  return (
    <div className="border-t border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            Output
          </span>
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
              <span className="animate-pulse">●</span> Running
            </span>
          )}
        </div>
        <button
          onClick={clearOutput}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="h-40 overflow-auto p-3 font-mono text-xs leading-5">
        {outputLog.map((line) => (
          <div
            key={line.ts}
            className={line.isError ? "text-red-400" : "text-gray-300"}
            dangerouslySetInnerHTML={{ __html: ansiToHtml(line.text) }}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
