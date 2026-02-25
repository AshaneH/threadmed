// ============================================================================
// ThreadMed — Papers Repository (better-sqlite3)
// ============================================================================

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../connection'

export interface Paper {
    id: string
    zotero_key: string | null
    title: string
    year: number | null
    doi: string | null
    journal: string | null
    abstract: string | null
    pdf_filename: string | null
    full_text: string | null
    date_added: string
    date_modified: string
    zotero_version: number
}

export interface PaperWithAuthors extends Paper {
    authors: string[]
}

export interface CreatePaperInput {
    title: string
    year?: number | null
    doi?: string | null
    journal?: string | null
    abstract?: string | null
    pdf_filename?: string | null
    zotero_key?: string | null
    authors?: string[]
}

/** Insert a new paper with optional authors */
export function createPaper(input: CreatePaperInput): PaperWithAuthors {
    const db = getDb()
    const id = uuidv4()

    db.prepare(`
    INSERT INTO papers (id, title, year, doi, journal, abstract, pdf_filename, zotero_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        id, input.title, input.year ?? null, input.doi ?? null,
        input.journal ?? null, input.abstract ?? null,
        input.pdf_filename ?? null, input.zotero_key ?? null
    )

    // Insert authors
    const authorNames: string[] = []
    if (input.authors && input.authors.length > 0) {
        const findAuthor = db.prepare('SELECT id FROM authors WHERE name = ?')
        const insertAuthor = db.prepare('INSERT INTO authors (id, name) VALUES (?, ?)')
        const linkAuthor = db.prepare('INSERT INTO paper_authors (paper_id, author_id, position) VALUES (?, ?, ?)')

        const addAuthors = db.transaction(() => {
            for (let i = 0; i < input.authors!.length; i++) {
                const name = input.authors![i]
                authorNames.push(name)

                let authorId: string
                const existing = findAuthor.get(name) as { id: string } | undefined
                if (existing) {
                    authorId = existing.id
                } else {
                    authorId = uuidv4()
                    insertAuthor.run(authorId, name)
                }
                linkAuthor.run(id, authorId, i)
            }
        })
        addAuthors()
    }

    return { ...getPaperById(id)!, authors: authorNames }
}

function getPaperById(id: string): Paper | null {
    const db = getDb()
    return db.prepare('SELECT * FROM papers WHERE id = ?').get(id) as Paper | null
}

function getAuthorsForPaper(paperId: string): string[] {
    const db = getDb()
    const rows = db.prepare(`
    SELECT a.name FROM authors a
    JOIN paper_authors pa ON pa.author_id = a.id
    WHERE pa.paper_id = ?
    ORDER BY pa.position
  `).all(paperId) as Array<{ name: string }>
    return rows.map(r => r.name)
}

/** Get all papers with their authors */
export function listPapers(): PaperWithAuthors[] {
    const db = getDb()
    const papers = db.prepare('SELECT * FROM papers ORDER BY date_added DESC').all() as Paper[]
    return papers.map(paper => ({
        ...paper,
        authors: getAuthorsForPaper(paper.id)
    }))
}

/** Get a single paper by ID */
export function getPaper(id: string): PaperWithAuthors | null {
    const paper = getPaperById(id)
    if (!paper) return null
    return { ...paper, authors: getAuthorsForPaper(paper.id) }
}

/** Update a paper's full_text (after PDF extraction) */
export function updatePaperFullText(id: string, fullText: string): void {
    const db = getDb()
    db.prepare(
        "UPDATE papers SET full_text = ?, date_modified = datetime('now') WHERE id = ?"
    ).run(fullText, id)
}

/** Get total paper count */
export function getPaperCount(): number {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as count FROM papers').get() as { count: number }
    return row.count
}

/** FTS5 full-text search with KWIC snippets */
export function searchPapers(query: string, limit = 50): Array<{
    id: string
    title: string
    snippet: string
    rank: number
}> {
    const db = getDb()
    return db.prepare(`
    SELECT p.id, p.title,
           snippet(papers_fts, 2, '<mark>', '</mark>', '...', 40) as snippet,
           rank
    FROM papers_fts
    JOIN papers p ON p.rowid = papers_fts.rowid
    WHERE papers_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as Array<{ id: string; title: string; snippet: string; rank: number }>
}
