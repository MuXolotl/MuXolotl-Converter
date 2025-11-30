use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    BinaryNotFound,
    InvalidPath,
    MediaAnalysisFailed,
    ConversionFailed,
    ConversionCancelled,
    ConversionTimeout,
    UnsupportedFormat,
    ValidationFailed,
    IoError,
    Unknown,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }

    pub fn binary_not_found(name: &str) -> Self {
        Self::new(
            ErrorCode::BinaryNotFound,
            format!("Binary '{}' not found", name),
        )
    }

    pub fn invalid_path(path: &str) -> Self {
        Self::new(ErrorCode::InvalidPath, format!("Invalid path: {}", path))
    }

    pub fn unsupported_format(format: &str) -> Self {
        Self::new(
            ErrorCode::UnsupportedFormat,
            format!("Unsupported format: {}", format),
        )
    }

    pub fn conversion_failed(reason: &str) -> Self {
        Self::new(ErrorCode::ConversionFailed, reason)
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:?}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::new(ErrorCode::IoError, err.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        Self::new(ErrorCode::Unknown, err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::new(ErrorCode::ValidationFailed, err.to_string())
    }
}

// For Tauri command returns
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        serde_json::to_string(&err).unwrap_or_else(|_| err.message)
    }
}

pub type AppResult<T> = Result<T, AppError>;