// ============================================================================
// ThreadMed — Electron Main Process
// ============================================================================

import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase, getDbPath } from './database/connection'
import { registerIpcHandlers } from './ipc/handlers'

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
        titleBarStyle: 'hiddenInset',
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
    const dbPath = getDbPath()
    console.log(`[ThreadMed] Database path: ${dbPath}`)
    initDatabase()
    console.log('[ThreadMed] Database initialized successfully')

    // Register IPC handlers
    registerIpcHandlers()
    console.log('[ThreadMed] IPC handlers registered')

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
