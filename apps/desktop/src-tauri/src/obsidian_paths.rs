use std::path::{Path, PathBuf};

pub(crate) const DEFAULT_OBSIDIAN_INBOX_FILE: &str = "Mindwtr/Inbox.md";

pub(crate) fn default_obsidian_inbox_file() -> String {
    DEFAULT_OBSIDIAN_INBOX_FILE.to_string()
}

pub(crate) fn normalize_obsidian_relative_path(value: &str) -> Result<String, String> {
    let normalized = value.trim().replace('\\', "/");
    if normalized.is_empty() {
        return Ok(String::new());
    }
    if normalized.starts_with('/') {
        return Err("Obsidian relative paths cannot be absolute.".to_string());
    }
    let mut chars = normalized.chars();
    if matches!(
        (chars.next(), chars.next()),
        (Some(first), Some(':')) if first.is_ascii_alphabetic()
    ) {
        return Err("Obsidian relative paths cannot include drive prefixes.".to_string());
    }

    let mut segments: Vec<String> = Vec::new();
    for raw_segment in normalized.split('/') {
        let segment = raw_segment.trim();
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            return Err("Obsidian relative paths cannot contain parent traversal.".to_string());
        }
        segments.push(segment.to_string());
    }

    Ok(segments.join("/"))
}

pub(crate) fn normalize_obsidian_inbox_file(value: &str) -> String {
    normalize_obsidian_relative_path(value)
        .ok()
        .filter(|path| !path.is_empty())
        .unwrap_or_else(default_obsidian_inbox_file)
}

pub(crate) fn should_skip_obsidian_segment(name: &str) -> bool {
    if name.is_empty() {
        return true;
    }
    if name == ".obsidian" || name == ".trash" || name == "node_modules" {
        return true;
    }
    name.starts_with('.')
}

pub(crate) fn should_skip_obsidian_relative_path(relative_path: &str) -> bool {
    let Ok(normalized) = normalize_obsidian_relative_path(relative_path) else {
        return true;
    };
    normalized
        .split('/')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .any(should_skip_obsidian_segment)
}

pub(crate) fn is_obsidian_markdown_relative_path(relative_path: &str) -> bool {
    let Ok(normalized) = normalize_obsidian_relative_path(relative_path) else {
        return false;
    };
    normalized.to_ascii_lowercase().ends_with(".md")
}

pub(crate) fn join_obsidian_vault_path(
    vault_path: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let trimmed_vault = vault_path.trim();
    if trimmed_vault.is_empty() {
        return Err("Obsidian vault path is not configured.".to_string());
    }
    let normalized_relative = normalize_obsidian_relative_path(relative_path)?;
    if normalized_relative.is_empty() {
        return Err("Obsidian file path is not configured.".to_string());
    }
    Ok(Path::new(trimmed_vault).join(Path::new(&normalized_relative)))
}

pub(crate) fn normalize_filesystem_path(path: &Path) -> String {
    let raw = path.to_string_lossy().replace('\\', "/");
    if raw.len() > 1 {
        raw.trim_end_matches('/').to_string()
    } else {
        raw
    }
}

pub(crate) fn relative_obsidian_path_from_absolute(
    vault_root: &Path,
    candidate_path: &Path,
) -> Option<String> {
    let base = normalize_filesystem_path(vault_root);
    let candidate = normalize_filesystem_path(candidate_path);
    if candidate == base {
        return None;
    }
    let prefix = format!("{base}/");
    if !candidate.starts_with(&prefix) {
        return None;
    }
    normalize_obsidian_relative_path(&candidate[prefix.len()..])
        .ok()
        .filter(|path| !path.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_obsidian_relative_paths() {
        assert_eq!(
            normalize_obsidian_relative_path(r" Projects\Alpha.md ").unwrap(),
            "Projects/Alpha.md"
        );
        assert!(normalize_obsidian_relative_path("/tmp/Alpha.md").is_err());
        assert!(normalize_obsidian_relative_path("../Alpha.md").is_err());
    }

    #[test]
    fn identifies_hidden_obsidian_paths() {
        assert!(should_skip_obsidian_relative_path(".obsidian/config.md"));
        assert!(should_skip_obsidian_relative_path(".trash/Deleted.md"));
        assert!(should_skip_obsidian_relative_path("Projects/.hidden.md"));
        assert!(!should_skip_obsidian_relative_path("Projects/Alpha.md"));
    }

    #[test]
    fn resolves_relative_obsidian_paths_from_absolute_paths() {
        let vault = Path::new("/tmp/Vault");
        let file = Path::new("/tmp/Vault/Projects/Alpha.md");
        assert_eq!(
            relative_obsidian_path_from_absolute(vault, file).as_deref(),
            Some("Projects/Alpha.md")
        );
        assert_eq!(
            relative_obsidian_path_from_absolute(vault, Path::new("/tmp/Other/Alpha.md")),
            None
        );
    }
}
