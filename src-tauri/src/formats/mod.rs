pub mod audio;
pub mod video;

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Popular,
    Standard,
    Specialized,
    Legacy,
    Exotic,
}

impl Category {
    fn priority(&self) -> u8 {
        match self {
            Category::Popular => 0,
            Category::Standard => 1,
            Category::Specialized => 2,
            Category::Legacy => 3,
            Category::Exotic => 4,
        }
    }
}

impl Ord for Category {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority().cmp(&other.priority())
    }
}

impl PartialOrd for Category {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Stability {
    Stable,
    RequiresSetup,
    Experimental,
    Problematic,
}

pub fn sort_formats_by_category<T, F>(formats: &mut [T], get_category: F)
where
    F: Fn(&T) -> &Category,
{
    formats.sort_by(|a, b| get_category(a).cmp(get_category(b)));
}