use aes_gcm::aead::rand_core::RngCore;
/// Cryptography for App Sync.
///
/// Bundle encryption:  PBKDF2-HMAC-SHA256 (600 000 iterations) → AES-256-GCM
/// Wire format:        [salt:16][iv:12][ciphertext+tag]
///
/// Link-code payload:  JSON → same AES-256-GCM with the same passphrase
/// Wire format:        base64url(same layout as bundle)
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use pbkdf2::pbkdf2_hmac;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

const SALT_LEN: usize = 16;
const IV_LEN: usize = 12;
const PBKDF2_ROUNDS: u32 = 600_000;

fn derive_key(passphrase: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), salt, PBKDF2_ROUNDS, &mut key);
    key
}

/// Encrypt `plaintext` with `passphrase`. Returns `[salt:16][iv:12][ciphertext+tag]`.
pub fn encrypt(passphrase: &str, plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut iv = [0u8; IV_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut iv);

    let key_bytes = derive_key(passphrase, &salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&iv);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("encryption failed: {e}"))?;

    let mut out = Vec::with_capacity(SALT_LEN + IV_LEN + ciphertext.len());
    out.extend_from_slice(&salt);
    out.extend_from_slice(&iv);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypt `data` (format: `[salt:16][iv:12][ciphertext+tag]`) with `passphrase`.
pub fn decrypt(passphrase: &str, data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < SALT_LEN + IV_LEN + 16 {
        return Err("data too short to be a valid encrypted bundle".to_string());
    }

    let salt = &data[..SALT_LEN];
    let iv = &data[SALT_LEN..SALT_LEN + IV_LEN];
    let ciphertext = &data[SALT_LEN + IV_LEN..];

    let key_bytes = derive_key(passphrase, salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(iv);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "decryption failed — wrong passphrase or corrupted data".to_string())
}

// ── Link Code ─────────────────────────────────────────────────────────────────

/// Payload embedded in a link code.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkCodePayload {
    pub v: u8,
    pub provider_type: String,
    pub url: String,
    pub user: String,
    pub pass: String,
    pub path: String,
}

/// Encode a link code: encrypt the JSON payload and base64url it.
pub fn encode_link_code(passphrase: &str, payload: &LinkCodePayload) -> Result<String, String> {
    let json = serde_json::to_vec(payload).map_err(|e| e.to_string())?;
    let encrypted = encrypt(passphrase, &json)?;
    Ok(URL_SAFE_NO_PAD.encode(&encrypted))
}

/// Decode a link code: base64url-decode then decrypt.
pub fn decode_link_code(passphrase: &str, code: &str) -> Result<LinkCodePayload, String> {
    let encrypted = URL_SAFE_NO_PAD
        .decode(code)
        .map_err(|e| format!("invalid link code format: {e}"))?;
    let json = decrypt(passphrase, &encrypted)?;
    serde_json::from_slice(&json).map_err(|e| format!("link code payload corrupt: {e}"))
}

// ── Keychain helpers ──────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE: &str = "tasky-app-sync";

/// Store a secret in the OS keychain.
pub fn keychain_set(key: &str, secret: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, key)
        .map_err(|e| format!("keychain entry error: {e}"))?;
    entry
        .set_password(secret)
        .map_err(|e| format!("keychain write error: {e}"))
}

/// Retrieve a secret from the OS keychain. Returns `None` if not found.
pub fn keychain_get(key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, key)
        .map_err(|e| format!("keychain entry error: {e}"))?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keychain read error: {e}")),
    }
}

/// Delete a secret from the OS keychain.
pub fn keychain_delete(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, key)
        .map_err(|e| format!("keychain entry error: {e}"))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keychain delete error: {e}")),
    }
}

/// Keychain key for the sync passphrase.
pub const PASSPHRASE_KEY: &str = "passphrase";

/// Keychain key for an account's password. One entry per account ID.
pub fn account_password_key(account_id: &str) -> String {
    format!("account-{account_id}")
}
