// ============================================================================
// ThreadMed — Preload Script (Context Bridge)
// ============================================================================
// Exposes a typed API object to the renderer process via contextBridge.
// This is the only way the renderer can communicate with the main process.
// ============================================================================

import { contextBridge, ipcRenderer, webUtils } from 'electron'

/** The API exposed to the renderer via window.api */
const api = {
    // ── Projects ───────────────────────────────────────────────────────────
    projects: {
        list: () => ipcRenderer.invoke('projects:list'),
        active: () => ipcRenderer.invoke('projects:active'),
        new: () => ipcRenderer.invoke('projects:new'),
        open: () => ipcRenderer.invoke('projects:open'),
        openRecent: (path: string) => ipcRenderer.invoke('projects:openRecent', path),
        delete: (path: string) => ipcRenderer.invoke('projects:delete', path),
        rename: (path: string, newName: string) => ipcRenderer.invoke('projects:rename', path, newName)
    },

    // ── Papers ─────────────────────────────────────────────────────────────
    papers: {
        list: () => ipcRenderer.invoke('papers:list'),
        get: (id: string) => ipcRenderer.invoke('papers:get', id),
        create: (input: {
            title: string
            year?: number | null
            doi?: string | null
            journal?: string | null
            abstract?: string | null
            pdf_filename?: string | null
            zotero_key?: string | null
            authors?: string[]
        }) => ipcRenderer.invoke('papers:create', input),
        count: () => ipcRenderer.invoke('papers:count'),
        search: (query: string, limit?: number) => ipcRenderer.invoke('papers:search', query, limit),
        updateFullText: (id: string, text: string) => ipcRenderer.invoke('papers:updateFullText', id, text),
        delete: (id: string) => ipcRenderer.invoke('papers:delete', id),
        update: (id: string, updates: unknown) => ipcRenderer.invoke('papers:update', id, updates),
        addPdf: (id: string, sourcePath: string) => ipcRenderer.invoke('papers:addPdf', id, sourcePath),
        removePdf: (id: string) => ipcRenderer.invoke('papers:removePdf', id),
        readPdf: (id: string) => ipcRenderer.invoke('papers:readPdf', id) as Promise<Buffer | null>
    },

    // ── Folders ────────────────────────────────────────────────────────────
    folders: {
        list: () => ipcRenderer.invoke('folders:list'),
        create: (name: string, parentId?: string) => ipcRenderer.invoke('folders:create', name, parentId),
        update: (id: string, name: string) => ipcRenderer.invoke('folders:update', id, name),
        delete: (id: string) => ipcRenderer.invoke('folders:delete', id),
        addPaper: (paperId: string, folderId: string) => ipcRenderer.invoke('folders:addPaper', paperId, folderId),
        removePaper: (paperId: string, folderId: string) => ipcRenderer.invoke('folders:removePaper', paperId, folderId),
        getPapers: (folderId: string) => ipcRenderer.invoke('folders:getPapers', folderId),
        getMappings: () => ipcRenderer.invoke('folders:getMappings')
    },

    // ── Nodes ──────────────────────────────────────────────────────────────
    nodes: {
        list: () => ipcRenderer.invoke('nodes:list'),
        create: (name: string, color?: string) => ipcRenderer.invoke('nodes:create', name, color),
        update: (id: string, updates: { name?: string; color?: string }) =>
            ipcRenderer.invoke('nodes:update', id, updates),
        delete: (id: string) => ipcRenderer.invoke('nodes:delete', id)
    },

    // ── Annotations ────────────────────────────────────────────────────────
    annotations: {
        create: (input: {
            paper_id: string
            node_id: string
            content: string
            page_number: number
            rects_json?: string
            color?: string
            tag_id?: string
        }) => ipcRenderer.invoke('annotations:create', input),
        forPaper: (paperId: string) => ipcRenderer.invoke('annotations:forPaper', paperId),
        forNode: (nodeId: string) => ipcRenderer.invoke('annotations:forNode', nodeId),
        matrix: () => ipcRenderer.invoke('annotations:matrix'),
        delete: (id: string) => ipcRenderer.invoke('annotations:delete', id),
        updateTag: (annotationId: string, tagId: string | null) =>
            ipcRenderer.invoke('annotations:updateTag', annotationId, tagId),
        updateContent: (annotationId: string, content: string, rectsJson: string, pageNumber: number) =>
            ipcRenderer.invoke('annotations:updateContent', annotationId, content, rectsJson, pageNumber)
    },

    // ── Tags ───────────────────────────────────────────────────────────────
    tags: {
        forNode: (nodeId: string) => ipcRenderer.invoke('tags:forNode', nodeId),
        findOrCreate: (nodeId: string, name: string) =>
            ipcRenderer.invoke('tags:findOrCreate', nodeId, name),
        rename: (id: string, newName: string) =>
            ipcRenderer.invoke('tags:rename', id, newName),
        delete: (id: string) => ipcRenderer.invoke('tags:delete', id)
    },

    // ── System ─────────────────────────────────────────────────────────────
    system: {
        getDbPath: () => ipcRenderer.invoke('system:dbPath'),
        getPdfDir: () => ipcRenderer.invoke('system:pdfDir'),
        checkFts5: () => ipcRenderer.invoke('system:checkFts5'),
        getFilePath: (file: File) => webUtils.getPathForFile(file),
        showOpenDialog: (options: any) => ipcRenderer.invoke('system:showOpenDialog', options)
    },

    // ── Find ───────────────────────────────────────────────────────────────
    find: {
        start: (text: string, options?: { forward?: boolean; findNext?: boolean }) =>
            ipcRenderer.invoke('find:start', text, options),
        stop: (action?: 'clearSelection' | 'keepSelection' | 'activateSelection') =>
            ipcRenderer.invoke('find:stop', action),
        onResult: (callback: (result: { activeMatchOrdinal: number; matches: number }) => void) => {
            ipcRenderer.on('find:result', (_event, result) => callback(result))
        },
        offResult: () => ipcRenderer.removeAllListeners('find:result')
    },

    // ── Zotero ─────────────────────────────────────────────────────────────
    zotero: {
        connect: (apiKey: string, userId: string) =>
            ipcRenderer.invoke('zotero:connect', apiKey, userId),
        disconnect: () => ipcRenderer.invoke('zotero:disconnect'),
        status: () => ipcRenderer.invoke('zotero:status'),
        sync: () => ipcRenderer.invoke('zotero:sync'),
        onSyncProgress: (callback: (progress: unknown) => void) => {
            ipcRenderer.on('zotero:sync-progress', (_event, progress) => callback(progress))
        },
        offSyncProgress: () => {
            ipcRenderer.removeAllListeners('zotero:sync-progress')
        }
    }
}

contextBridge.exposeInMainWorld('api', api)

export type ThreadMedAPI = typeof api
