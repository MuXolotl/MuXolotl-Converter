pub mod audio;
pub mod video;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Popular,
    Standard,
    Specialized,
    Legacy,
    Exotic,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Stability {
    Stable,
    RequiresSetup,
    Experimental,
    Problematic,
}

pub fn sort_by_category<T>(formats: &mut Vec<T>, get_category: impl Fn(&T) -> &Category) {
    formats.sort_by(|a, b| {
        use Category::*;
        let cat_a = get_category(a);
        let cat_b = get_category(b);
        
        match (cat_a, cat_b) {
            (Popular, Popular) => std::cmp::Ordering::Equal,
            (Popular, _) => std::cmp::Ordering::Less,
            (_, Popular) => std::cmp::Ordering::Greater,
            (Standard, Standard) => std::cmp::Ordering::Equal,
            (Standard, _) => std::cmp::Ordering::Less,
            (_, Standard) => std::cmp::Ordering::Greater,
            (Specialized, Specialized) => std::cmp::Ordering::Equal,
            (Specialized, _) => std::cmp::Ordering::Less,
            (_, Specialized) => std::cmp::Ordering::Greater,
            (Legacy, Legacy) => std::cmp::Ordering::Equal,
            (Legacy, _) => std::cmp::Ordering::Less,
            (_, Legacy) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        }
    });
}