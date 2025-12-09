use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Default)]
struct AppConfig {
    data_file_path: Option<String>,
    sync_path: Option<String>,
}

fn get_config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_config_dir().unwrap().join("config.json")
}

fn get_data_path(app: &tauri::AppHandle) -> PathBuf {
    let config_path = get_config_path(app);
    if let Ok(content) = fs::read_to_string(&config_path) {
        if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
            if let Some(path) = config.data_file_path {
                return PathBuf::from(path);
            }
        }
    }
    app.path().app_config_dir().unwrap().join("data.json")
}

fn ensure_data_file(app: &tauri::AppHandle) -> Result<(), String> {
    let data_path = get_data_path(app);
    if let Some(parent) = data_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if !data_path.exists() {
        let initial_data = serde_json::json!({
            "tasks": [],
            "projects": [],
            "settings": {}
        });
        fs::write(&data_path, serde_json::to_string_pretty(&initial_data).unwrap())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_data(app: tauri::AppHandle) -> Result<Value, String> {
    let data_path = get_data_path(&app);
    let content = fs::read_to_string(&data_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_data(app: tauri::AppHandle, data: Value) -> Result<bool, String> {
    let data_path = get_data_path(&app);
    fs::write(&data_path, serde_json::to_string_pretty(&data).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn get_data_path_cmd(app: tauri::AppHandle) -> String {
    get_data_path(&app).to_string_lossy().to_string()
}

#[tauri::command]
fn get_sync_path(app: tauri::AppHandle) -> String {
    let config_path = get_config_path(&app);
    if let Ok(content) = fs::read_to_string(&config_path) {
        if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
            if let Some(path) = config.sync_path {
                return path;
            }
        }
    }
    // Default sync path
    app.path()
        .app_config_dir()
        .unwrap()
        .join("sync")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn set_sync_path(app: tauri::AppHandle, sync_path: String) -> Result<serde_json::Value, String> {
    let config_path = get_config_path(&app);
    
    // Load existing config or create new
    let mut config: AppConfig = if let Ok(content) = fs::read_to_string(&config_path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    };
    
    config.sync_path = Some(sync_path.clone());
    
    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "success": true,
        "path": sync_path
    }))
}

#[tauri::command]
fn sync_data(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let sync_path_str = get_sync_path(app.clone());
    let sync_file = PathBuf::from(&sync_path_str).join("focus-gtd-sync.json");
    let local_data = get_data(app.clone())?;
    
    // Read sync file if exists
    let _sync_data: Option<Value> = if sync_file.exists() {
        let content = fs::read_to_string(&sync_file).map_err(|e| e.to_string())?;
        Some(serde_json::from_str(&content).map_err(|e| e.to_string())?)
    } else {
        None
    };
    
    // For now, just write local to sync (simple sync)
    // TODO: Implement proper merge logic
    if let Some(parent) = sync_file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&sync_file, serde_json::to_string_pretty(&local_data).unwrap())
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "success": true,
        "data": local_data
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Ensure data file exists on startup
            ensure_data_file(&app.handle()).ok();
            
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_data,
            save_data,
            get_data_path_cmd,
            get_sync_path,
            set_sync_path,
            sync_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
