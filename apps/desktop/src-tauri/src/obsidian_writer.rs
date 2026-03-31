use crate::obsidian_paths::{
    is_obsidian_markdown_relative_path, join_obsidian_vault_path, normalize_obsidian_relative_path,
};
use std::fs;
use std::io::Write;
use std::path::Path;
use tempfile::Builder;

#[derive(Clone, Debug, PartialEq, Eq)]
struct LineRecord {
    content: String,
    ending: String,
}

fn split_lines_preserving_endings(input: &str) -> Vec<LineRecord> {
    if input.is_empty() {
        return Vec::new();
    }

    let bytes = input.as_bytes();
    let mut start = 0;
    let mut lines: Vec<LineRecord> = Vec::new();

    for (index, byte) in bytes.iter().enumerate() {
        if *byte != b'\n' {
            continue;
        }
        let (content_end, ending) = if index > 0 && bytes[index - 1] == b'\r' {
            (index - 1, "\r\n")
        } else {
            (index, "\n")
        };
        lines.push(LineRecord {
            content: input[start..content_end].to_string(),
            ending: ending.to_string(),
        });
        start = index + 1;
    }

    if start < input.len() {
        lines.push(LineRecord {
            content: input[start..].to_string(),
            ending: String::new(),
        });
    }

    lines
}

fn rebuild_lines(lines: &[LineRecord]) -> String {
    let mut rebuilt = String::new();
    for line in lines {
        rebuilt.push_str(&line.content);
        rebuilt.push_str(&line.ending);
    }
    rebuilt
}

fn checkbox_index(line: &str) -> Option<(usize, char, usize)> {
    let bytes = line.as_bytes();
    let mut index = 0;

    while index < bytes.len() && matches!(bytes[index], b' ' | b'\t') {
        index += 1;
    }
    if index >= bytes.len() || !matches!(bytes[index], b'-' | b'*' | b'+') {
        return None;
    }
    index += 1;

    let mut gap_after_bullet = 0;
    while index < bytes.len() && matches!(bytes[index], b' ' | b'\t') {
        gap_after_bullet += 1;
        index += 1;
    }
    if gap_after_bullet == 0
        || index + 2 >= bytes.len()
        || bytes[index] != b'['
        || bytes[index + 2] != b']'
    {
        return None;
    }

    let marker = bytes[index + 1] as char;
    if !matches!(marker, ' ' | 'x' | 'X') {
        return None;
    }

    let mut text_start = index + 3;
    let mut gap_after_checkbox = 0;
    while text_start < bytes.len() && matches!(bytes[text_start], b' ' | b'\t') {
        gap_after_checkbox += 1;
        text_start += 1;
    }
    if gap_after_checkbox == 0 {
        return None;
    }

    Some((index + 1, marker, text_start))
}

fn extract_task_text(line: &str) -> Option<&str> {
    let (_, _, text_start) = checkbox_index(line)?;
    Some(&line[text_start..])
}

fn toggle_task_line(line: &str, set_completed: bool) -> Result<String, String> {
    let Some((checkbox_idx, marker, _)) = checkbox_index(line) else {
        return Err("The selected line is not a Markdown task.".to_string());
    };

    if set_completed && marker != ' ' {
        return Err("Expected an unchecked task before marking it complete.".to_string());
    }
    if !set_completed && !matches!(marker, 'x' | 'X') {
        return Err("Expected a checked task before marking it incomplete.".to_string());
    }

    let next_marker = if set_completed { 'x' } else { ' ' };
    let mut updated = String::with_capacity(line.len());
    updated.push_str(&line[..checkbox_idx]);
    updated.push(next_marker);
    updated.push_str(&line[checkbox_idx + 1..]);
    Ok(updated)
}

fn find_task_line(
    lines: &[LineRecord],
    expected_line: usize,
    task_text: &str,
) -> Result<usize, String> {
    if expected_line > 0 && expected_line <= lines.len() {
        if extract_task_text(&lines[expected_line - 1].content) == Some(task_text) {
            return Ok(expected_line);
        }
    }

    let matches = lines
        .iter()
        .enumerate()
        .filter_map(|(index, line)| {
            (extract_task_text(&line.content) == Some(task_text)).then_some(index + 1)
        })
        .collect::<Vec<_>>();

    match matches.as_slice() {
        [line_number] => Ok(*line_number),
        [] => Err("Task not found in the note. Try rescanning the vault.".to_string()),
        _ => Err(
            "Multiple matching tasks were found in the note. Try rescanning the vault.".to_string(),
        ),
    }
}

fn detect_line_ending(input: &str) -> &'static str {
    if input.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

fn atomic_write_text(path: &Path, content: &str) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err("Failed to resolve the Obsidian file parent directory.".to_string());
    };
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to prepare the Obsidian folder: {error}"))?;

    let metadata = fs::metadata(path).ok();
    let mut temp_file = Builder::new()
        .prefix(".mindwtr-obsidian-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(|error| format!("Failed to create a temporary Obsidian file: {error}"))?;

    temp_file
        .write_all(content.as_bytes())
        .map_err(|error| format!("Failed to write Obsidian file changes: {error}"))?;
    temp_file
        .as_file()
        .sync_all()
        .map_err(|error| format!("Failed to flush Obsidian file changes: {error}"))?;

    if let Some(existing_metadata) = metadata {
        let _ = fs::set_permissions(temp_file.path(), existing_metadata.permissions());
    }

    if cfg!(windows) && path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to replace the existing Obsidian file: {error}"))?;
    }

    match temp_file.persist(path) {
        Ok(_) => Ok(()),
        Err(error) => {
            let temp_path = error.file.path().to_path_buf();
            fs::copy(&temp_path, path).map_err(|copy_error| {
                format!(
                    "Failed to replace the Obsidian file: {}, {}",
                    error.error, copy_error
                )
            })?;
            let _ = fs::remove_file(temp_path);
            Ok(())
        }
    }
}

#[tauri::command]
pub(crate) fn obsidian_toggle_task(
    vault_path: String,
    relative_file_path: String,
    line_number: usize,
    task_text: String,
    set_completed: bool,
) -> Result<(), String> {
    let normalized_relative_path = normalize_obsidian_relative_path(&relative_file_path)?;
    if !is_obsidian_markdown_relative_path(&normalized_relative_path) {
        return Err("Obsidian tasks can only be updated in Markdown files.".to_string());
    }

    let absolute_path = join_obsidian_vault_path(&vault_path, &normalized_relative_path)?;
    let content = fs::read_to_string(&absolute_path)
        .map_err(|error| format!("Failed to read the Obsidian note: {error}"))?;
    let mut lines = split_lines_preserving_endings(&content);
    let actual_line = find_task_line(&lines, line_number, &task_text)?;
    let current = lines
        .get(actual_line - 1)
        .map(|line| line.content.as_str())
        .ok_or_else(|| "Task line is out of bounds.".to_string())?;
    let updated_line = toggle_task_line(current, set_completed)?;
    lines[actual_line - 1].content = updated_line;

    atomic_write_text(&absolute_path, &rebuild_lines(&lines))
}

#[tauri::command]
pub(crate) fn obsidian_create_task(
    vault_path: String,
    relative_file_path: String,
    task_text: String,
) -> Result<(), String> {
    let normalized_relative_path = normalize_obsidian_relative_path(&relative_file_path)?;
    if normalized_relative_path.is_empty() {
        return Err("Choose an Obsidian inbox note before creating a task.".to_string());
    }
    if !is_obsidian_markdown_relative_path(&normalized_relative_path) {
        return Err("Obsidian inbox notes must be Markdown files ending in .md.".to_string());
    }

    let trimmed_task_text = task_text.trim();
    if trimmed_task_text.is_empty() {
        return Err("Enter a task title before adding it to Obsidian.".to_string());
    }

    let absolute_path = join_obsidian_vault_path(&vault_path, &normalized_relative_path)?;
    let existing_content = match fs::read_to_string(&absolute_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(format!("Failed to read the Obsidian inbox note: {error}")),
    };

    let line_ending = detect_line_ending(&existing_content);
    let next_content = if existing_content.is_empty() {
        format!("- [ ] {trimmed_task_text}{line_ending}")
    } else if existing_content.ends_with('\n') {
        format!("{existing_content}- [ ] {trimmed_task_text}{line_ending}")
    } else {
        format!("{existing_content}{line_ending}- [ ] {trimmed_task_text}{line_ending}")
    };

    atomic_write_text(&absolute_path, &next_content)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn toggle_task_preserves_indentation_and_line_endings() {
        let temp = tempdir().expect("should create temp vault");
        let file_path = temp.path().join("Projects.md");
        fs::write(
            &file_path,
            "Intro\r\n  - [ ] Draft spec #work [[Spec]]\r\nOutro\r\n",
        )
        .expect("should create note");

        obsidian_toggle_task(
            temp.path().to_string_lossy().to_string(),
            "Projects.md".to_string(),
            2,
            "Draft spec #work [[Spec]]".to_string(),
            true,
        )
        .expect("should toggle task");

        let updated = fs::read_to_string(&file_path).expect("should read updated file");
        assert_eq!(
            updated,
            "Intro\r\n  - [x] Draft spec #work [[Spec]]\r\nOutro\r\n"
        );
    }

    #[test]
    fn toggle_task_falls_back_to_matching_task_text_when_line_numbers_shift() {
        let temp = tempdir().expect("should create temp vault");
        let file_path = temp.path().join("Inbox.md");
        fs::write(&file_path, "New line\n- [ ] Follow up client\n").expect("should create note");

        obsidian_toggle_task(
            temp.path().to_string_lossy().to_string(),
            "Inbox.md".to_string(),
            1,
            "Follow up client".to_string(),
            true,
        )
        .expect("should find shifted task");

        let updated = fs::read_to_string(&file_path).expect("should read updated file");
        assert_eq!(updated, "New line\n- [x] Follow up client\n");
    }

    #[test]
    fn toggle_task_errors_when_multiple_matching_tasks_exist() {
        let temp = tempdir().expect("should create temp vault");
        let file_path = temp.path().join("Inbox.md");
        fs::write(
            &file_path,
            "- [ ] Follow up client\n- [ ] Follow up client\n",
        )
        .expect("should create note");

        let error = obsidian_toggle_task(
            temp.path().to_string_lossy().to_string(),
            "Inbox.md".to_string(),
            0,
            "Follow up client".to_string(),
            true,
        )
        .expect_err("should reject ambiguous task matches");

        assert!(error.contains("Multiple matching tasks"));
    }

    #[test]
    fn create_task_creates_parent_directories_and_appends_to_existing_file() {
        let temp = tempdir().expect("should create temp vault");
        let vault_root = temp.path().to_string_lossy().to_string();

        obsidian_create_task(
            vault_root.clone(),
            "Mindwtr/Inbox.md".to_string(),
            "Capture from Mindwtr".to_string(),
        )
        .expect("should create inbox note");
        obsidian_create_task(
            vault_root,
            "Mindwtr/Inbox.md".to_string(),
            "Second task".to_string(),
        )
        .expect("should append task");

        let content = fs::read_to_string(temp.path().join("Mindwtr/Inbox.md"))
            .expect("should read inbox note");
        assert_eq!(content, "- [ ] Capture from Mindwtr\n- [ ] Second task\n");
    }
}
