// ============================================================================
// ThreadMed — IPC Handler Registration
// ============================================================================
// All IPC channels are registered here. Each handler calls into the
// repository layer and returns typed results to the renderer process.
// ============================================================================

import { ipcMain } from 'electron'
import { listPapers, getPaper, createPaper, getPaperCount, searchPapers, updatePaperFullText } from '../database/repositories/papers'
import { listNodes, createNode, updateNode, deleteNode } from '../database/repositories/nodes'
import { createAnnotation, getAnnotationsForPaper, getAnnotationsForNode, getMatrixData, deleteAnnotation } from '../database/repositories/annotations'
import { getDbPath, getPdfDir } from '../database/connection'
import { connectZotero, disconnectZotero, getZoteroStatus, syncLibrary } from '../services/sync-engine'
import { listFolders, createFolder, updateFolder, deleteFolder, addPaperToFolder, removePaperFromFolder, getPapersInFolder, getPaperMappings } from '../database/repositories/folders'
import { deletePaper, updatePaper } from '../database/repositories/papers'
import type { CreatePaperInput } from '../database/repositories/papers'
import type { CreateAnnotationInput } from '../database/repositories/annotations'

export function registerIpcHandlers(): void {
    // ── Paper Handlers ───────────────────────────────────────────────────────
    ipcMain.handle('papers:list', () => {
        return listPapers()
    })

    ipcMain.handle('papers:get', (_event, id: string) => {
        return getPaper(id)
    })

    ipcMain.handle('papers:create', (_event, input: CreatePaperInput) => {
        return createPaper(input)
    })

    ipcMain.handle('papers:count', () => {
        return getPaperCount()
    })

    ipcMain.handle('papers:search', (_event, query: string, limit?: number) => {
        return searchPapers(query, limit)
    })

    ipcMain.handle('papers:updateFullText', (_event, id: string, fullText: string) => {
        return updatePaperFullText(id, fullText)
    })

    ipcMain.handle('papers:delete', (_event, id: string) => {
        return deletePaper(id)
    })

    ipcMain.handle('papers:update', (_event, id: string, updates: Partial<CreatePaperInput>) => {
        return updatePaper(id, updates)
    })

    // ── Folder Handlers ──────────────────────────────────────────────────────
    ipcMain.handle('folders:list', () => {
        return listFolders()
    })

    ipcMain.handle('folders:create', (_event, name: string, parentId?: string) => {
        return createFolder(name, parentId)
    })

    ipcMain.handle('folders:update', (_event, id: string, updates: { name?: string, parent_id?: string | null }) => {
        return updateFolder(id, updates)
    })

    ipcMain.handle('folders:delete', (_event, id: string) => {
        return deleteFolder(id)
    })

    ipcMain.handle('folders:addPaper', (_event, paperId: string, folderId: string) => {
        return addPaperToFolder(paperId, folderId)
    })

    ipcMain.handle('folders:removePaper', (_event, paperId: string, folderId: string) => {
        return removePaperFromFolder(paperId, folderId)
    })

    ipcMain.handle('folders:getPapers', (_event, folderId: string) => {
        return getPapersInFolder(folderId)
    })

    ipcMain.handle('folders:getMappings', () => {
        return getPaperMappings()
    })

    // ── Node Handlers ────────────────────────────────────────────────────────
    ipcMain.handle('nodes:list', () => {
        return listNodes()
    })

    ipcMain.handle('nodes:create', (_event, name: string, color?: string) => {
        return createNode(name, color)
    })

    ipcMain.handle('nodes:update', (_event, id: string, updates: { name?: string; color?: string }) => {
        return updateNode(id, updates)
    })

    ipcMain.handle('nodes:delete', (_event, id: string) => {
        return deleteNode(id)
    })

    // ── Annotation Handlers ──────────────────────────────────────────────────
    ipcMain.handle('annotations:create', (_event, input: CreateAnnotationInput) => {
        return createAnnotation(input)
    })

    ipcMain.handle('annotations:forPaper', (_event, paperId: string) => {
        return getAnnotationsForPaper(paperId)
    })

    ipcMain.handle('annotations:forNode', (_event, nodeId: string) => {
        return getAnnotationsForNode(nodeId)
    })

    ipcMain.handle('annotations:matrix', () => {
        return getMatrixData()
    })

    ipcMain.handle('annotations:delete', (_event, id: string) => {
        return deleteAnnotation(id)
    })

    // ── System Handlers ──────────────────────────────────────────────────────
    ipcMain.handle('system:dbPath', () => {
        return getDbPath()
    })

    ipcMain.handle('system:pdfDir', () => {
        return getPdfDir()
    })

    // ── Zotero Handlers ──────────────────────────────────────────────────────
    ipcMain.handle('zotero:connect', (_event, apiKey: string, userId: string) => {
        return connectZotero(apiKey, userId)
    })

    ipcMain.handle('zotero:disconnect', () => {
        return disconnectZotero()
    })

    ipcMain.handle('zotero:status', () => {
        return getZoteroStatus()
    })

    ipcMain.handle('zotero:sync', () => {
        return syncLibrary()
    })
}

