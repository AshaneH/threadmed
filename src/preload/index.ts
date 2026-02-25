// ============================================================================
// ThreadMed — Preload Script (Context Bridge)
// ============================================================================
// Exposes a typed API object to the renderer process via contextBridge.
// This is the only way the renderer can communicate with the main process.
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron'

/** The API exposed to the renderer via window.api */
const api = {
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
        update: (id: string, updates: unknown) => ipcRenderer.invoke('papers:update', id, updates)
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
        }) => ipcRenderer.invoke('annotations:create', input),
        forPaper: (paperId: string) => ipcRenderer.invoke('annotations:forPaper', paperId),
        forNode: (nodeId: string) => ipcRenderer.invoke('annotations:forNode', nodeId),
        matrix: () => ipcRenderer.invoke('annotations:matrix'),
        delete: (id: string) => ipcRenderer.invoke('annotations:delete', id)
    },

    // ── System ─────────────────────────────────────────────────────────────
    system: {
        dbPath: () => ipcRenderer.invoke('system:dbPath'),
        pdfDir: () => ipcRenderer.invoke('system:pdfDir')
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
