// ============================================================================
// ThreadMed — Sync Engine
// ============================================================================
// Orchestrates the full Zotero → ThreadMed import pipeline:
// 1. Fetch metadata from Zotero API (paginated)
// 2. Upsert papers into SQLite
// 3. Download PDF attachments
// 4. Extract full text → FTS5 index
// Emits progress events to the renderer via IPC.
//
// SECURITY: API key is encrypted at rest via credential-store.ts and NEVER
// sent to the renderer process. Only the connection status (boolean) and
// user ID are exposed to the UI.
// ============================================================================

import { join } from 'path'
import { writeFileSync, existsSync } from 'fs'
import { BrowserWindow } from 'electron'
import { ZoteroClient, type ZoteroItem } from './zotero-client'
import { generatePdfFilename } from './pdf-namer'
import { extractTextFromPdf } from './pdf-extractor'
import {
    storeApiKey, retrieveApiKey, clearApiKey,
    getSyncMeta, setSyncMeta
} from './credential-store'
import { upsertPaper, updatePaperFullText } from '../database/repositories/papers'
import { getDb } from '../database/connection'
import { getPdfDir } from '../database/connection'

// ── Progress Emitter ─────────────────────────────────────────────────────────

interface SyncProgress {
    phase: 'metadata' | 'downloading' | 'extracting' | 'complete' | 'error'
    current: number
    total: number
    paperTitle?: string
    error?: string
}

function emitProgress(progress: SyncProgress): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
        win.webContents.send('zotero:sync-progress', progress)
    }
}

// ── Sync Status ──────────────────────────────────────────────────────────────

export interface ZoteroStatus {
    connected: boolean
    userId: string | null
    // NOTE: API key is NEVER included here — it must not reach the renderer
    lastSync: string | null
    libraryVersion: number | null
}

export function getZoteroStatus(): ZoteroStatus {
    const apiKey = retrieveApiKey()
    const userId = getSyncMeta('zotero_user_id')
    const lastSync = getSyncMeta('last_sync')
    const libVersion = getSyncMeta('library_version')

    return {
        connected: !!(apiKey && userId),
        userId,
        lastSync,
        libraryVersion: libVersion ? parseInt(libVersion, 10) : null
    }
}

// ── Connect / Disconnect ─────────────────────────────────────────────────────

export async function connectZotero(
    apiKey: string,
    userId: string
): Promise<{ valid: boolean; totalItems: number; error?: string }> {
    // Input validation
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return { valid: false, totalItems: 0, error: 'API key is required' }
    }
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        return { valid: false, totalItems: 0, error: 'User ID is required' }
    }
    // Sanitize: User ID should be numeric
    const sanitizedUserId = userId.trim()
    if (!/^\d+$/.test(sanitizedUserId)) {
        return { valid: false, totalItems: 0, error: 'User ID must be numeric' }
    }
    const sanitizedApiKey = apiKey.trim()

    const client = new ZoteroClient(sanitizedApiKey, sanitizedUserId)
    const result = await client.validateCredentials()

    if (result.valid) {
        // Store API key encrypted, user ID in plaintext (non-sensitive)
        storeApiKey(sanitizedApiKey)
        setSyncMeta('zotero_user_id', sanitizedUserId)
        console.log('[Sync] Connected to Zotero (credentials encrypted)')
    }

    // SECURITY: Never return the API key in the result
    return result
}

export function disconnectZotero(): void {
    clearApiKey()
    const db = getDb()
    db.prepare("DELETE FROM sync_meta WHERE key IN ('zotero_user_id', 'library_version', 'last_sync')").run()
    console.log('[Sync] Disconnected from Zotero (credentials cleared)')
}

// ── Sync Guard ───────────────────────────────────────────────────────────────

let isSyncing = false

// ── Main Sync ────────────────────────────────────────────────────────────────

export interface SyncResult {
    imported: number
    updated: number
    pdfsDownloaded: number
    errors: string[]
    libraryVersion: number
}

export async function syncLibrary(): Promise<SyncResult> {
    if (isSyncing) {
        return { imported: 0, updated: 0, pdfsDownloaded: 0, errors: ['Sync already in progress'], libraryVersion: 0 }
    }

    const apiKey = retrieveApiKey()
    const userId = getSyncMeta('zotero_user_id')

    if (!apiKey || !userId) {
        return { imported: 0, updated: 0, pdfsDownloaded: 0, errors: ['Not connected to Zotero'], libraryVersion: 0 }
    }

    isSyncing = true
    const result: SyncResult = { imported: 0, updated: 0, pdfsDownloaded: 0, errors: [], libraryVersion: 0 }

    try {
        const client = new ZoteroClient(apiKey, userId)
        const sinceVersion = parseInt(getSyncMeta('library_version') || '0', 10)

        // ── Phase 1: Fetch metadata ──────────────────────────────────────
        emitProgress({ phase: 'metadata', current: 0, total: 0 })
        console.log(`[Sync] Fetching items since version ${sinceVersion}...`)

        const items = await client.fetchItems(sinceVersion)
        console.log(`[Sync] Got ${items.length} items from Zotero`)

        // Filter to actual papers (journal articles, book sections, etc.)
        const papers = items.filter(item => {
            const t = item.data.itemType
            return t !== 'attachment' && t !== 'note' && t !== 'annotation'
        })

        // ── Phase 2: Upsert papers + download PDFs ───────────────────────
        const pdfDir = getPdfDir()

        for (let i = 0; i < papers.length; i++) {
            const item = papers[i]
            const title = item.data.title || 'Untitled'

            emitProgress({
                phase: 'downloading',
                current: i + 1,
                total: papers.length,
                paperTitle: title
            })

            try {
                const authors = ZoteroClient.extractAuthors(item.data.creators)
                const year = ZoteroClient.parseYear(item.data.date)

                // Check if this is a new paper or an update
                const db = getDb()
                const existing = db.prepare(
                    'SELECT id FROM papers WHERE zotero_key = ?'
                ).get(item.key) as { id: string } | undefined

                // Upsert the paper metadata
                const paperId = upsertPaper({
                    title,
                    year,
                    doi: item.data.DOI || null,
                    journal: item.data.publicationTitle || null,
                    abstract: item.data.abstractNote || null,
                    zotero_key: item.key,
                    zotero_version: item.version,
                    authors
                })

                if (existing) {
                    result.updated++
                } else {
                    result.imported++
                }

                // Download PDF attachment (if any)
                await downloadPdfForPaper(client, item, paperId, authors, year, pdfDir, result)

            } catch (err) {
                const errMsg = `Failed to import "${title}": ${err instanceof Error ? err.message : String(err)}`
                console.error(`[Sync] ${errMsg}`)
                result.errors.push(errMsg)
            }
        }

        // ── Phase 3: Extract text from new PDFs ──────────────────────────
        await extractTextForNewPapers(result)

        // ── Save sync cursor ─────────────────────────────────────────────
        result.libraryVersion = client.lastLibraryVersion
        setSyncMeta('library_version', String(client.lastLibraryVersion))
        setSyncMeta('last_sync', new Date().toISOString())

        emitProgress({ phase: 'complete', current: papers.length, total: papers.length })
        console.log(`[Sync] Complete: ${result.imported} new, ${result.updated} updated, ${result.pdfsDownloaded} PDFs`)

    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[Sync] Fatal error:', errMsg)
        result.errors.push(errMsg)
        emitProgress({ phase: 'error', current: 0, total: 0, error: errMsg })
    } finally {
        isSyncing = false
    }

    return result
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function downloadPdfForPaper(
    client: ZoteroClient,
    parentItem: ZoteroItem,
    paperId: string,
    authors: string[],
    year: number | null,
    pdfDir: string,
    result: SyncResult
): Promise<void> {
    try {
        // Find PDF attachment among children
        const children = await client.fetchChildItems(parentItem.key)
        const pdfAttachment = children.find(
            child => child.data.itemType === 'attachment' &&
                child.data.contentType === 'application/pdf' &&
                child.data.linkMode !== 'linked_url'
        )

        if (!pdfAttachment) return

        // Generate filename and check if already downloaded
        const filename = generatePdfFilename(authors, year, pdfDir)
        const pdfPath = join(pdfDir, filename)

        // Check if we already have this PDF (by checking the database record)
        const db = getDb()
        const existingPdf = db.prepare(
            'SELECT pdf_filename FROM papers WHERE id = ?'
        ).get(paperId) as { pdf_filename: string | null } | undefined

        if (existingPdf?.pdf_filename && existsSync(join(pdfDir, existingPdf.pdf_filename))) {
            // Already downloaded, skip
            return
        }

        // Download the file
        const pdfBuffer = await client.downloadFile(pdfAttachment.key)
        writeFileSync(pdfPath, pdfBuffer)

        // Update the paper record with the filename
        db.prepare('UPDATE papers SET pdf_filename = ? WHERE id = ?').run(filename, paperId)

        result.pdfsDownloaded++
        console.log(`[Sync] Downloaded PDF: ${filename}`)

    } catch (err) {
        console.error(`[Sync] PDF download failed for "${parentItem.data.title}":`, err)
        // Non-fatal — paper metadata is still saved
    }
}

async function extractTextForNewPapers(result: SyncResult): Promise<void> {
    const db = getDb()

    // Find papers with PDFs but no full_text
    const papersNeedingExtraction = db.prepare(`
        SELECT id, pdf_filename, title FROM papers
        WHERE pdf_filename IS NOT NULL AND (full_text IS NULL OR full_text = '')
    `).all() as Array<{ id: string; pdf_filename: string; title: string }>

    if (papersNeedingExtraction.length === 0) return

    const pdfDir = getPdfDir()

    for (let i = 0; i < papersNeedingExtraction.length; i++) {
        const paper = papersNeedingExtraction[i]

        emitProgress({
            phase: 'extracting',
            current: i + 1,
            total: papersNeedingExtraction.length,
            paperTitle: paper.title
        })

        const pdfPath = join(pdfDir, paper.pdf_filename)
        if (!existsSync(pdfPath)) continue

        const text = await extractTextFromPdf(pdfPath)
        if (text) {
            updatePaperFullText(paper.id, text)
            console.log(`[Sync] Extracted text for: ${paper.title} (${text.length} chars)`)
        }
    }
}
