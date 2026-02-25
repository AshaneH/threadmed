// ============================================================================
// ThreadMed — Database Schema (better-sqlite3)
// ============================================================================

import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

/** Run all schema creation statements */
export function runSchema(db: Database.Database): void {
  db.exec(`
    -- ─── Papers ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS papers (
      id            TEXT PRIMARY KEY,
      zotero_key    TEXT UNIQUE,
      title         TEXT NOT NULL,
      year          INTEGER,
      doi           TEXT,
      journal       TEXT,
      abstract      TEXT,
      pdf_filename  TEXT,
      full_text     TEXT,
      date_added    TEXT NOT NULL DEFAULT (datetime('now')),
      date_modified TEXT NOT NULL DEFAULT (datetime('now')),
      zotero_version INTEGER DEFAULT 0
    );

    -- ─── Authors ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS authors (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_authors (
      paper_id  TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      position  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (paper_id, author_id)
    );

    -- ─── Nodes (Thematic Codes) ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS nodes (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      color      TEXT NOT NULL DEFAULT '#3B82F6',
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- ─── Annotations (Highlights) ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS annotations (
      id          TEXT PRIMARY KEY,
      paper_id    TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      node_id     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      rects_json  TEXT,
      color       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Memos ───────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS memos (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Memo ↔ Annotation References ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS memo_references (
      id            TEXT PRIMARY KEY,
      memo_id       TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
      annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Indices ─────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_papers_zotero_key ON papers(zotero_key);
    CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);
    CREATE INDEX IF NOT EXISTS idx_paper_authors_paper ON paper_authors(paper_id);
    CREATE INDEX IF NOT EXISTS idx_paper_authors_author ON paper_authors(author_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_paper ON annotations(paper_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_node ON annotations(node_id);
    CREATE INDEX IF NOT EXISTS idx_memo_references_memo ON memo_references(memo_id);
    CREATE INDEX IF NOT EXISTS idx_memo_references_annotation ON memo_references(annotation_id);
  `)

  // Seed default EBM nodes (only if nodes table is empty)
  seedDefaultNodes(db)
}

/** Seed the six default Evidence-Based Medicine nodes */
function seedDefaultNodes(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }
  if (count.count > 0) return

  const defaults = [
    { name: 'Population', color: '#3B82F6', order: 1 },
    { name: 'Intervention', color: '#10B981', order: 2 },
    { name: 'Comparison', color: '#F59E0B', order: 3 },
    { name: 'Outcomes', color: '#8B5CF6', order: 4 },
    { name: 'Limitations', color: '#EF4444', order: 5 },
    { name: 'Conclusions', color: '#06B6D4', order: 6 }
  ]

  const insert = db.prepare(
    'INSERT INTO nodes (id, name, color, is_default, sort_order) VALUES (?, ?, ?, 1, ?)'
  )

  const insertAll = db.transaction(() => {
    for (const node of defaults) {
      insert.run(uuidv4(), node.name, node.color, node.order)
    }
  })

  insertAll()
  console.log('[ThreadMed DB] Seeded default EBM nodes')
}
