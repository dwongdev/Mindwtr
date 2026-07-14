use crate::*;
use mail_parser::MessageParser;
use native_tls::{TlsConnector, TlsStream};
use std::net::{TcpStream, ToSocketAddrs};

const EMAIL_CAPTURE_STATE_FILE_NAME: &str = "email-capture-state.json";
const EMAIL_CAPTURE_DEFAULT_PORT: u16 = 993;
const EMAIL_CAPTURE_DEFAULT_FOLDER: &str = "Mindwtr";
// Bounded work per poll; the mailbox is the queue, so leftovers are picked up
// by follow-up polls (`has_more`) instead of one unbounded fetch.
const EMAIL_CAPTURE_BATCH_LIMIT: usize = 25;
const EMAIL_CAPTURE_BODY_CHAR_LIMIT: usize = 16_000;
const EMAIL_CAPTURE_SEEN_MESSAGE_ID_LIMIT: usize = 500;
const EMAIL_CAPTURE_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const EMAIL_CAPTURE_IO_TIMEOUT: Duration = Duration::from_secs(60);

fn default_email_capture_port() -> u16 {
    EMAIL_CAPTURE_DEFAULT_PORT
}

fn default_email_capture_folder() -> String {
    EMAIL_CAPTURE_DEFAULT_FOLDER.to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EmailCaptureConfigPayload {
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    host: String,
    #[serde(default = "default_email_capture_port")]
    port: u16,
    #[serde(default)]
    username: String,
    #[serde(default = "default_email_capture_folder")]
    folder: String,
}

impl Default for EmailCaptureConfigPayload {
    fn default() -> Self {
        Self {
            enabled: false,
            host: String::new(),
            port: EMAIL_CAPTURE_DEFAULT_PORT,
            username: String::new(),
            folder: default_email_capture_folder(),
        }
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EmailCaptureError {
    pub kind: String,
    pub message: String,
}

impl EmailCaptureError {
    fn new(kind: &str, message: impl Into<String>) -> Self {
        Self {
            kind: kind.to_string(),
            message: message.into(),
        }
    }

    fn auth(message: impl Into<String>) -> Self {
        Self::new("auth", message)
    }

    fn network(message: impl Into<String>) -> Self {
        Self::new("network", message)
    }

    fn config(message: impl Into<String>) -> Self {
        Self::new("config", message)
    }

    fn other(message: impl Into<String>) -> Self {
        Self::new("other", message)
    }
}

fn classify_imap_error(error: imap::error::Error, fallback_kind: &str) -> EmailCaptureError {
    match error {
        imap::error::Error::Io(inner) => EmailCaptureError::network(inner.to_string()),
        imap::error::Error::Tls(inner) => EmailCaptureError::network(inner.to_string()),
        imap::error::Error::TlsHandshake(inner) => EmailCaptureError::network(inner.to_string()),
        imap::error::Error::ConnectionLost => {
            EmailCaptureError::network("Connection lost".to_string())
        }
        other => EmailCaptureError::new(fallback_kind, other.to_string()),
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EmailCaptureState {
    uid_validity: Option<u32>,
    #[serde(default)]
    last_seen_uid: u32,
    #[serde(default)]
    seen_message_ids: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EmailCaptureMessage {
    pub uid: u32,
    pub message_id: String,
    pub subject: String,
    pub from: String,
    pub received_at: Option<String>,
    pub body_text: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EmailCapturePollResult {
    pub uid_validity: u32,
    pub messages: Vec<EmailCaptureMessage>,
    /// Highest UID fetched this round, including messages skipped by the
    /// Message-ID dedupe — the frontend commits this as the new watermark so
    /// already-seen mail is not refetched every poll. Zero when nothing was fetched.
    pub max_fetched_uid: u32,
    pub has_more: bool,
}

pub(crate) fn normalize_email_capture_payload(
    payload: EmailCaptureConfigPayload,
) -> EmailCaptureConfigPayload {
    let host = payload.host.trim().to_string();
    let username = payload.username.trim().to_string();
    let folder = {
        let trimmed = payload.folder.trim();
        if trimmed.is_empty() {
            default_email_capture_folder()
        } else {
            trimmed.to_string()
        }
    };
    let port = if payload.port == 0 {
        EMAIL_CAPTURE_DEFAULT_PORT
    } else {
        payload.port
    };
    EmailCaptureConfigPayload {
        enabled: payload.enabled && !host.is_empty() && !username.is_empty(),
        host,
        port,
        username,
        folder,
    }
}

fn read_email_capture_payload(config: &AppConfigToml) -> EmailCaptureConfigPayload {
    let Some(raw) = config.email_capture_config.as_ref() else {
        return EmailCaptureConfigPayload::default();
    };
    serde_json::from_str::<EmailCaptureConfigPayload>(raw)
        .map(normalize_email_capture_payload)
        .unwrap_or_default()
}

fn email_capture_state_path(app: &tauri::AppHandle) -> PathBuf {
    get_data_dir(app).join(EMAIL_CAPTURE_STATE_FILE_NAME)
}

fn read_email_capture_state(app: &tauri::AppHandle) -> EmailCaptureState {
    let path = email_capture_state_path(app);
    let Ok(content) = fs::read_to_string(&path) else {
        return EmailCaptureState::default();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn write_email_capture_state(
    app: &tauri::AppHandle,
    state: &EmailCaptureState,
) -> Result<(), String> {
    let path = email_capture_state_path(app);
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid email capture state path".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let payload = serde_json::to_string(state).map_err(|e| e.to_string())?;
    let temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    fs::write(temp.path(), payload).map_err(|e| e.to_string())?;
    temp.persist(&path).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_email_capture_password(app: &tauri::AppHandle, config: &AppConfigToml) -> Option<String> {
    match get_keyring_secret(app, KEYRING_EMAIL_CAPTURE_PASSWORD) {
        Ok(Some(value)) => Some(value),
        _ => config.email_capture_password.clone(),
    }
}

/// Pick which UIDs to fetch, oldest first, bounded by `limit`.
///
/// When the mailbox `UIDVALIDITY` matches the stored state, only UIDs above the
/// last-seen watermark are new. On a validity change (or first run) every UID is
/// a candidate again and the seen Message-ID set is the only dedupe layer.
pub(crate) fn select_new_uids(
    candidates: impl IntoIterator<Item = u32>,
    state: &EmailCaptureState,
    mailbox_uid_validity: u32,
    limit: usize,
) -> (Vec<u32>, bool) {
    let same_generation = state.uid_validity == Some(mailbox_uid_validity);
    let mut uids: Vec<u32> = candidates
        .into_iter()
        .filter(|uid| !same_generation || *uid > state.last_seen_uid)
        .collect();
    uids.sort_unstable();
    uids.dedup();
    let has_more = uids.len() > limit;
    uids.truncate(limit);
    (uids, has_more)
}

/// Advance the dedupe state after the frontend confirmed the fetched batch was
/// durably persisted as tasks. The UID watermark only moves forward within the
/// same UIDVALIDITY generation; Message-IDs are capped to a recent window.
pub(crate) fn merge_email_capture_state(
    mut state: EmailCaptureState,
    uid_validity: u32,
    processed_max_uid: u32,
    message_ids: Vec<String>,
) -> EmailCaptureState {
    if state.uid_validity == Some(uid_validity) {
        state.last_seen_uid = state.last_seen_uid.max(processed_max_uid);
    } else {
        state.uid_validity = Some(uid_validity);
        state.last_seen_uid = processed_max_uid;
    }
    for id in message_ids {
        let trimmed = id.trim().to_string();
        if trimmed.is_empty() || state.seen_message_ids.contains(&trimmed) {
            continue;
        }
        state.seen_message_ids.push(trimmed);
    }
    if state.seen_message_ids.len() > EMAIL_CAPTURE_SEEN_MESSAGE_ID_LIMIT {
        let excess = state.seen_message_ids.len() - EMAIL_CAPTURE_SEEN_MESSAGE_ID_LIMIT;
        state.seen_message_ids.drain(0..excess);
    }
    state
}

fn truncate_chars(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_string();
    }
    let mut truncated: String = value.chars().take(limit).collect();
    truncated.push('…');
    truncated
}

pub(crate) fn build_email_capture_message(
    uid: u32,
    uid_validity: u32,
    raw: &[u8],
) -> EmailCaptureMessage {
    let parsed = MessageParser::default().parse(raw);
    let (message_id, subject, from, received_at, body_text) = match parsed.as_ref() {
        Some(message) => {
            let message_id = message
                .message_id()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| format!("uid:{uid_validity}:{uid}"));
            let subject = message
                .subject()
                .map(|value| value.trim().to_string())
                .unwrap_or_default();
            let from = message
                .from()
                .and_then(|address| address.first())
                .map(|addr| {
                    let name = addr
                        .name
                        .as_deref()
                        .map(str::trim)
                        .unwrap_or_default()
                        .to_string();
                    let email = addr
                        .address
                        .as_deref()
                        .map(str::trim)
                        .unwrap_or_default()
                        .to_string();
                    if name.is_empty() {
                        email
                    } else if email.is_empty() {
                        name
                    } else {
                        format!("{name} <{email}>")
                    }
                })
                .unwrap_or_default();
            let received_at = message.date().map(|value| value.to_rfc3339());
            let body_text = message
                .body_text(0)
                .map(|value| value.trim().to_string())
                .unwrap_or_default();
            (message_id, subject, from, received_at, body_text)
        }
        None => (
            format!("uid:{uid_validity}:{uid}"),
            String::new(),
            String::new(),
            None,
            String::new(),
        ),
    };
    EmailCaptureMessage {
        uid,
        message_id,
        subject,
        from,
        received_at,
        body_text: truncate_chars(&body_text, EMAIL_CAPTURE_BODY_CHAR_LIMIT),
    }
}

type EmailSession = imap::Session<TlsStream<TcpStream>>;

fn open_email_session(
    config: &EmailCaptureConfigPayload,
    password: &str,
) -> Result<EmailSession, EmailCaptureError> {
    let addrs: Vec<_> = (config.host.as_str(), config.port)
        .to_socket_addrs()
        .map_err(|error| EmailCaptureError::network(error.to_string()))?
        .collect();
    if addrs.is_empty() {
        return Err(EmailCaptureError::network(format!(
            "Could not resolve {}",
            config.host
        )));
    }
    let mut stream: Option<TcpStream> = None;
    let mut last_error: Option<std::io::Error> = None;
    for addr in addrs {
        match TcpStream::connect_timeout(&addr, EMAIL_CAPTURE_CONNECT_TIMEOUT) {
            Ok(connected) => {
                stream = Some(connected);
                break;
            }
            Err(error) => last_error = Some(error),
        }
    }
    let stream = stream.ok_or_else(|| {
        EmailCaptureError::network(
            last_error
                .map(|error| error.to_string())
                .unwrap_or_else(|| "Connection failed".to_string()),
        )
    })?;
    stream
        .set_read_timeout(Some(EMAIL_CAPTURE_IO_TIMEOUT))
        .map_err(|error| EmailCaptureError::network(error.to_string()))?;
    stream
        .set_write_timeout(Some(EMAIL_CAPTURE_IO_TIMEOUT))
        .map_err(|error| EmailCaptureError::network(error.to_string()))?;

    let connector = TlsConnector::builder()
        .build()
        .map_err(|error| EmailCaptureError::network(error.to_string()))?;
    let tls_stream = connector
        .connect(config.host.as_str(), stream)
        .map_err(|error| EmailCaptureError::network(error.to_string()))?;
    let mut client = imap::Client::new(tls_stream);
    client
        .read_greeting()
        .map_err(|error| classify_imap_error(error, "network"))?;
    client
        .login(config.username.as_str(), password)
        .map_err(|(error, _)| classify_imap_error(error, "auth"))
}

/// Login + folder round-trip used before persisting an enabled config. Creates
/// the capture folder when it does not exist yet, so setup stays one step.
fn verify_email_capture_connection(
    config: &EmailCaptureConfigPayload,
    password: &str,
) -> Result<(), EmailCaptureError> {
    let mut session = open_email_session(config, password)?;
    let examined = session.examine(config.folder.as_str());
    let result = match examined {
        Ok(_) => Ok(()),
        Err(imap::error::Error::No(_)) => session
            .create(config.folder.as_str())
            .and_then(|_| session.examine(config.folder.as_str()).map(|_| ()))
            .map_err(|error| classify_imap_error(error, "folder")),
        Err(error) => Err(classify_imap_error(error, "folder")),
    };
    let _ = session.logout();
    result
}

fn email_capture_status(
    config: &EmailCaptureConfigPayload,
    has_password: bool,
) -> Result<Value, String> {
    let mut status = serde_json::to_value(config).map_err(|e| e.to_string())?;
    if let Some(object) = status.as_object_mut() {
        object.insert("hasPassword".to_string(), Value::Bool(has_password));
    }
    Ok(status)
}

#[tauri::command]
pub(crate) fn get_email_capture_config(app: tauri::AppHandle) -> Result<Value, String> {
    let config = read_config(&app);
    let payload = read_email_capture_payload(&config);
    let has_password = read_email_capture_password(&app, &config).is_some();
    email_capture_status(&payload, has_password)
}

#[tauri::command]
pub(crate) fn set_email_capture_config(
    app: tauri::AppHandle,
    config: Value,
    password: Option<String>,
) -> Result<Value, EmailCaptureError> {
    let payload = serde_json::from_value::<EmailCaptureConfigPayload>(config)
        .map(normalize_email_capture_payload)
        .map_err(|error| EmailCaptureError::config(format!("Invalid email settings: {error}")))?;

    let mut app_config = read_config(&app);
    let next_password = password
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if payload.host.is_empty() {
        // Clearing the host removes the account, matching the WebDAV behavior.
        app_config.email_capture_config = None;
        app_config.email_capture_password = None;
        let _ = set_keyring_secret(&app, KEYRING_EMAIL_CAPTURE_PASSWORD, None);
        write_config_files(&get_config_path(&app), &get_secrets_path(&app), &app_config)
            .map_err(EmailCaptureError::other)?;
        let _ = fs::remove_file(email_capture_state_path(&app));
        return email_capture_status(&EmailCaptureConfigPayload::default(), false)
            .map_err(EmailCaptureError::other);
    }

    let effective_password = next_password
        .clone()
        .or_else(|| read_email_capture_password(&app, &app_config));

    let mut payload = payload;
    let mut validation_error: Option<EmailCaptureError> = None;
    if payload.enabled {
        let Some(ref current_password) = effective_password else {
            return Err(EmailCaptureError::config(
                "An app password is required to enable email capture.",
            ));
        };
        // Never persist an enabled capture config before one successful
        // login + folder round-trip.
        if let Err(error) = verify_email_capture_connection(&payload, current_password) {
            payload.enabled = false;
            validation_error = Some(error);
        }
    }

    if let Some(next_password) = next_password {
        match set_keyring_secret(
            &app,
            KEYRING_EMAIL_CAPTURE_PASSWORD,
            Some(next_password.clone()),
        ) {
            Ok(_) => {
                app_config.email_capture_password = None;
            }
            Err(_) => {
                app_config.email_capture_password = Some(next_password);
                let message = "Email app password stored in plaintext because the system keyring is unavailable.";
                if let Err(error) = app.emit("keyring-fallback-warning", message) {
                    log::warn!("Failed to emit keyring fallback warning: {error}");
                }
            }
        }
    }

    app_config.email_capture_config = Some(
        serde_json::to_string(&payload)
            .map_err(|error| EmailCaptureError::other(error.to_string()))?,
    );
    write_config_files(&get_config_path(&app), &get_secrets_path(&app), &app_config)
        .map_err(EmailCaptureError::other)?;

    if let Some(error) = validation_error {
        return Err(error);
    }
    let has_password = effective_password.is_some();
    email_capture_status(&payload, has_password).map_err(EmailCaptureError::other)
}

#[tauri::command]
pub(crate) fn email_capture_poll(
    app: tauri::AppHandle,
) -> Result<EmailCapturePollResult, EmailCaptureError> {
    let app_config = read_config(&app);
    let payload = read_email_capture_payload(&app_config);
    if !payload.enabled {
        return Err(EmailCaptureError::config("Email capture is disabled."));
    }
    let password = read_email_capture_password(&app, &app_config)
        .ok_or_else(|| EmailCaptureError::auth("No app password is stored."))?;
    let state = read_email_capture_state(&app);

    let mut session = open_email_session(&payload, &password)?;
    let result = poll_mailbox(&mut session, &payload, &state);
    let _ = session.logout();
    result
}

fn poll_mailbox(
    session: &mut EmailSession,
    payload: &EmailCaptureConfigPayload,
    state: &EmailCaptureState,
) -> Result<EmailCapturePollResult, EmailCaptureError> {
    // EXAMINE opens the folder read-only, so polling can never mutate flags
    // or move the user's mail.
    let mailbox = session
        .examine(payload.folder.as_str())
        .map_err(|error| classify_imap_error(error, "folder"))?;
    let uid_validity = mailbox.uid_validity.unwrap_or(0);

    let query = if state.uid_validity == Some(uid_validity) && state.last_seen_uid > 0 {
        format!("UID {}:*", state.last_seen_uid.saturating_add(1))
    } else {
        "ALL".to_string()
    };
    let candidates = session
        .uid_search(&query)
        .map_err(|error| classify_imap_error(error, "other"))?;
    let (uids, has_more) =
        select_new_uids(candidates, state, uid_validity, EMAIL_CAPTURE_BATCH_LIMIT);

    let mut messages = Vec::new();
    let mut max_fetched_uid = 0;
    if !uids.is_empty() {
        let set = uids
            .iter()
            .map(|uid| uid.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let fetches = session
            .uid_fetch(set, "(UID BODY.PEEK[])")
            .map_err(|error| classify_imap_error(error, "other"))?;
        for fetch in fetches.iter() {
            let Some(uid) = fetch.uid else { continue };
            max_fetched_uid = max_fetched_uid.max(uid);
            let Some(raw) = fetch.body() else { continue };
            let message = build_email_capture_message(uid, uid_validity, raw);
            if state.seen_message_ids.contains(&message.message_id) {
                continue;
            }
            messages.push(message);
        }
        messages.sort_by_key(|message| message.uid);
    }

    Ok(EmailCapturePollResult {
        uid_validity,
        messages,
        max_fetched_uid,
        has_more,
    })
}

#[tauri::command]
pub(crate) fn email_capture_commit(
    app: tauri::AppHandle,
    uid_validity: u32,
    last_seen_uid: u32,
    message_ids: Vec<String>,
) -> Result<(), String> {
    let state = read_email_capture_state(&app);
    let next = merge_email_capture_state(state, uid_validity, last_seen_uid, message_ids);
    write_email_capture_state(&app, &next)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Exercises the real DNS + TCP + TLS + greeting + LOGIN stack against a
    // public server. Ignored by default because it needs network access:
    // `cargo test --lib email_capture -- --ignored`
    #[test]
    #[ignore = "hits the public network"]
    fn live_imap_login_failure_classifies_as_auth() {
        let config = EmailCaptureConfigPayload {
            enabled: true,
            host: "imap.gmail.com".to_string(),
            port: 993,
            username: "mindwtr-smoke-test@gmail.com".to_string(),
            folder: default_email_capture_folder(),
        };
        let error = open_email_session(&config, "not-a-real-password")
            .err()
            .expect("login with bogus credentials must fail");
        assert_eq!(error.kind, "auth", "unexpected error: {error:?}");
    }

    fn state(uid_validity: Option<u32>, last_seen_uid: u32, ids: &[&str]) -> EmailCaptureState {
        EmailCaptureState {
            uid_validity,
            last_seen_uid,
            seen_message_ids: ids.iter().map(|id| id.to_string()).collect(),
        }
    }

    #[test]
    fn normalize_defaults_port_and_folder_and_requires_host_for_enabled() {
        let normalized = normalize_email_capture_payload(EmailCaptureConfigPayload {
            enabled: true,
            host: "  imap.example.com  ".to_string(),
            port: 0,
            username: " user@example.com ".to_string(),
            folder: "   ".to_string(),
        });
        assert!(normalized.enabled);
        assert_eq!(normalized.host, "imap.example.com");
        assert_eq!(normalized.port, EMAIL_CAPTURE_DEFAULT_PORT);
        assert_eq!(normalized.username, "user@example.com");
        assert_eq!(normalized.folder, EMAIL_CAPTURE_DEFAULT_FOLDER);

        let disabled = normalize_email_capture_payload(EmailCaptureConfigPayload {
            enabled: true,
            host: String::new(),
            port: 993,
            username: "user".to_string(),
            folder: "Mindwtr".to_string(),
        });
        assert!(!disabled.enabled);
    }

    #[test]
    fn select_new_uids_filters_by_watermark_within_same_generation() {
        let state = state(Some(7), 40, &[]);
        let (uids, has_more) = select_new_uids(vec![41, 39, 40, 45, 42], &state, 7, 25);
        assert_eq!(uids, vec![41, 42, 45]);
        assert!(!has_more);
    }

    #[test]
    fn select_new_uids_rescans_on_uidvalidity_change() {
        let state = state(Some(7), 40, &[]);
        let (uids, has_more) = select_new_uids(vec![10, 2], &state, 8, 25);
        assert_eq!(uids, vec![2, 10]);
        assert!(!has_more);
    }

    #[test]
    fn select_new_uids_caps_batch_and_reports_more() {
        let state = state(None, 0, &[]);
        let (uids, has_more) = select_new_uids(1..=30, &state, 5, 3);
        assert_eq!(uids, vec![1, 2, 3]);
        assert!(has_more);
    }

    #[test]
    fn merge_state_advances_watermark_only_forward() {
        let merged =
            merge_email_capture_state(state(Some(5), 90, &["a"]), 5, 42, vec!["b".to_string()]);
        assert_eq!(merged.last_seen_uid, 90);
        assert_eq!(merged.seen_message_ids, vec!["a", "b"]);
    }

    #[test]
    fn merge_state_resets_watermark_on_new_generation() {
        let merged = merge_email_capture_state(state(Some(5), 90, &["a"]), 6, 3, vec![]);
        assert_eq!(merged.uid_validity, Some(6));
        assert_eq!(merged.last_seen_uid, 3);
        assert_eq!(merged.seen_message_ids, vec!["a"]);
    }

    #[test]
    fn merge_state_caps_seen_message_ids() {
        let existing: Vec<String> = (0..EMAIL_CAPTURE_SEEN_MESSAGE_ID_LIMIT)
            .map(|index| format!("id-{index}"))
            .collect();
        let merged = merge_email_capture_state(
            EmailCaptureState {
                uid_validity: Some(1),
                last_seen_uid: 10,
                seen_message_ids: existing,
            },
            1,
            11,
            vec!["fresh".to_string(), "fresh".to_string()],
        );
        assert_eq!(
            merged.seen_message_ids.len(),
            EMAIL_CAPTURE_SEEN_MESSAGE_ID_LIMIT
        );
        assert_eq!(
            merged.seen_message_ids.first().map(String::as_str),
            Some("id-1")
        );
        assert_eq!(
            merged.seen_message_ids.last().map(String::as_str),
            Some("fresh")
        );
    }

    #[test]
    fn build_message_extracts_subject_from_and_text_body() {
        let raw = concat!(
            "Message-ID: <abc-123@example.com>\r\n",
            "From: Jane Doe <jane@example.com>\r\n",
            "To: capture@example.com\r\n",
            "Subject: =?utf-8?q?Renew_passport?=\r\n",
            "Date: Tue, 14 Jul 2026 08:30:00 +0000\r\n",
            "Content-Type: text/plain; charset=utf-8\r\n",
            "\r\n",
            "Bring the old passport and two photos.\r\n",
        );
        let message = build_email_capture_message(12, 7, raw.as_bytes());
        assert_eq!(message.uid, 12);
        assert_eq!(message.message_id, "abc-123@example.com");
        assert_eq!(message.subject, "Renew passport");
        assert_eq!(message.from, "Jane Doe <jane@example.com>");
        assert_eq!(message.body_text, "Bring the old passport and two photos.");
        assert!(message.received_at.is_some());
    }

    #[test]
    fn build_message_converts_html_only_mail_to_text() {
        let raw = concat!(
            "From: sender@example.com\r\n",
            "Subject: Weekly report\r\n",
            "Content-Type: text/html; charset=utf-8\r\n",
            "\r\n",
            "<html><body><p>Numbers are <b>up</b>.</p></body></html>\r\n",
        );
        let message = build_email_capture_message(3, 7, raw.as_bytes());
        assert_eq!(message.subject, "Weekly report");
        assert!(message.body_text.contains("Numbers are up"));
        assert!(!message.body_text.contains('<'));
        // No Message-ID header: falls back to a UID-scoped synthetic id.
        assert_eq!(message.message_id, "uid:7:3");
    }

    #[test]
    fn build_message_truncates_very_long_bodies() {
        let body = "x".repeat(EMAIL_CAPTURE_BODY_CHAR_LIMIT + 100);
        let raw = format!(
            "From: a@example.com\r\nSubject: Long\r\nContent-Type: text/plain\r\n\r\n{body}"
        );
        let message = build_email_capture_message(1, 1, raw.as_bytes());
        assert_eq!(
            message.body_text.chars().count(),
            EMAIL_CAPTURE_BODY_CHAR_LIMIT + 1
        );
        assert!(message.body_text.ends_with('…'));
    }
}
