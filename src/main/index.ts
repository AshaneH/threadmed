// ============================================================================
// ThreadMed — Electron Main Process
// ============================================================================

import { app, shell, BrowserWindow, protocol, net, Menu, MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { closeDatabase, getPdfDir } from './database/connection'
import { registerIpcHandlers } from './ipc/handlers'
import { getPaper } from './database/repositories/papers'
import { migrateIfNeeded, listRecentProjects, openProject, showNewProjectDialog, showOpenProjectDialog, getActiveProject } from './services/project-manager'

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
    // Build Native Menu
    const isMac = process.platform === 'darwin'
    const template: MenuItemConstructorOptions[] = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                { role: 'services' as const },
                { type: 'separator' as const },
                { role: 'hide' as const },
                { role: 'hideOthers' as const },
                { role: 'unhide' as const },
                { type: 'separator' as const },
                { role: 'quit' as const }
            ]
        }] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project...',
                    accelerator: 'CmdOrCtrl+N',
                    click: async () => {
                        const win = BrowserWindow.getFocusedWindow()
                        const project = await showNewProjectDialog(win)
                        if (project && win) {
                            // Tell the renderer to switch to the new project
                            win.webContents.send('project:opened', project)
                        }
                    }
                },
                {
                    label: 'Open Project...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const win = BrowserWindow.getFocusedWindow()
                        const project = await showOpenProjectDialog(win)
                        if (project && win) {
                            win.webContents.send('project:opened', project)
                        }
                    }
                },
                { type: 'separator' as const },
                {
                    label: 'Close Project',
                    accelerator: 'CmdOrCtrl+W',
                    click: () => {
                        if (getActiveProject()) {
                            closeDatabase()
                            const win = BrowserWindow.getFocusedWindow()
                            if (win) win.webContents.send('project:closed')
                        } else {
                            // Close window if no project is open
                            const win = BrowserWindow.getFocusedWindow()
                            if (win) win.close()
                        }
                    }
                },
                { type: 'separator' as const },
                isMac ? { role: 'close' as const } : { role: 'quit' as const }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' as const },
                { role: 'redo' as const },
                { type: 'separator' as const },
                { role: 'cut' as const },
                { role: 'copy' as const },
                { role: 'paste' as const },
                ...(isMac ? [
                    { role: 'pasteAndMatchStyle' as const },
                    { role: 'delete' as const },
                    { role: 'selectAll' as const },
                    { type: 'separator' as const },
                    {
                        label: 'Speech',
                        submenu: [
                            { role: 'startSpeaking' as const },
                            { role: 'stopSpeaking' as const }
                        ]
                    }
                ] : [
                    { role: 'delete' as const },
                    { type: 'separator' as const },
                    { role: 'selectAll' as const }
                ])
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' as const },
                { role: 'forceReload' as const },
                { role: 'toggleDevTools' as const },
                { type: 'separator' as const },
                { role: 'resetZoom' as const },
                { role: 'zoomIn' as const },
                { role: 'zoomOut' as const },
                { type: 'separator' as const },
                { role: 'togglefullscreen' as const }
            ]
        },
        {
            role: 'window' as const,
            submenu: [
                { role: 'minimize' as const },
                { role: 'zoom' as const },
                ...(isMac ? [
                    { type: 'separator' as const },
                    { role: 'front' as const },
                    { type: 'separator' as const },
                    { role: 'window' as const }
                ] : [
                    { role: 'close' as const }
                ])
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)

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
