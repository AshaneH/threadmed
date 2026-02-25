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
}
