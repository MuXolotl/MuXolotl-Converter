use std::path::PathBuf;

pub fn normalize_path(path: &str) -> String {
    PathBuf::from(path).to_str().unwrap_or(path).to_string()
}

pub fn get_sample_rate(requested: u32, supported: &[u32], recommended: u32) -> u32 {
    if supported.contains(&requested) {
        requested
    } else {
        #[cfg(debug_assertions)]
        println!("⚠️ Sample rate {}Hz not supported, using {}Hz", requested, recommended);
        recommended
    }
}

pub fn get_channels(requested: u32, supported: &[u32]) -> u32 {
    if supported.contains(&requested) {
        requested
    } else {
        let fallback = supported.iter().find(|&&ch| ch == 2)
            .or_else(|| supported.first())
            .copied()
            .unwrap_or(2);
        
        #[cfg(debug_assertions)]
        println!("⚠️ {} channels not supported, using {} channels", requested, fallback);
        fallback
    }
}