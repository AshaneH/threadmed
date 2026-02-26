// ============================================================================
// ThreadMed — Tags Repository (better-sqlite3)
// ============================================================================
// Tags are subtypes/codes within a PICO node.
// e.g., Node "Population" → Tag "cirrhotics", Tag "diabetics"
// ============================================================================

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'

export interface Tag {
    id: string
    node_id: string
    name: string
}

/** List all tags for a given node, ordered alphabetically */
export function listTagsForNode(nodeId: string): Tag[] {
    const db = getDb()
    return db.prepare(
        'SELECT * FROM tags WHERE node_id = ? ORDER BY name COLLATE NOCASE'
    ).all(nodeId) as Tag[]
}

/** Find an existing tag by name (case-insensitive) or create a new one */
export function findOrCreateTag(nodeId: string, name: string): Tag {
    const db = getDb()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Tag name cannot be empty')

    // Case-insensitive lookup
    const existing = db.prepare(
        'SELECT * FROM tags WHERE node_id = ? AND name = ? COLLATE NOCASE'
    ).get(nodeId, trimmed) as Tag | undefined

    if (existing) return existing

    const id = uuidv4()
    db.prepare('INSERT INTO tags (id, node_id, name) VALUES (?, ?, ?)').run(id, nodeId, trimmed)
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag
}

/** Rename a tag (with uniqueness check within the same node) */
export function renameTag(id: string, newName: string): Tag | null {
    const db = getDb()
    const trimmed = newName.trim()
    if (!trimmed) throw new Error('Tag name cannot be empty')

    const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | undefined
    if (!existing) return null

    // Check for name collision within the same node
    const collision = db.prepare(
        'SELECT * FROM tags WHERE node_id = ? AND name = ? COLLATE NOCASE AND id != ?'
    ).get(existing.node_id, trimmed, id) as Tag | undefined

    if (collision) throw new Error(`Tag "${trimmed}" already exists for this node`)

    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(trimmed, id)
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag
}

/** Delete a tag (annotations keep text but lose tag_id via ON DELETE SET NULL) */
export function deleteTag(id: string): boolean {
    const db = getDb()
    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    return result.changes > 0
}
