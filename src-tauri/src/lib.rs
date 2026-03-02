use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter, WebviewWindow};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct OutputEvent {
    pub line: String,
    pub stderr: bool,
}

// ─── Environment helpers ─────────────────────────────────────────────────────

/// Returns the current working directory of the process (set by the OS at launch).
#[tauri::command]
fn get_cwd() -> Option<String> {
    std::env::current_dir()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

/// Returns the user's home directory.
#[tauri::command]
fn get_home_dir() -> Option<String> {
    std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())
}

/// Scans a directory (one level deep) for rulesync.jsonc files.
/// Returns a list of directories that contain rulesync.jsonc.
#[tauri::command]
fn find_rulesync_configs(dir: String) -> Vec<String> {
    let mut results = Vec::new();
    let base = Path::new(&dir);

    // Check the dir itself
    if base.join("rulesync.jsonc").exists() {
        results.push(dir.clone());
    }

    // Check immediate subdirectories
    if let Ok(entries) = fs::read_dir(&dir) {
        let mut subdirs: Vec<_> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .collect();
        subdirs.sort_by_key(|e| e.file_name());
        for entry in subdirs {
            if entry.path().join("rulesync.jsonc").exists() {
                results.push(entry.path().to_string_lossy().to_string());
            }
        }
    }

    results
}

/// Checks for rulesync in the user's PATH.
/// Returns Some(path_string) if found, None otherwise.
#[tauri::command]
fn which_rulesync() -> Option<String> {
    find_rulesync_in_path().map(|p| p.to_string_lossy().to_string())
}

/// Runs `rulesync --version` and returns the trimmed version string.
/// Tries the system PATH binary first, then the bundled sidecar.
#[tauri::command]
async fn get_rulesync_version(app: AppHandle) -> Option<String> {
    use tauri_plugin_shell::ShellExt;
    use tauri_plugin_shell::process::CommandEvent;

    // Try system PATH binary (synchronous — fast)
    if let Some(binary) = find_rulesync_in_path() {
        if let Ok(output) = std::process::Command::new(&binary)
            .arg("--version")
            .output()
        {
            let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !v.is_empty() {
                return Some(v);
            }
        }
    }

    // Fall back to bundled sidecar
    let sidecar = app.shell().sidecar("rulesync").ok()?.args(["--version"]);
    let (mut rx, _child) = sidecar.spawn().ok()?;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                let v = String::from_utf8_lossy(&bytes).trim().to_string();
                if !v.is_empty() {
                    return Some(v);
                }
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }
    None
}

fn find_rulesync_in_path() -> Option<std::path::PathBuf> {
    let name = if cfg!(windows) { "rulesync.exe" } else { "rulesync" };
    std::env::var_os("PATH").and_then(|path_var| {
        std::env::split_paths(&path_var).find_map(|dir| {
            let candidate = dir.join(name);
            candidate.exists().then_some(candidate)
        })
    })
}

// ─── File System Commands ────────────────────────────────────────────────────

#[tauri::command]
fn open_directory(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|p| p.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path = entry.path().to_string_lossy().to_string();

        if file_name.starts_with('.') && file_name != ".rulesync" {
            continue;
        }

        result.push(FileEntry {
            name: file_name,
            path: file_path,
            is_dir: metadata.is_dir(),
        });
    }

    result.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(result)
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn reveal_in_finder(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|e| e.to_string())
}

// ─── rulesync Execution ──────────────────────────────────────────────────────

/// Runs rulesync with the given args in the given working directory.
/// Prefers a system-installed rulesync (from PATH) over the bundled sidecar,
/// so users with a newer version installed get that automatically.
#[tauri::command]
async fn run_rulesync(
    app: AppHandle,
    window: WebviewWindow,
    args: Vec<String>,
    cwd: String,
) -> Result<i32, String> {
    if let Some(path_binary) = find_rulesync_in_path() {
        run_with_process(path_binary, args, cwd, window).await
    } else {
        run_with_sidecar(app, args, cwd, window).await
    }
}

/// Execute rulesync using a binary found in PATH (tokio async process).
async fn run_with_process(
    binary: std::path::PathBuf,
    args: Vec<String>,
    cwd: String,
    window: WebviewWindow,
) -> Result<i32, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command;

    let mut child = Command::new(&binary)
        .args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn rulesync: {e}"))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let w1 = window.clone();
    let out_task = tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            w1.emit("rulesync-output", OutputEvent { line, stderr: false }).ok();
        }
    });

    let w2 = window.clone();
    let err_task = tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            w2.emit("rulesync-output", OutputEvent { line, stderr: true }).ok();
        }
    });

    let status = child.wait().await.map_err(|e| e.to_string())?;
    let _ = out_task.await;
    let _ = err_task.await;

    let code = status.code().unwrap_or(-1);
    window.emit("rulesync-done", code).ok();
    Ok(code)
}

/// Execute rulesync using the bundled Tauri sidecar.
async fn run_with_sidecar(
    app: AppHandle,
    args: Vec<String>,
    cwd: String,
    window: WebviewWindow,
) -> Result<i32, String> {
    use tauri_plugin_shell::ShellExt;
    use tauri_plugin_shell::process::CommandEvent;

    let (mut rx, _child) = app
        .shell()
        .sidecar("rulesync")
        .map_err(|e| e.to_string())?
        .current_dir(cwd.as_str())
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                window
                    .emit("rulesync-output", OutputEvent { line, stderr: false })
                    .ok();
            }
            CommandEvent::Stderr(bytes) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                window
                    .emit("rulesync-output", OutputEvent { line, stderr: true })
                    .ok();
            }
            CommandEvent::Terminated(payload) => {
                let code = payload.code.unwrap_or(-1);
                window.emit("rulesync-done", code).ok();
                return Ok(code);
            }
            _ => {}
        }
    }

    window.emit("rulesync-done", 0i32).ok();
    Ok(0)
}

// ─── App Entry Point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // environment
            get_cwd,
            get_home_dir,
            find_rulesync_configs,
            which_rulesync,
            get_rulesync_version,
            // file system
            open_directory,
            read_file,
            write_file,
            list_directory,
            create_file,
            delete_file,
            path_exists,
            reveal_in_finder,
            // rulesync
            run_rulesync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
