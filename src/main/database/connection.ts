// ============================================================================
// ThreadMed — SQLite Database Connection (better-sqlite3)
// ============================================================================
// Uses better-sqlite3 for synchronous, high-performance SQLite access.
// The database is stored inside the active .tdmd project directory.
// FTS5 is natively supported via better-sqlite3.
// ============================================================================

import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import Database from 'better-sqlite3'
import { runSchema } from './schema'
import { setupFts } from './fts'

let db: Database.Database | null = null
let activeProjectDir: string | null = null

/** Returns the path to the SQLite database file in the active project */
export function getDbPath(): string {
    if (!activeProjectDir) throw new Error('No project is open.')
    return join(activeProjectDir, 'threadmed.db')
}

/** Returns the directory where PDFs are stored for the active project */
export function getPdfDir(): string {
    if (!activeProjectDir) throw new Error('No project is open.')
    const pdfDir = join(activeProjectDir, 'pdfs')
    if (!existsSync(pdfDir)) {
        mkdirSync(pdfDir, { recursive: true })
    }
    return pdfDir
}

/** Returns the active project directory path */
export function getActiveProjectDir(): string | null {
    return activeProjectDir
}

/** Initialize the database connection for a given project directory and run migrations */
export function initDatabase(projectDir: string): void {
    // Close any previously open database
    if (db) {
        closeDatabase()
    }

    activeProjectDir = projectDir

    const dbPath = join(projectDir, 'threadmed.db')

    // Ensure pdfs directory exists
    const pdfDir = join(projectDir, 'pdfs')
    if (!existsSync(pdfDir)) {
        mkdirSync(pdfDir, { recursive: true })
    }

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
        activeProjectDir = null
        console.log('[ThreadMed DB] Connection closed')
    }
}
