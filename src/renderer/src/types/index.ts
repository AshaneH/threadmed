// ============================================================================
// ThreadMed — Shared TypeScript Types
// ============================================================================

/** A paper with its authors */
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
    authors: string[]
}

/** A thematic code node (e.g., Population, Intervention) */
export interface Node {
    id: string
    name: string
    color: string
    is_default: number
    sort_order: number
}

/** A text highlight annotation linked to a paper and node */
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

/** Annotation with paper and node context */
export interface AnnotationWithContext extends Annotation {
    paper_title: string
    node_name: string
    node_color: string
}

/** A single cell in the synthesis matrix */
export interface MatrixCell {
    paper_id: string
    paper_title: string
    paper_year: number | null
    node_id: string
    node_name: string
    node_color: string
    annotation_count: number
    first_content: string
}

/** FTS search result */
export interface SearchResult {
    id: string
    title: string
    snippet: string
    rank: number
}

/** Navigation view identifiers */
export type ViewId = 'library' | 'matrix' | 'search' | 'memos' | 'paper' | 'settings'
