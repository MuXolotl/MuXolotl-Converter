use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn create_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd
}

#[cfg(target_os = "windows")]
pub fn create_async_hidden_command(program: &str) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(target_os = "windows"))]
pub fn create_async_hidden_command(program: &str) -> tokio::process::Command {
    tokio::process::Command::new(program)
}

/// Validate that an input file exists and is accessible before conversion.
pub fn validate_input_path(path: &str) -> anyhow::Result<()> {
    let p = Path::new(path);
    if !p.exists() {
        anyhow::bail!("Input file does not exist: {}", path);
    }
    if !p.is_file() {
        anyhow::bail!("Input path is not a file: {}", path);
    }
    Ok(())
}

pub fn open_path(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Open the system file manager and reveal/select the given path.
///
/// - If path points to a **file**: the parent folder is opened with the file selected.
/// - If path points to a **directory**: the directory itself is opened.
///
/// Platform behavior:
/// - **Windows**: `explorer /select,<path>` — highlights the file in Explorer.
/// - **macOS**: `open -R <path>` — reveals the file in Finder.
/// - **Linux**: `xdg-open <parent>` — opens the parent directory (no native select support).
pub fn reveal_in_explorer(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    let is_dir = p.is_dir();

    #[cfg(target_os = "windows")]
    {
        if is_dir {
            Command::new("explorer")
                .arg(path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            // raw_arg passes /select,path as a single undivided token to explorer,
            // which is required because explorer uses ShellExecuteW (not CreateProcess).
            Command::new("explorer")
                .raw_arg(format!("/select,{}", path))
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if is_dir {
            Command::new("open")
                .arg(path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            // -R reveals the file in Finder
            Command::new("open")
                .args(["-R", path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux has no native "reveal and select" API.
        // Fall back to opening the parent directory.
        if is_dir {
            Command::new("xdg-open")
                .arg(path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else if let Some(parent) = p.parent() {
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new("xdg-open")
                .arg(".")
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}