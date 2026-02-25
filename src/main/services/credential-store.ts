// ============================================================================
// ThreadMed — Credential Store (Electron safeStorage)
// ============================================================================
// Encrypts sensitive credentials (Zotero API key) using Electron's safeStorage
// API, which delegates to the OS keychain (DPAPI on Windows, Keychain on
// macOS, libsecret on Linux). The encrypted blob is stored in sync_meta as
// a base64 string — useless without the OS-level decryption key.
//
// SECURITY MODEL:
// - API key is encrypted at rest (never stored in plaintext in the DB)
// - API key is NEVER sent to the renderer process
// - API key only exists in plaintext in main-process memory during sync
// - User ID is non-sensitive metadata (stored in plaintext)
// ============================================================================

import { safeStorage } from 'electron'
import { getDb } from '../database/connection'

// ── sync_meta helpers ────────────────────────────────────────────────────────

function getSyncMeta(key: string): string | null {
    const db = getDb()
    const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
}

function setSyncMeta(key: string, value: string): void {
    const db = getDb()
    db.prepare(
        'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    ).run(key, value, value)
}

function deleteSyncMeta(key: string): void {
    const db = getDb()
    db.prepare('DELETE FROM sync_meta WHERE key = ?').run(key)
}

// ── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string using Electron's safeStorage.
 * Returns a base64-encoded encrypted blob.
 * Falls back to plaintext ONLY if safeStorage is unavailable (Linux without
 * a keyring — extremely rare).
 */
function encryptString(plaintext: string): string {
    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(plaintext)
        return encrypted.toString('base64')
    }
    console.warn('[Credentials] safeStorage unavailable — storing with basic obfuscation')
    // Fallback: base64 encode (NOT secure, but better than raw plaintext)
    return `UNSAFE:${Buffer.from(plaintext).toString('base64')}`
}

/**
 * Decrypt a base64-encoded blob back to plaintext.
 * Handles both safeStorage-encrypted and fallback-encoded values.
 */
function decryptString(stored: string): string {
    if (stored.startsWith('UNSAFE:')) {
        // Fallback-encoded value
        return Buffer.from(stored.slice(7), 'base64').toString('utf-8')
    }
    if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(stored, 'base64')
        return safeStorage.decryptString(buffer)
    }
    throw new Error('Cannot decrypt credential: safeStorage is not available')
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Store an encrypted API key */
export function storeApiKey(apiKey: string): void {
    const encrypted = encryptString(apiKey)
    setSyncMeta('zotero_api_key_enc', encrypted)
    // Remove any legacy plaintext key
    deleteSyncMeta('zotero_api_key')
}

/** Retrieve and decrypt the API key (main process only) */
export function retrieveApiKey(): string | null {
    const encrypted = getSyncMeta('zotero_api_key_enc')
    if (!encrypted) {
        // Check for legacy plaintext key and migrate it
        const legacy = getSyncMeta('zotero_api_key')
        if (legacy) {
            console.log('[Credentials] Migrating legacy plaintext API key to encrypted storage')
            storeApiKey(legacy)
            deleteSyncMeta('zotero_api_key')
            return legacy
        }
        return null
    }
    try {
        return decryptString(encrypted)
    } catch (err) {
        console.error('[Credentials] Failed to decrypt API key:', err)
        return null
    }
}

/** Clear the stored API key */
export function clearApiKey(): void {
    deleteSyncMeta('zotero_api_key_enc')
    deleteSyncMeta('zotero_api_key') // remove legacy too
}

/** Store/retrieve non-sensitive sync metadata */
export { getSyncMeta, setSyncMeta, deleteSyncMeta }
