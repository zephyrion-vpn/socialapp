import { app, safeStorage } from "electron"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

export interface StoredSession {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt?: string
  refreshTokenExpiresAt?: string
}

/**
 * Tokens are encrypted with the OS keychain (DPAPI on Windows) before touching
 * the disk. If encryption is unavailable we keep them in memory only - we never
 * write credentials in plaintext, and passwords are never stored at all.
 */
let memorySession: StoredSession | null = null

function credentialsFile(): string {
  return path.join(app.getPath("userData"), "credentials.bin")
}

function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function readSession(): StoredSession | null {
  if (memorySession) return memorySession
  if (!encryptionAvailable()) return null

  try {
    const file = credentialsFile()
    if (!existsSync(file)) return null
    const decrypted = safeStorage.decryptString(readFileSync(file))
    const parsed = JSON.parse(decrypted) as StoredSession
    if (!parsed?.accessToken || !parsed?.refreshToken) return null
    memorySession = parsed
    return parsed
  } catch {
    // Corrupted or written by another OS user - drop it.
    clearSession()
    return null
  }
}

export function writeSession(session: StoredSession): void {
  if (!session?.accessToken || !session?.refreshToken) return
  memorySession = session

  if (!encryptionAvailable()) return
  try {
    const file = credentialsFile()
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, safeStorage.encryptString(JSON.stringify(session)))
  } catch {
    // Keeping the session in memory is an acceptable fallback.
  }
}

export function clearSession(): void {
  memorySession = null
  try {
    rmSync(credentialsFile(), { force: true })
  } catch {
    // ignore
  }
}
