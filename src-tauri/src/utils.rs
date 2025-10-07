use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Creates a Command with hidden window on Windows
pub fn create_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    cmd
}