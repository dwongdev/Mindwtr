use crate::storage::{ensure_data_file, load_data_snapshot, persist_data_snapshot_with_retries};
use crate::{get_config_path, get_secrets_path, read_config, write_config_files, AppConfigToml};
use rand::RngCore;
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

const LOCAL_API_HOST: &str = "127.0.0.1";
pub(crate) const DEFAULT_LOCAL_API_PORT: u16 = 3456;
const MIN_LOCAL_API_PORT: u16 = 1024;
const MAX_LOCAL_API_PORT: u16 = u16::MAX;
const REQUEST_HEADER_LIMIT_BYTES: usize = 16 * 1024;
const REQUEST_BODY_LIMIT_BYTES: usize = 1_000_000;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalApiServerStatus {
    enabled: bool,
    running: bool,
    port: u16,
    url: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone)]
struct LocalApiConfig {
    enabled: bool,
    port: u16,
}

impl Default for LocalApiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: DEFAULT_LOCAL_API_PORT,
        }
    }
}

struct LocalApiHandle {
    port: u16,
    shutdown: Arc<AtomicBool>,
    join: Option<JoinHandle<()>>,
}

#[derive(Default)]
struct LocalApiRuntime {
    handle: Option<LocalApiHandle>,
    last_error: Option<String>,
}

#[derive(Default)]
pub(crate) struct LocalApiServerState {
    inner: Mutex<LocalApiRuntime>,
    write_lock: Arc<Mutex<()>>,
}

#[derive(Debug)]
struct ApiRequest {
    method: String,
    path: String,
    query: HashMap<String, String>,
    body: Vec<u8>,
}

#[derive(Debug)]
struct ApiResponse {
    status: u16,
    body: Value,
}

impl ApiResponse {
    fn ok(body: Value) -> Self {
        Self { status: 200, body }
    }

    fn created(body: Value) -> Self {
        Self { status: 201, body }
    }

    fn error(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            body: json!({ "error": message.into() }),
        }
    }
}

fn now_iso() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn generate_uuid_v4() -> String {
    let mut bytes = [0_u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        bytes[4],
        bytes[5],
        bytes[6],
        bytes[7],
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15],
    )
}

fn normalize_local_api_port(port: Option<u16>) -> Result<u16, String> {
    let port = port.unwrap_or(DEFAULT_LOCAL_API_PORT);
    if !(MIN_LOCAL_API_PORT..=MAX_LOCAL_API_PORT).contains(&port) {
        return Err(format!(
            "Local API port must be between {} and {}.",
            MIN_LOCAL_API_PORT, MAX_LOCAL_API_PORT
        ));
    }
    Ok(port)
}

fn parse_bool_setting(value: Option<&String>) -> bool {
    value
        .map(|raw| raw.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn read_local_api_config(app: &tauri::AppHandle) -> LocalApiConfig {
    let config = read_config(app);
    let port = config
        .local_api_port
        .as_deref()
        .and_then(|raw| raw.trim().parse::<u16>().ok())
        .and_then(|value| normalize_local_api_port(Some(value)).ok())
        .unwrap_or(DEFAULT_LOCAL_API_PORT);
    LocalApiConfig {
        enabled: parse_bool_setting(config.local_api_enabled.as_ref()),
        port,
    }
}

fn write_local_api_config(app: &tauri::AppHandle, next: LocalApiConfig) -> Result<(), String> {
    let mut config: AppConfigToml = read_config(app);
    config.local_api_enabled = Some(if next.enabled { "true" } else { "false" }.to_string());
    config.local_api_port = Some(next.port.to_string());
    write_config_files(&get_config_path(app), &get_secrets_path(app), &config)
}

fn status_from_runtime(config: LocalApiConfig, runtime: &LocalApiRuntime) -> LocalApiServerStatus {
    let running_port = runtime.handle.as_ref().map(|handle| handle.port);
    let port = running_port.unwrap_or(config.port);
    LocalApiServerStatus {
        enabled: config.enabled,
        running: running_port.is_some(),
        port,
        url: running_port.map(|value| format!("http://{}:{}", LOCAL_API_HOST, value)),
        error: runtime.last_error.clone(),
    }
}

fn stop_runtime(runtime: &mut LocalApiRuntime) {
    let Some(mut handle) = runtime.handle.take() else {
        return;
    };
    handle.shutdown.store(true, Ordering::SeqCst);
    let _ = TcpStream::connect((LOCAL_API_HOST, handle.port));
    if let Some(join) = handle.join.take() {
        let _ = join.join();
    }
}

fn start_runtime(
    app: tauri::AppHandle,
    port: u16,
    write_lock: Arc<Mutex<()>>,
) -> Result<LocalApiHandle, String> {
    ensure_data_file(&app)?;
    let listener = TcpListener::bind((LOCAL_API_HOST, port))
        .map_err(|error| format!("Failed to start local API server on port {port}: {error}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Failed to configure local API server: {error}"))?;

    let shutdown = Arc::new(AtomicBool::new(false));
    let thread_shutdown = shutdown.clone();
    let join = thread::spawn(move || {
        while !thread_shutdown.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let app = app.clone();
                    let write_lock = write_lock.clone();
                    thread::spawn(move || handle_connection(app, write_lock, stream));
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(50));
                }
                Err(error) => {
                    log::warn!("Local API accept failed: {error}");
                    thread::sleep(Duration::from_millis(100));
                }
            }
        }
    });

    Ok(LocalApiHandle {
        port,
        shutdown,
        join: Some(join),
    })
}

pub(crate) fn start_configured_local_api_server(
    app: &tauri::AppHandle,
    state: &LocalApiServerState,
) {
    let config = read_local_api_config(app);
    if !config.enabled {
        return;
    }

    let mut runtime = state
        .inner
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if runtime.handle.is_some() {
        return;
    }
    match start_runtime(app.clone(), config.port, state.write_lock.clone()) {
        Ok(handle) => {
            runtime.handle = Some(handle);
            runtime.last_error = None;
        }
        Err(error) => {
            log::warn!("{error}");
            runtime.last_error = Some(error);
        }
    }
}

#[tauri::command]
pub(crate) fn get_local_api_server_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, LocalApiServerState>,
) -> Result<LocalApiServerStatus, String> {
    let config = read_local_api_config(&app);
    let runtime = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(status_from_runtime(config, &runtime))
}

#[tauri::command]
pub(crate) fn set_local_api_server_config(
    app: tauri::AppHandle,
    state: tauri::State<'_, LocalApiServerState>,
    enabled: bool,
    port: Option<u16>,
) -> Result<LocalApiServerStatus, String> {
    let port = normalize_local_api_port(port)?;
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;

    if enabled {
        if runtime.handle.as_ref().map(|handle| handle.port) != Some(port) {
            stop_runtime(&mut runtime);
            match start_runtime(app.clone(), port, state.write_lock.clone()) {
                Ok(handle) => {
                    runtime.handle = Some(handle);
                    runtime.last_error = None;
                }
                Err(error) => {
                    runtime.last_error = Some(error.clone());
                    let _ = write_local_api_config(
                        &app,
                        LocalApiConfig {
                            enabled: false,
                            port,
                        },
                    );
                    return Ok(status_from_runtime(
                        LocalApiConfig {
                            enabled: false,
                            port,
                        },
                        &runtime,
                    ));
                }
            }
        }
    } else {
        stop_runtime(&mut runtime);
        runtime.last_error = None;
    }

    let config = LocalApiConfig { enabled, port };
    write_local_api_config(&app, config.clone())?;
    Ok(status_from_runtime(config, &runtime))
}

fn handle_connection(app: tauri::AppHandle, write_lock: Arc<Mutex<()>>, mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let response = match read_request(&mut stream) {
        Ok(Some(request)) => handle_api_request(&app, &write_lock, request),
        Ok(None) => return,
        Err(error) => ApiResponse::error(400, error),
    };
    let _ = write_response(&mut stream, response);
}

fn read_request(stream: &mut TcpStream) -> Result<Option<ApiRequest>, String> {
    let mut buffer: Vec<u8> = Vec::new();
    let mut temp = [0_u8; 1024];
    let header_end = loop {
        let read = stream.read(&mut temp).map_err(|e| e.to_string())?;
        if read == 0 {
            if buffer.is_empty() {
                return Ok(None);
            }
            return Err("Incomplete HTTP request".to_string());
        }
        buffer.extend_from_slice(&temp[..read]);
        if buffer.len() > REQUEST_HEADER_LIMIT_BYTES + REQUEST_BODY_LIMIT_BYTES {
            return Err("Request too large".to_string());
        }
        if let Some(index) = find_header_end(&buffer) {
            break index;
        }
        if buffer.len() > REQUEST_HEADER_LIMIT_BYTES {
            return Err("Request headers too large".to_string());
        }
    };

    let header_bytes = &buffer[..header_end];
    let header_text = std::str::from_utf8(header_bytes)
        .map_err(|_| "Invalid HTTP header encoding".to_string())?;
    let mut lines = header_text.split("\r\n");
    let request_line = lines
        .next()
        .ok_or_else(|| "Missing HTTP request line".to_string())?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts
        .next()
        .ok_or_else(|| "Missing HTTP method".to_string())?
        .to_ascii_uppercase();
    let target = request_parts
        .next()
        .ok_or_else(|| "Missing HTTP target".to_string())?;
    let (path, query) = parse_request_target(target);

    let mut content_length = 0_usize;
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        if name.trim().eq_ignore_ascii_case("content-length") {
            content_length = value
                .trim()
                .parse::<usize>()
                .map_err(|_| "Invalid Content-Length".to_string())?;
        }
    }
    if content_length > REQUEST_BODY_LIMIT_BYTES {
        return Err("Request body too large".to_string());
    }

    let body_start = header_end + 4;
    while buffer.len().saturating_sub(body_start) < content_length {
        let read = stream.read(&mut temp).map_err(|e| e.to_string())?;
        if read == 0 {
            return Err("Incomplete HTTP request body".to_string());
        }
        buffer.extend_from_slice(&temp[..read]);
    }
    let body = buffer[body_start..body_start + content_length].to_vec();

    Ok(Some(ApiRequest {
        method,
        path,
        query,
        body,
    }))
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn parse_request_target(target: &str) -> (String, HashMap<String, String>) {
    let (path_raw, query_raw) = target.split_once('?').unwrap_or((target, ""));
    let path = percent_decode(path_raw).unwrap_or_else(|| path_raw.to_string());
    let mut query = HashMap::new();
    for pair in query_raw.split('&') {
        if pair.is_empty() {
            continue;
        }
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        let key = percent_decode(key).unwrap_or_else(|| key.to_string());
        let value = percent_decode(value).unwrap_or_else(|| value.to_string());
        query.insert(key, value);
    }
    (path, query)
}

fn write_response(stream: &mut TcpStream, response: ApiResponse) -> Result<(), String> {
    let status_text = match response.status {
        200 => "OK",
        201 => "Created",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        413 => "Payload Too Large",
        500 => "Internal Server Error",
        _ => "OK",
    };
    let body = serde_json::to_string_pretty(&response.body).map_err(|e| e.to_string())?;
    let headers = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Authorization, Content-Type\r\nAccess-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        response.status,
        status_text,
        body.as_bytes().len(),
    );
    stream
        .write_all(headers.as_bytes())
        .and_then(|_| stream.write_all(body.as_bytes()))
        .map_err(|e| e.to_string())
}

fn handle_api_request(
    app: &tauri::AppHandle,
    write_lock: &Arc<Mutex<()>>,
    request: ApiRequest,
) -> ApiResponse {
    if request.method == "OPTIONS" {
        return ApiResponse::ok(json!({ "ok": true }));
    }

    match route_api_request(app, write_lock, request) {
        Ok(response) => response,
        Err(error) => api_error_response(error),
    }
}

fn api_error_response(error: String) -> ApiResponse {
    if error == "Task not found" {
        return ApiResponse::error(404, error);
    }
    if error.starts_with("Invalid ")
        || error.starts_with("Task title")
        || error.starts_with("Request ")
    {
        return ApiResponse::error(400, error);
    }
    ApiResponse::error(500, error)
}

fn route_api_request(
    app: &tauri::AppHandle,
    write_lock: &Arc<Mutex<()>>,
    request: ApiRequest,
) -> Result<ApiResponse, String> {
    let segments = path_segments(&request.path);

    if request.method == "GET" && request.path == "/health" {
        return Ok(ApiResponse::ok(json!({ "ok": true })));
    }

    if request.method == "GET" && request.path == "/tasks" {
        let data = load_data_snapshot(app)?;
        let tasks = filter_tasks(array_items(&data, "tasks"), &request.query)?;
        return Ok(ApiResponse::ok(json!({ "tasks": tasks })));
    }

    if request.method == "GET" && request.path == "/projects" {
        let data = load_data_snapshot(app)?;
        let projects = array_items(&data, "projects")
            .into_iter()
            .filter(|project| !has_string_field(project, "deletedAt"))
            .collect::<Vec<_>>();
        return Ok(ApiResponse::ok(json!({ "projects": projects })));
    }

    if request.method == "GET" && (request.path == "/areas" || request.path == "/v1/areas") {
        let data = load_data_snapshot(app)?;
        let areas = array_items(&data, "areas")
            .into_iter()
            .filter(|area| !has_string_field(area, "deletedAt"))
            .collect::<Vec<_>>();
        return Ok(ApiResponse::ok(json!({ "areas": areas })));
    }

    if request.method == "GET" && request.path == "/search" {
        let data = load_data_snapshot(app)?;
        let query = request.query.get("query").cloned().unwrap_or_default();
        return Ok(ApiResponse::ok(search_data(&data, &query)));
    }

    if segments.len() == 2 && segments[0] == "tasks" && request.method == "GET" {
        let data = load_data_snapshot(app)?;
        let task = find_task(&data, &segments[1]).ok_or_else(|| "Task not found".to_string())?;
        return Ok(ApiResponse::ok(json!({ "task": task })));
    }

    if request.method == "POST" && request.path == "/tasks" {
        let _guard = write_lock.lock().map_err(|e| e.to_string())?;
        let mut data = load_data_snapshot(app)?;
        let body = parse_body_object(&request.body)?;
        let task = create_task_from_body(&body)?;
        ensure_array_mut(&mut data, "tasks")?.push(Value::Object(task.clone()));
        persist_data_snapshot_with_retries(app, &data)?;
        return Ok(ApiResponse::created(json!({ "task": Value::Object(task) })));
    }

    if segments.len() == 2 && segments[0] == "tasks" && request.method == "PATCH" {
        let _guard = write_lock.lock().map_err(|e| e.to_string())?;
        let mut data = load_data_snapshot(app)?;
        let body = parse_body_object(&request.body)?;
        let task = update_task_in_data(&mut data, &segments[1], |task| {
            apply_task_patch(task, &body)
        })?;
        persist_data_snapshot_with_retries(app, &data)?;
        return Ok(ApiResponse::ok(json!({ "task": task })));
    }

    if segments.len() == 2 && segments[0] == "tasks" && request.method == "DELETE" {
        let _guard = write_lock.lock().map_err(|e| e.to_string())?;
        let mut data = load_data_snapshot(app)?;
        update_task_in_data(&mut data, &segments[1], |task| {
            let now = now_iso();
            task.insert("deletedAt".to_string(), Value::String(now.clone()));
            task.insert("updatedAt".to_string(), Value::String(now));
            Ok(())
        })?;
        persist_data_snapshot_with_retries(app, &data)?;
        return Ok(ApiResponse::ok(json!({ "ok": true })));
    }

    if segments.len() == 3 && segments[0] == "tasks" && request.method == "POST" {
        let action = segments[2].as_str();
        if !matches!(action, "complete" | "archive" | "restore") {
            return Ok(ApiResponse::error(404, "Not found"));
        }
        let _guard = write_lock.lock().map_err(|e| e.to_string())?;
        let mut data = load_data_snapshot(app)?;
        let task = update_task_in_data(&mut data, &segments[1], |task| {
            let now = now_iso();
            if action == "complete" {
                task.insert("status".to_string(), Value::String("done".to_string()));
                task.insert("completedAt".to_string(), Value::String(now.clone()));
            } else if action == "archive" {
                task.insert("status".to_string(), Value::String("archived".to_string()));
            } else {
                task.remove("deletedAt");
                task.remove("purgedAt");
            }
            task.insert("updatedAt".to_string(), Value::String(now));
            Ok(())
        })?;
        persist_data_snapshot_with_retries(app, &data)?;
        return Ok(ApiResponse::ok(json!({ "task": task })));
    }

    Ok(ApiResponse::error(404, "Not found"))
}

fn path_segments(path: &str) -> Vec<String> {
    path.trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| percent_decode(segment).unwrap_or_else(|| segment.to_string()))
        .collect()
}

fn array_items(data: &Value, key: &str) -> Vec<Value> {
    data.get(key)
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default()
}

fn ensure_array_mut<'a>(data: &'a mut Value, key: &str) -> Result<&'a mut Vec<Value>, String> {
    let object = data
        .as_object_mut()
        .ok_or_else(|| "Local data snapshot is invalid".to_string())?;
    let entry = object
        .entry(key.to_string())
        .or_insert_with(|| Value::Array(Vec::new()));
    if !entry.is_array() {
        *entry = Value::Array(Vec::new());
    }
    entry
        .as_array_mut()
        .ok_or_else(|| "Local data snapshot is invalid".to_string())
}

fn has_string_field(value: &Value, key: &str) -> bool {
    value
        .get(key)
        .and_then(|field| field.as_str())
        .is_some_and(|field| !field.trim().is_empty())
}

fn filter_tasks(tasks: Vec<Value>, query: &HashMap<String, String>) -> Result<Vec<Value>, String> {
    let include_all = query.get("all").map(|value| value == "1").unwrap_or(false);
    let include_deleted = query
        .get("deleted")
        .map(|value| value == "1")
        .unwrap_or(false);
    let status = query
        .get("status")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());
    if let Some(status) = status {
        validate_task_status(status)?;
    }
    let text_query = query
        .get("query")
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());

    let filtered = tasks
        .into_iter()
        .filter(|task| include_deleted || !has_string_field(task, "deletedAt"))
        .filter(|task| {
            if include_all {
                return true;
            }
            let status = task
                .get("status")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            status != "done" && status != "archived"
        })
        .filter(|task| {
            status
                .map(|target| task.get("status").and_then(|value| value.as_str()) == Some(target))
                .unwrap_or(true)
        })
        .filter(|task| {
            text_query
                .as_ref()
                .map(|target| value_search_text(task).contains(target))
                .unwrap_or(true)
        })
        .collect();
    Ok(filtered)
}

fn search_data(data: &Value, query: &str) -> Value {
    let target = query.trim().to_ascii_lowercase();
    if target.is_empty() {
        return json!({ "tasks": [], "projects": [] });
    }
    let tasks = array_items(data, "tasks")
        .into_iter()
        .filter(|task| !has_string_field(task, "deletedAt"))
        .filter(|task| value_search_text(task).contains(&target))
        .collect::<Vec<_>>();
    let projects = array_items(data, "projects")
        .into_iter()
        .filter(|project| !has_string_field(project, "deletedAt"))
        .filter(|project| value_search_text(project).contains(&target))
        .collect::<Vec<_>>();
    json!({ "tasks": tasks, "projects": projects })
}

fn value_search_text(value: &Value) -> String {
    [
        "title",
        "description",
        "status",
        "tags",
        "contexts",
        "projectId",
        "areaId",
        "name",
        "supportNotes",
    ]
    .iter()
    .filter_map(|key| value.get(*key))
    .map(|field| {
        field
            .as_str()
            .map(|raw| raw.to_string())
            .unwrap_or_else(|| field.to_string())
    })
    .collect::<Vec<_>>()
    .join(" ")
    .to_ascii_lowercase()
}

fn find_task(data: &Value, task_id: &str) -> Option<Value> {
    data.get("tasks")?
        .as_array()?
        .iter()
        .find(|task| task.get("id").and_then(|value| value.as_str()) == Some(task_id))
        .cloned()
}

fn update_task_in_data<F>(data: &mut Value, task_id: &str, update: F) -> Result<Value, String>
where
    F: FnOnce(&mut Map<String, Value>) -> Result<(), String>,
{
    let tasks = ensure_array_mut(data, "tasks")?;
    let task = tasks
        .iter_mut()
        .find(|task| task.get("id").and_then(|value| value.as_str()) == Some(task_id))
        .ok_or_else(|| "Task not found".to_string())?;
    let task_object = task
        .as_object_mut()
        .ok_or_else(|| "Task is invalid".to_string())?;
    update(task_object)?;
    Ok(Value::Object(task_object.clone()))
}

fn parse_body_object(body: &[u8]) -> Result<Map<String, Value>, String> {
    if body.is_empty() {
        return Err("Invalid JSON body".to_string());
    }
    let value: Value = serde_json::from_slice(body).map_err(|_| "Invalid JSON body".to_string())?;
    value
        .as_object()
        .cloned()
        .ok_or_else(|| "Invalid JSON body".to_string())
}

fn create_task_from_body(body: &Map<String, Value>) -> Result<Map<String, Value>, String> {
    let input = body
        .get("input")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let title = body
        .get("title")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let resolved_title = if title.is_empty() { input } else { title };
    if resolved_title.is_empty() {
        return Err("Task title is required".to_string());
    }

    let mut task = body
        .get("props")
        .and_then(|value| value.as_object())
        .cloned()
        .unwrap_or_default();
    sanitize_task_patch_map(&mut task)?;
    let now = now_iso();
    task.insert("id".to_string(), Value::String(generate_uuid_v4()));
    task.insert(
        "title".to_string(),
        Value::String(resolved_title.to_string()),
    );
    task.entry("status".to_string())
        .or_insert_with(|| Value::String("inbox".to_string()));
    task.insert("createdAt".to_string(), Value::String(now.clone()));
    task.insert("updatedAt".to_string(), Value::String(now));
    Ok(task)
}

fn apply_task_patch(
    task: &mut Map<String, Value>,
    patch: &Map<String, Value>,
) -> Result<(), String> {
    let mut sanitized = patch.clone();
    sanitize_task_patch_map(&mut sanitized)?;
    for (key, value) in sanitized {
        if value.is_null() {
            task.remove(&key);
        } else {
            task.insert(key, value);
        }
    }
    task.insert("updatedAt".to_string(), Value::String(now_iso()));
    Ok(())
}

fn sanitize_task_patch_map(patch: &mut Map<String, Value>) -> Result<(), String> {
    for key in [
        "id",
        "createdAt",
        "updatedAt",
        "rev",
        "revBy",
        "deletedAt",
        "purgedAt",
    ] {
        patch.remove(key);
    }
    if let Some(status) = patch.get("status").and_then(|value| value.as_str()) {
        validate_task_status(status)?;
    }
    Ok(())
}

fn validate_task_status(status: &str) -> Result<(), String> {
    match status {
        "inbox" | "next" | "waiting" | "someday" | "reference" | "done" | "archived" => Ok(()),
        _ => Err(format!("Invalid status: {status}")),
    }
}

fn percent_decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hi = bytes.get(index + 1).and_then(|value| hex_value(*value))?;
            let lo = bytes.get(index + 2).and_then(|value| hex_value(*value))?;
            decoded.push((hi << 4) | lo);
            index += 3;
        } else if bytes[index] == b'+' {
            decoded.push(b' ');
            index += 1;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_default_local_api_port() {
        assert_eq!(
            normalize_local_api_port(None).unwrap(),
            DEFAULT_LOCAL_API_PORT
        );
        assert!(normalize_local_api_port(Some(80)).is_err());
    }

    #[test]
    fn parses_request_target_query_values() {
        let (path, query) = parse_request_target("/tasks?query=call+mom&status=next");
        assert_eq!(path, "/tasks");
        assert_eq!(query.get("query").map(String::as_str), Some("call mom"));
        assert_eq!(query.get("status").map(String::as_str), Some("next"));
    }

    #[test]
    fn filters_active_tasks_by_default() {
        let tasks = vec![
            json!({ "id": "1", "title": "A", "status": "next" }),
            json!({ "id": "2", "title": "B", "status": "done" }),
            json!({ "id": "3", "title": "C", "status": "next", "deletedAt": "now" }),
        ];
        let filtered = filter_tasks(tasks, &HashMap::new()).unwrap();
        assert_eq!(filtered.len(), 1);
        assert_eq!(
            filtered[0].get("id").and_then(|value| value.as_str()),
            Some("1")
        );
    }
}
