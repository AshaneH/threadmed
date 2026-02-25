// ============================================================================
// ThreadMed — Folders Repository
// ============================================================================
// CRUD operations for folders (collections) and mapping papers to folders.
// ============================================================================

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'
import { getPaper } from './papers'
import type { PaperWithAuthors } from './papers'

export interface Folder {
    id: string
    name: string
    parent_id: string | null
    created_at: string
    sort_order: number
}

/** Create a new folder */
export function createFolder(name: string, parentId?: string): Folder {
    const db = getDb()
    const id = uuidv4()

    // Get max sort order if necessary
    const maxSort = db.prepare('SELECT MAX(sort_order) as max FROM folders').get() as { max: number | null }
    const nextSort = (maxSort.max || 0) + 1

    db.prepare(`
        INSERT INTO folders (id, name, parent_id, sort_order)
        VALUES (?, ?, ?, ?)
    `).run(id, name, parentId || null, nextSort)

    return getFolderById(id)!
}

/** Get a folder by ID */
function getFolderById(id: string): Folder | null {
    const db = getDb()
    return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder | null
}

/** List all folders, ordered by sort_order */
export function listFolders(): Folder[] {
    const db = getDb()
    return db.prepare('SELECT * FROM folders ORDER BY sort_order ASC, created_at DESC').all() as Folder[]
}

/** Rename or update a folder */
export function updateFolder(id: string, updates: { name?: string, parent_id?: string | null }): void {
    const db = getDb()

    // Build dynamic update
    const setDocs: string[] = []
    const values: any[] = []

    if (updates.name !== undefined) {
        setDocs.push('name = ?')
        values.push(updates.name)
    }

    // We explicitly allow parent_id to be null
    if (updates.hasOwnProperty('parent_id')) {
        setDocs.push('parent_id = ?')
        values.push(updates.parent_id)
    }

    if (setDocs.length === 0) return

    values.push(id) // For the WHERE clause

    db.prepare(`UPDATE folders SET ${setDocs.join(', ')} WHERE id = ?`).run(...values)
}

/** Delete a folder (cascades to paper_folders and child folders) */
export function deleteFolder(id: string): void {
    const db = getDb()
    // ON DELETE CASCADE handles paper_folders automatically
    db.prepare('DELETE FROM folders WHERE id = ?').run(id)
}

// ── Folder Assignment ────────────────────────────────────────────────────────

/** Add a paper to a folder */
export function addPaperToFolder(paperId: string, folderId: string): void {
    const db = getDb()
    db.prepare('INSERT OR IGNORE INTO paper_folders (paper_id, folder_id) VALUES (?, ?)').run(paperId, folderId)
}

/** Remove a paper from a folder */
export function removePaperFromFolder(paperId: string, folderId: string): void {
    const db = getDb()
    db.prepare('DELETE FROM paper_folders WHERE paper_id = ? AND folder_id = ?').run(paperId, folderId)
}

/** List all papers inside a specific folder */
export function getPapersInFolder(folderId: string): PaperWithAuthors[] {
    const db = getDb()
    const rows = db.prepare('SELECT paper_id FROM paper_folders WHERE folder_id = ?').all(folderId) as { paper_id: string }[]

    return rows.map(r => getPaper(r.paper_id)).filter((p): p is PaperWithAuthors => p !== null)
}

/** Get all folder-to-paper links */
export function getPaperMappings(): Array<{ paper_id: string, folder_id: string }> {
    const db = getDb()
    return db.prepare('SELECT paper_id, folder_id FROM paper_folders').all() as Array<{ paper_id: string, folder_id: string }>
}
