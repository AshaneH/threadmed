// ============================================================================
// ThreadMed — Annotations Repository (better-sqlite3)
// ============================================================================

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'

export interface Annotation {
    id: string
    paper_id: string
    node_id: string
    content: string
    page_number: number
    rects_json: string | null
    color: string | null
    created_at: string
}

export interface AnnotationWithContext extends Annotation {
    paper_title: string
    node_name: string
    node_color: string
}

export interface CreateAnnotationInput {
    paper_id: string
    node_id: string
    content: string
    page_number: number
    rects_json?: string
    color?: string
}

/** Create a new annotation */
export function createAnnotation(input: CreateAnnotationInput): Annotation {
    const db = getDb()
    const id = uuidv4()
    db.prepare(`
    INSERT INTO annotations (id, paper_id, node_id, content, page_number, rects_json, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
        id, input.paper_id, input.node_id, input.content,
        input.page_number, input.rects_json ?? null, input.color ?? null
    )
    return db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as Annotation
}

/** Get all annotations for a paper */
export function getAnnotationsForPaper(paperId: string): AnnotationWithContext[] {
    const db = getDb()
    return db.prepare(`
    SELECT a.*, p.title as paper_title, n.name as node_name, n.color as node_color
    FROM annotations a
    JOIN papers p ON p.id = a.paper_id
    JOIN nodes n ON n.id = a.node_id
    WHERE a.paper_id = ?
    ORDER BY a.page_number, a.created_at
  `).all(paperId) as AnnotationWithContext[]
}

/** Get all annotations for a specific node across all papers */
export function getAnnotationsForNode(nodeId: string): AnnotationWithContext[] {
    const db = getDb()
    return db.prepare(`
    SELECT a.*, p.title as paper_title, n.name as node_name, n.color as node_color
    FROM annotations a
    JOIN papers p ON p.id = a.paper_id
    JOIN nodes n ON n.id = a.node_id
    WHERE a.node_id = ?
    ORDER BY p.title, a.page_number
  `).all(nodeId) as AnnotationWithContext[]
}

/** Get the synthesis matrix data */
export function getMatrixData(): Array<{
    paper_id: string
    paper_title: string
    paper_year: number | null
    node_id: string
    node_name: string
    node_color: string
    annotation_count: number
    first_content: string
}> {
    const db = getDb()
    return db.prepare(`
    SELECT
      a.paper_id,
      p.title as paper_title,
      p.year as paper_year,
      a.node_id,
      n.name as node_name,
      n.color as node_color,
      COUNT(*) as annotation_count,
      MIN(a.content) as first_content
    FROM annotations a
    JOIN papers p ON p.id = a.paper_id
    JOIN nodes n ON n.id = a.node_id
    GROUP BY a.paper_id, a.node_id
    ORDER BY p.title, n.sort_order
  `).all() as Array<{
        paper_id: string; paper_title: string; paper_year: number | null;
        node_id: string; node_name: string; node_color: string;
        annotation_count: number; first_content: string
    }>
}

/** Delete an annotation */
export function deleteAnnotation(id: string): boolean {
    const db = getDb()
    const result = db.prepare('DELETE FROM annotations WHERE id = ?').run(id)
    return result.changes > 0
}
