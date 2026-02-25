// ============================================================================
// ThreadMed — FTS5 Full-Text Search Setup (better-sqlite3)
// ============================================================================
// Uses SQLite's FTS5 extension with external content strategy. The actual
// text lives in the `papers` table; FTS5 only maintains the search index.
// Triggers keep the index in sync with INSERT/UPDATE/DELETE operations.
// ============================================================================

import type Database from 'better-sqlite3'

/** Set up the FTS5 virtual table and sync triggers */
export function setupFts(db: Database.Database): void {
  db.exec(`
    -- FTS5 virtual table (external content — index only, data lives in papers)
    CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
      title,
      abstract,
      full_text,
      content='papers',
      content_rowid='rowid'
    );

    -- ─── Sync Triggers ─────────────────────────────────────────────────────
    -- After INSERT: add the new row to the FTS index
    CREATE TRIGGER IF NOT EXISTS papers_ai AFTER INSERT ON papers BEGIN
      INSERT INTO papers_fts(rowid, title, abstract, full_text)
      VALUES (new.rowid, new.title, new.abstract, new.full_text);
    END;

    -- After DELETE: remove the row from the FTS index
    CREATE TRIGGER IF NOT EXISTS papers_ad AFTER DELETE ON papers BEGIN
      INSERT INTO papers_fts(papers_fts, rowid, title, abstract, full_text)
      VALUES ('delete', old.rowid, old.title, old.abstract, old.full_text);
    END;

    -- After UPDATE: remove old, insert new
    CREATE TRIGGER IF NOT EXISTS papers_au AFTER UPDATE ON papers BEGIN
      INSERT INTO papers_fts(papers_fts, rowid, title, abstract, full_text)
      VALUES ('delete', old.rowid, old.title, old.abstract, old.full_text);
      INSERT INTO papers_fts(rowid, title, abstract, full_text)
      VALUES (new.rowid, new.title, new.abstract, new.full_text);
    END;
  `)

  console.log('[ThreadMed DB] FTS5 index and sync triggers ready')
}
