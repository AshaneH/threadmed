// ============================================================================
// ThreadMed — Nodes Repository (better-sqlite3)
// ============================================================================

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'

export interface Node {
    id: string
    name: string
    color: string
    is_default: number
    sort_order: number
}

/** Get all nodes ordered by sort_order */
export function listNodes(): Node[] {
    const db = getDb()
    return db.prepare('SELECT * FROM nodes ORDER BY sort_order, name').all() as Node[]
}

/** Create a custom node */
export function createNode(name: string, color = '#3B82F6'): Node {
    const db = getDb()
    const id = uuidv4()
    const maxRow = db.prepare('SELECT MAX(sort_order) as max_order FROM nodes').get() as { max_order: number | null }
    const sortOrder = (maxRow.max_order ?? 0) + 1

    db.prepare(
        'INSERT INTO nodes (id, name, color, is_default, sort_order) VALUES (?, ?, ?, 0, ?)'
    ).run(id, name, color, sortOrder)

    return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node
}

/** Update a node's name or color */
export function updateNode(id: string, updates: { name?: string; color?: string }): Node | null {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node | undefined
    if (!existing) return null

    db.prepare('UPDATE nodes SET name = ?, color = ? WHERE id = ?').run(
        updates.name ?? existing.name,
        updates.color ?? existing.color,
        id
    )

    return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node
}

/** Delete a custom node (default nodes cannot be deleted) */
export function deleteNode(id: string): boolean {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node | undefined
    if (!existing || existing.is_default === 1) return false

    db.prepare('DELETE FROM nodes WHERE id = ?').run(id)
    return true
}
