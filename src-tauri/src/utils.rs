use std::path::PathBuf;
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