// ============================================================================
// ThreadMed — Electron Main Process
// ============================================================================

import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { closeDatabase, getPdfDir } from './database/connection'
import { registerIpcHandlers } from './ipc/handlers'
import { getPaper } from './database/repositories/papers'
import { migrateIfNeeded, listRecentProjects, openProject } from './services/project-manager'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        show: false,
        title: 'ThreadMed',
        backgroundColor: '#0a0a0f',
        ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
        frame: process.platform !== 'darwin',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // Listen for find-in-page results and send to renderer
    mainWindow.webContents.on('found-in-page', (_event, result) => {
        mainWindow?.webContents.send('find:result', result)
    })

    // In dev, load from the Vite dev server; in production, load the built HTML
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// ── Application Lifecycle ────────────────────────────────────────────────────

app.whenReady().then(() => {
    // Register IPC handlers (must happen before any renderer IPC calls)
    registerIpcHandlers()
    console.log('[ThreadMed] IPC handlers registered')

    // Attempt to open a project:
    // 1. Migrate legacy single-DB layout if needed
    // 2. Otherwise, auto-open the most recent project
    // 3. If neither exists, the renderer will show the ProjectPicker
    try {
        const migrated = migrateIfNeeded()
        if (migrated) {
            console.log(`[ThreadMed] Migrated legacy data into: ${migrated.path}`)
        } else {
            // Try to auto-open the most recent project
            const recent = listRecentProjects()
            if (recent.length > 0) {
                openProject(recent[0].path)
                console.log(`[ThreadMed] Auto-opened recent project: ${recent[0].name}`)
            } else {
                console.log('[ThreadMed] No projects found — renderer will show ProjectPicker')
            }
        }
    } catch (err) {
        console.error('[ThreadMed] Project initialization error:', err)
        // Not fatal — the renderer will show the ProjectPicker
    }

    // Register custom protocol for serving PDF files to the renderer
    protocol.handle('threadmed-pdf', (request) => {
        const url = new URL(request.url)
        const paperId = url.hostname || url.pathname.replace(/^\/+/, '')
        try {
            const paper = getPaper(paperId)
            if (!paper?.pdf_filename) {
                return new Response('PDF not found', { status: 404 })
            }
            const filePath = join(getPdfDir(), paper.pdf_filename)
            if (!fs.existsSync(filePath)) {
                return new Response('File not found on disk', { status: 404 })
            }
            return net.fetch(`file://${filePath}`)
        } catch {
            return new Response('No project open', { status: 503 })
        }
    })
    console.log('[ThreadMed] Custom PDF protocol registered')

    // Create the main window
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    closeDatabase()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
