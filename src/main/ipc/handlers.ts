// ============================================================================
// ThreadMed — IPC Handler Registration
// ============================================================================
// All IPC channels are registered here. Each handler calls into the
// repository layer and returns typed results to the renderer process.
// ============================================================================

import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { listPapers, getPaper, createPaper, getPaperCount, searchPapers, updatePaperFullText } from '../database/repositories/papers'
import { listNodes, createNode, updateNode, deleteNode } from '../database/repositories/nodes'
import { createAnnotation, getAnnotationsForPaper, getAnnotationsForNode, getMatrixData, deleteAnnotation, updateAnnotationTag, updateAnnotationContent } from '../database/repositories/annotations'
import { listTagsForNode, findOrCreateTag, renameTag, deleteTag } from '../database/repositories/tags'
import { getDb, getDbPath, getPdfDir } from '../database/connection'
import { connectZotero, disconnectZotero, getZoteroStatus, syncLibrary } from '../services/sync-engine'
import { listFolders, createFolder, updateFolder, deleteFolder, addPaperToFolder, removePaperFromFolder, getPapersInFolder, getPaperMappings } from '../database/repositories/folders'
import { deletePaper, updatePaper, addPdfToPaper, removePdfFromPaper } from '../database/repositories/papers'
import { listRecentProjects, getActiveProject, openProject, deleteProject, renameProject, showNewProjectDialog, showOpenProjectDialog } from '../services/project-manager'
import type { CreatePaperInput } from '../database/repositories/papers'
import type { CreateAnnotationInput } from '../database/repositories/annotations'

export function registerIpcHandlers(): void {
    // ── Project Handlers ─────────────────────────────────────────────────────
    ipcMain.handle('projects:list', () => {
        return listRecentProjects()
    })

    ipcMain.handle('projects:active', () => {
        return getActiveProject()
    })

    ipcMain.handle('projects:new', async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender)
        return showNewProjectDialog(window)
    })

    ipcMain.handle('projects:open', async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender)
        return showOpenProjectDialog(window)
    })

    ipcMain.handle('projects:openRecent', (_event, projectPath: string) => {
        return openProject(projectPath)
    })

    ipcMain.handle('projects:delete', (_event, projectPath: string) => {
        return deleteProject(projectPath)
    })

    ipcMain.handle('projects:rename', (_event, projectPath: string, newName: string) => {
        return renameProject(projectPath, newName)
    })

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

    ipcMain.handle('papers:addPdf', (_event, id: string, sourcePath: string) => {
        return addPdfToPaper(id, sourcePath)
    })

    ipcMain.handle('papers:removePdf', (_event, id: string) => {
        return removePdfFromPaper(id)
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

    ipcMain.handle('annotations:updateTag', (_event, annotationId: string, tagId: string | null) => {
        return updateAnnotationTag(annotationId, tagId)
    })

    ipcMain.handle('annotations:updateContent', (_event, annotationId: string, content: string, rectsJson: string, pageNumber: number) => {
        return updateAnnotationContent(annotationId, content, rectsJson, pageNumber)
    })

    // ── Tag Handlers ─────────────────────────────────────────────────────────
    ipcMain.handle('tags:forNode', (_event, nodeId: string) => {
        return listTagsForNode(nodeId)
    })

    ipcMain.handle('tags:findOrCreate', (_event, nodeId: string, name: string) => {
        return findOrCreateTag(nodeId, name)
    })

    ipcMain.handle('tags:rename', (_event, id: string, newName: string) => {
        return renameTag(id, newName)
    })

    ipcMain.handle('tags:delete', (_event, id: string) => {
        return deleteTag(id)
    })

    // ── System Handlers ──────────────────────────────────────────────────────
    ipcMain.handle('system:dbPath', () => {
        return getDbPath()
    })

    ipcMain.handle('system:pdfDir', () => {
        return getPdfDir()
    })

    ipcMain.handle('system:checkFts5', () => {
        const db = getDb()
        try {
            const row = db.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') as enabled").get() as any
            return row.enabled === 1
        } catch (e) {
            return false
        }
    })

    ipcMain.handle('system:showOpenDialog', async (event, options) => {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) return undefined
        const { canceled, filePaths } = await dialog.showOpenDialog(window, options)
        if (canceled) return undefined
        return filePaths
    })

    // ── Find-in-Page Handlers ───────────────────────────────────────────────
    ipcMain.handle('find:start', (event, text: string, options?: { forward?: boolean; findNext?: boolean }) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win || !text) return null

        // Listen for results once if not already listening (or just rely on the event)
        // Note: multiple calls to findInPage fire multiple events.
        return event.sender.findInPage(text, options)
    })

    ipcMain.handle('find:stop', (_event, action?: 'clearSelection' | 'keepSelection' | 'activateSelection') => {
        const win = BrowserWindow.getFocusedWindow()
        if (!win) return
        win.webContents.stopFindInPage(action || 'clearSelection')
    })

    // ── PDF File Handler ────────────────────────────────────────────────────
    ipcMain.handle('papers:readPdf', (_event, paperId: string) => {
        const paper = getPaper(paperId)
        if (!paper?.pdf_filename) return null
        const filePath = path.join(getPdfDir(), paper.pdf_filename)
        if (!fs.existsSync(filePath)) return null
        // Return as base64 string to avoid Electron's detached ArrayBuffer issue
        return fs.readFileSync(filePath).toString('base64')
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

