// ============================================================================
// ThreadMed — SQLite Database Connection (better-sqlite3)
// ============================================================================
// Uses better-sqlite3 for synchronous, high-performance SQLite access.
// The database is stored in Electron's userData directory.
// FTS5 is natively supported via better-sqlite3.
// ============================================================================

import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import Database from 'better-sqlite3'
import { runSchema } from './schema'
import { setupFts } from './fts'

let db: Database.Database | null = null

/** Returns the path to the SQLite database file in Electron's userData dir */
export function getDbPath(): string {
    const userDataPath = app.getPath('userData')
    const dataDir = join(userDataPath, 'data')
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true })
    }
    return join(dataDir, 'threadmed.db')
}

/** Returns the directory where PDFs are stored */
export function getPdfDir(): string {
    const userDataPath = app.getPath('userData')
    const pdfDir = join(userDataPath, 'data', 'pdfs')
    if (!existsSync(pdfDir)) {
        mkdirSync(pdfDir, { recursive: true })
    }
    return pdfDir
}

/** Initialize the database connection and run migrations */
export function initDatabase(): void {
    if (db) return

    const dbPath = getDbPath()

    db = new Database(dbPath)

    // Performance pragmas
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('synchronous = NORMAL')

    // Run schema creation (idempotent — uses IF NOT EXISTS)
    runSchema(db)

    // Set up FTS5 virtual table and triggers
    setupFts(db)

    console.log('[ThreadMed DB] Initialized at:', dbPath)
}

/** Get the active database instance (throws if not initialized) */
export function getDb(): Database.Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.')
    }
    return db
}

/** Close the database connection gracefully */
export function closeDatabase(): void {
    if (db) {
        db.close()
        db = null
        console.log('[ThreadMed DB] Connection closed')
    }
}
