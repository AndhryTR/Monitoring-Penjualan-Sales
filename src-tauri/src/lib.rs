#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![ai_chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Deserialize)]
struct AiChatRequest {
    base_url: String,
    api_key: String,
    model: String,
    messages: serde_json::Value,
    #[serde(default)]
    json_mode: bool,
}

// Command AI chat via Rust (reqwest) — bebas CORS/CSP WebView.
// Frontend: invoke("ai_chat", { baseUrl, apiKey, model, messages, jsonMode }).
// Kembalikan body teks upstream apa adanya; error jujur per kasus.
#[tauri::command]
async fn ai_chat(req: AiChatRequest) -> Result<String, String> {
    let base = req.base_url.trim().trim_end_matches('/').to_string();
    if base.is_empty() {
        return Err("baseURL kosong — isi di setelan AI.".to_string());
    }
    if req.model.trim().is_empty() {
        return Err("model kosong — isi di setelan AI.".to_string());
    }
    let url = format!("{}/chat/completions", base);

    let mut body = serde_json::Map::new();
    body.insert("model".to_string(), serde_json::Value::String(req.model));
    body.insert("messages".to_string(), req.messages);
    body.insert("stream".to_string(), serde_json::Value::Bool(false));
    if req.json_mode {
        let mut fmt = serde_json::Map::new();
        fmt.insert("type".to_string(), serde_json::Value::String("json_object".to_string()));
        body.insert("response_format".to_string(), serde_json::Value::Object(fmt));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| format!("Gagal siapkan HTTP client: {}", e))?;

    let mut headers = reqwest::header::HeaderMap::new();
    if !req.api_key.trim().is_empty() {
        let value = format!("Bearer {}", req.api_key.trim());
        headers.insert(
            reqwest::header::AUTHORIZATION,
            value.parse().map_err(|_| "API key tak valid.".to_string())?,
        );
    }

    let resp = tokio::time::timeout(
        std::time::Duration::from_secs(95),
        client.post(&url).headers(headers).json(&body).send(),
    )
    .await
    .map_err(|_| "Timeout 90 detik — server AI tak merespons.".to_string())?
    .map_err(|e| {
        if e.is_timeout() {
            "Timeout 90 detik — server AI tak merespons.".to_string()
        } else if e.is_connect() {
            format!("Base URL tak reachable: {}", url)
        } else {
            format!("Gagal hubungi server AI: {}", e)
        }
    })?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Gagal baca respons AI: {}", e))?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), text.chars().take(300).collect::<String>()));
    }
    if text.trim().is_empty() {
        return Err("Respons kosong dari server AI — request tak sampai ke provider.".to_string());
    }
    Ok(text)
}
