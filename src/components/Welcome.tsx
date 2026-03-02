import { useAppStore } from "../store/useAppStore";
import { openDirectory } from "../lib/tauri";

export default function Welcome() {
  const { recentProjects, setProjectDir } = useAppStore();

  const handleOpen = async () => {
    const dir = await openDirectory();
    if (dir) setProjectDir(dir);
  };

  const handleRecent = (dir: string) => {
    setProjectDir(dir);
  };

  return (
    <div className="h-full bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">⚡</div>
          <h1 className="text-3xl font-bold text-gray-100">rulesync</h1>
          <p className="text-gray-500 mt-2 text-sm">
            AI coding agent configuration manager
          </p>
        </div>

        {/* Open project */}
        <button
          onClick={handleOpen}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-lg">📁</span>
          Open Project Folder
        </button>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
              Recent Projects
            </h2>
            <div className="space-y-1">
              {recentProjects.map((dir) => {
                const name = dir.split("/").pop() ?? dir;
                return (
                  <button
                    key={dir}
                    onClick={() => handleRecent(dir)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors group"
                  >
                    <div className="text-sm text-gray-300 group-hover:text-white font-medium">
                      {name}
                    </div>
                    <div className="text-xs text-gray-600 truncate mt-0.5">
                      {dir}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
