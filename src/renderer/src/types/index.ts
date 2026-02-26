// ============================================================================
// ThreadMed — Shared TypeScript Types
// ============================================================================

/** A paper record */
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

/** A thematic code node (e.g., Population, Intervention) */
export interface Node {
    id: string
    name: string
    color: string
    is_default: number
    sort_order: number
}

/** A tag (subtype/code within a node, e.g., Population → "cirrhotics") */
export interface Tag {
    id: string
    node_id: string
    name: string
}

/** A text highlight annotation linked to a paper, node, and optional tag */
export interface Annotation {
    id: string
    paper_id: string
    node_id: string
    tag_id: string | null
    content: string
    page_number: number
    rects_json: string | null
    color: string | null
    created_at: string
    tag_name?: string  // joined from tags table for display
}

export interface CreateAnnotationInput {
    paper_id: string
    node_id: string
    content: string
    page_number: number
    rects_json?: string | null
    color?: string | null
    tag_id?: string | null
}

/** Annotation with paper and node context */
export interface AnnotationWithContext extends Annotation {
    paper_title: string
    node_name: string
    node_color: string
}

/** Folder / Collection */
export interface Folder {
    id: string
    name: string
    parent_id: string | null
    created_at: string
    sort_order: number
}

// ── Application State ────────────────────────────────────────────────────────

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

/** Zotero connection status (NOTE: API key is intentionally excluded — never sent to renderer) */
export interface ZoteroStatus {
    connected: boolean
    userId: string | null
    lastSync: string | null
    libraryVersion: number | null
}

/** Zotero connection result */
export interface ConnectResult {
    valid: boolean
    totalItems: number
    error?: string
}

/** Sync progress emitted during a sync operation */
export interface SyncProgress {
    phase: 'metadata' | 'downloading' | 'extracting' | 'complete' | 'error'
    current: number
    total: number
    paperTitle?: string
    error?: string
}

/** Final sync result */
export interface SyncResult {
    imported: number
    updated: number
    pdfsDownloaded: number
    errors: string[]
    libraryVersion: number
}
