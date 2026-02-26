// ============================================================================
// ThreadMed — Electron Main Process
// ============================================================================

import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase, getDbPath, getPdfDir } from './database/connection'
import { registerIpcHandlers } from './ipc/handlers'
import { getPaper } from './database/repositories/papers'

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
    // Initialize database (synchronous with better-sqlite3)
    try {
        const dbPath = getDbPath()
        console.log(`[ThreadMed] Database path: ${dbPath}`)
        initDatabase()
        console.log('[ThreadMed] Database initialized successfully')
    } catch (err) {
        console.error('[ThreadMed] FATAL: Database initialization failed:', err)
        app.quit()
        return
    }

    // Register IPC handlers
    registerIpcHandlers()
    console.log('[ThreadMed] IPC handlers registered')

    // Register custom protocol for serving PDF files to the renderer
    protocol.handle('threadmed-pdf', (request) => {
        const url = new URL(request.url)
        const paperId = url.hostname || url.pathname.replace(/^\/+/, '')
        const paper = getPaper(paperId)
        if (!paper?.pdf_filename) {
            return new Response('PDF not found', { status: 404 })
        }
        const filePath = join(getPdfDir(), paper.pdf_filename)
        if (!fs.existsSync(filePath)) {
            return new Response('File not found on disk', { status: 404 })
        }
        return net.fetch(`file://${filePath}`)
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
