import { useEffect, useState } from "react";
import { useAppStore } from "./store/useAppStore";
import Layout from "./components/Layout";
import { getCwd, getHomeDir, findRulesyncConfigs, pathExists } from "./lib/tauri";

export default function App() {
  const { setProjectDir, recentProjects } = useAppStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    autoDetectProject();
  }, []);

  /**
   * Startup detection order:
   * 1. Last remembered project (persisted in localStorage) — reopen silently
   * 2. CWD at launch (set by OS; useful when `cargo tauri dev` or terminal launch)
   *    — use if it contains a rulesync.jsonc or looks like a real project
   * 3. Scan CWD subdirs for rulesync.jsonc
   * 4. Fall back to home directory
   *
   * Dashboard handles auto-init if rulesync.jsonc is missing in chosen dir.
   */
  const autoDetectProject = async () => {
    // 1. Last remembered project
    if (recentProjects.length > 0) {
      const last = recentProjects[0];
      const exists = await pathExists(last);
      if (exists) {
        setProjectDir(last);
        setReady(true);
        return;
      }
    }

    // 2. CWD — skip trivial dirs like / or /tmp
    const cwd = await getCwd();
    if (cwd && !["", "/", "/tmp", "/private/tmp"].includes(cwd)) {
      // Prefer it if it already has rulesync.jsonc
      if (await pathExists(`${cwd}/rulesync.jsonc`)) {
        setProjectDir(cwd);
        setReady(true);
        return;
      }

      // 3. Scan CWD subdirs for rulesync.jsonc files
      const configs = await findRulesyncConfigs(cwd);
      if (configs.length > 0) {
        setProjectDir(configs[0]);
        setReady(true);
        return;
      }

      // CWD is still useful even without rulesync.jsonc — Dashboard will auto-init
      if (cwd !== "/") {
        setProjectDir(cwd);
        setReady(true);
        return;
      }
    }

    // 4. Home directory fallback
    const home = await getHomeDir();
    setProjectDir(home ?? "/");
    setReady(true);
  };

  if (!ready) {
    return (
      <div className="h-full bg-gray-950 flex items-center justify-center">
        <div className="text-gray-600 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  return <Layout />;
}
