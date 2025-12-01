use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Creates a Command with hidden window on Windows
pub fn create_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd
}

/// Creates a tokio Command with hidden window on Windows
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

/// Normalizes path for cross-platform compatibility
#[allow(dead_code)]
pub fn normalize_path(path: &str) -> PathBuf {
    PathBuf::from(path)
}

/// Validates that a path exists and is a file
#[allow(dead_code)]
pub fn validate_input_path(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Not a file: {}", path.display()));
    }
    Ok(path.to_path_buf())
}

/// Clamps a value to supported range
#[allow(dead_code)]
pub fn clamp_to_supported<T: Ord + Copy>(value: T, supported: &[T], default: T) -> T {
    if supported.contains(&value) {
        value
    } else {
        supported
            .iter()
            .find(|&&v| v == default)
            .copied()
            .or_else(|| supported.first().copied())
            .unwrap_or(default)
    }
}

/// Opens a folder or URL in the system default handler
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