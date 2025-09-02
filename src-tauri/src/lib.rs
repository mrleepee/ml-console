use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest::header::{AUTHORIZATION, WWW_AUTHENTICATE};

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpRequest {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub success: bool,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn generate_digest_auth(username: &str, password: &str, method: &str, url: &str, www_auth: &str) -> Result<String, String> {
    use std::collections::HashMap;
    
    // Parse the digest challenge
    let mut challenge = HashMap::new();
    let auth_str = www_auth.replace("Digest ", "");
    
    for part in auth_str.split(',') {
        let part = part.trim();
        if let Some((key, value)) = part.split_once('=') {
            let key = key.trim();
            let value = value.trim().trim_matches('"');
            challenge.insert(key, value);
        }
    }
    
    let realm = challenge.get("realm").unwrap_or(&"");
    let nonce = challenge.get("nonce").unwrap_or(&"");
    let qop = challenge.get("qop").unwrap_or(&"");
    
    // Parse URL to get path
    let url_obj = url::Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;
    let mut uri = url_obj.path().to_string();
    if let Some(query) = url_obj.query() {
        uri = format!("{}?{}", uri, query);
    }
    
    // Generate cnonce and nc
    let cnonce = format!("{:x}", rand::random::<u64>());
    let nc = "00000001";
    
    // Calculate HA1
    let ha1_input = format!("{}:{}:{}", username, realm, password);
    let ha1 = format!("{:x}", md5::compute(ha1_input.as_bytes()));
    
    // Calculate HA2
    let ha2_input = format!("{}:{}", method, uri);
    let ha2 = format!("{:x}", md5::compute(ha2_input.as_bytes()));
    
    // Calculate response
    let response = if !qop.is_empty() {
        let response_input = format!("{}:{}:{}:{}:{}:{}", ha1, nonce, nc, cnonce, qop, ha2);
        format!("{:x}", md5::compute(response_input.as_bytes()))
    } else {
        let response_input = format!("{}:{}:{}", ha1, nonce, ha2);
        format!("{:x}", md5::compute(response_input.as_bytes()))
    };
    
    // Build Authorization header
    let mut auth_header = format!(
        r#"Digest username="{}", realm="{}", nonce="{}", uri="{}", response="{}""#,
        username, realm, nonce, uri, response
    );
    
    if !qop.is_empty() {
        auth_header.push_str(&format!(r#", qop={}, nc={}, cnonce="{}""#, qop, nc, cnonce));
    }
    
    if let Some(opaque) = challenge.get("opaque") {
        auth_header.push_str(&format!(r#", opaque="{}""#, opaque));
    }
    
    Ok(auth_header)
}

#[tauri::command]
async fn http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let client = reqwest::Client::new();
    
    let mut req_builder = match request.method.to_uppercase().as_str() {
        "GET" => client.get(&request.url),
        "POST" => client.post(&request.url),
        "PUT" => client.put(&request.url),
        "DELETE" => client.delete(&request.url),
        _ => return Err(format!("Unsupported HTTP method: {}", request.method)),
    };

    // Add headers
    if let Some(headers) = request.headers {
        for (key, value) in headers {
            req_builder = req_builder.header(&key, &value);
        }
    }

    // Add body before attempting authentication so the challenge request
    // matches the actual request the server will receive. Some endpoints
    // (like MarkLogic's evaler.xqy) require a POST body even for the
    // initial 401 challenge.
    if let Some(body) = request.body {
        req_builder = req_builder.body(body);
    }

    // Handle authentication - try digest first, fallback to basic
    if let (Some(username), Some(password)) = (request.username, request.password) {
        // First, make a request without auth to get the challenge
        let challenge_response = req_builder.try_clone().unwrap().send().await;
        
        if let Ok(response) = challenge_response {
            if response.status() == 401 {
                // Check for digest challenge
                if let Some(www_auth) = response.headers().get(WWW_AUTHENTICATE) {
                    if let Ok(auth_str) = www_auth.to_str() {
                        if auth_str.starts_with("Digest") {
                            // Parse digest challenge and generate response
                            if let Ok(digest_auth) = generate_digest_auth(&username, &password, &request.method, &request.url, auth_str) {
                                req_builder = req_builder.header(AUTHORIZATION, digest_auth);
                            }
                        }
                    }
                }
            }
        } else {
            // If challenge request fails, fallback to basic auth
            req_builder = req_builder.basic_auth(&username, Some(&password));
        }
    }

    match req_builder.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let headers: HashMap<String, String> = response
                .headers()
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect();
            
            let body = match response.text().await {
                Ok(text) => text,
                Err(e) => return Err(format!("Failed to read response body: {}", e)),
            };

            // Add CORS headers for browser compatibility
            let mut response_headers = headers;
            response_headers.insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
            response_headers.insert("Access-Control-Allow-Methods".to_string(), "GET, POST, OPTIONS".to_string());
            response_headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type".to_string());

            Ok(HttpResponse {
                status,
                headers: response_headers,
                body,
                success: status >= 200 && status < 300,
            })
        }
        Err(e) => Err(format!("HTTP request failed: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())

        .invoke_handler(tauri::generate_handler![greet, http_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
