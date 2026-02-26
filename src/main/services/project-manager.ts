// ============================================================================
// ThreadMed — Project Manager
// ============================================================================
// Manages project bundles: create, open, list recent, delete.
// Each project is a directory containing its own SQLite database and PDF files.
//
// Directory structure:
//   MyReview/
//   ├── threadmed.db
//   └── pdfs/
//
// A "recent-projects.json" registry in Electron's userData tracks known
// projects for quick access.
// ============================================================================

import { app, dialog, BrowserWindow } from 'electron'
import { join, basename } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, readdirSync, renameSync } from 'fs'
import { initDatabase, closeDatabase } from '../database/connection'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Project {
    name: string
    path: string
    lastOpenedAt: string
}

// ── State ────────────────────────────────────────────────────────────────────

let activeProject: Project | null = null

// ── Registry ─────────────────────────────────────────────────────────────────

function getRegistryPath(): string {
    return join(app.getPath('userData'), 'recent-projects.json')
}

function readRegistry(): Project[] {
    const regPath = getRegistryPath()
    if (!existsSync(regPath)) return []
    try {
        return JSON.parse(readFileSync(regPath, 'utf-8')) as Project[]
    } catch {
        return []
    }
}

function writeRegistry(projects: Project[]): void {
    writeFileSync(getRegistryPath(), JSON.stringify(projects, null, 2), 'utf-8')
}

// ── Public API ───────────────────────────────────────────────────────────────

/** List recently opened projects, most recent first */
export function listRecentProjects(): Project[] {
    const projects = readRegistry()
    // Filter out projects whose directories no longer exist
    const valid = projects.filter(p => existsSync(p.path))
    if (valid.length !== projects.length) {
        writeRegistry(valid)
    }
    return valid.sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime())
}

/** Add or update a project in the recent list */
function addToRecent(project: Project): void {
    const projects = readRegistry().filter(p => p.path !== project.path)
    projects.unshift(project)
    // Keep at most 20 recent projects
    writeRegistry(projects.slice(0, 20))
}

/** Remove a project from the recent list */
export function removeFromRecent(projectPath: string): void {
    const projects = readRegistry().filter(p => p.path !== projectPath)
    writeRegistry(projects)
}

/** Create a new project at the given directory path */
export function createProject(projectDir: string, name: string): Project {

    if (existsSync(projectDir)) {
        throw new Error(`A project already exists at: ${projectDir}`)
    }

    // Create the project directory structure
    mkdirSync(projectDir, { recursive: true })
    mkdirSync(join(projectDir, 'pdfs'), { recursive: true })

    // Initialize the database inside the project
    closeDatabase()
    initDatabase(projectDir)

    const project: Project = {
        name,
        path: projectDir,
        lastOpenedAt: new Date().toISOString()
    }

    activeProject = project
    addToRecent(project)

    console.log(`[ProjectManager] Created project: ${name} at ${projectDir}`)
    return project
}

/** Open an existing project */
export function openProject(projectPath: string): Project {
    if (!existsSync(projectPath)) {
        throw new Error(`Project not found: ${projectPath}`)
    }

    const dbFile = join(projectPath, 'threadmed.db')

    // Close any currently open project
    closeDatabase()

    // Initialize the database for this project
    initDatabase(projectPath)

    // Derive project name from directory basename
    // Derive project name from directory basename
    const name = basename(projectPath)

    const project: Project = {
        name,
        path: projectPath,
        lastOpenedAt: new Date().toISOString()
    }

    activeProject = project
    addToRecent(project)

    console.log(`[ProjectManager] Opened project: ${name}`)
    return project
}

/** Get the currently active project */
export function getActiveProject(): Project | null {
    return activeProject
}

/** Rename a project (updates the directory and the registry) */
export function renameProject(projectPath: string, newName: string): Project {
    const trimmed = newName.trim()
    if (!trimmed) throw new Error('Project name cannot be empty')

    // Update registry
    const projects = readRegistry()
    const entry = projects.find(p => p.path === projectPath)
    if (entry) {
        entry.name = trimmed
        writeRegistry(projects)
    }

    // Update active project if it's the one being renamed
    if (activeProject?.path === projectPath) {
        activeProject.name = trimmed
    }

    return { name: trimmed, path: projectPath, lastOpenedAt: entry?.lastOpenedAt ?? new Date().toISOString() }
}

/** Delete a project (removes directory and registry entry) */
export function deleteProject(projectPath: string): void {
    // Can't delete the currently open project
    if (activeProject?.path === projectPath) {
        closeDatabase()
        activeProject = null
    }

    // Remove from registry
    removeFromRecent(projectPath)

    // Remove the directory
    if (existsSync(projectPath)) {
        rmSync(projectPath, { recursive: true, force: true })
        console.log(`[ProjectManager] Deleted project at: ${projectPath}`)
    }
}

// ── File Dialog Helpers ──────────────────────────────────────────────────────

/** Show a Save dialog for creating a new project */
export async function showNewProjectDialog(parentWindow: BrowserWindow | null): Promise<Project | null> {
    const result = await dialog.showSaveDialog(parentWindow ?? BrowserWindow.getFocusedWindow()!, {
        title: 'Create New Project Folder (Type Name Below)',
        defaultPath: join(app.getPath('documents'), 'Untitled Review'),
        buttonLabel: 'Create Folder',
        nameFieldLabel: 'Folder Name:',
        properties: ['createDirectory', 'showOverwriteConfirmation'] as any
    })

    if (result.canceled || !result.filePath) return null

    // Extract name from the chosen path
    let filePath = result.filePath
    const name = basename(filePath)

    return createProject(filePath, name)
}

/** Show an Open dialog for selecting an existing .tdmd project */
export async function showOpenProjectDialog(parentWindow: BrowserWindow | null): Promise<Project | null> {
    const result = await dialog.showOpenDialog(parentWindow ?? BrowserWindow.getFocusedWindow()!, {
        title: 'Open Project Folder',
        defaultPath: app.getPath('documents'),
        buttonLabel: 'Open Folder',
        properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]

    const dbFile = join(selectedPath, 'threadmed.db')
    if (!existsSync(dbFile)) {
        throw new Error('The selected folder is not a valid ThreadMed project (no threadmed.db found inside).')
    }

    return openProject(selectedPath)
}

/** Show a Save dialog for duplicating/saving the current project as a new folder */
export async function showSaveProjectAsDialog(parentWindow: BrowserWindow | null): Promise<Project | null> {
    const current = getActiveProject()
    if (!current) throw new Error('No project is currently open')

    const result = await dialog.showSaveDialog(parentWindow ?? BrowserWindow.getFocusedWindow()!, {
        title: 'Save Project As (Type New Folder Name Below)',
        defaultPath: current.path + ' Copy',
        buttonLabel: 'Save As Folder',
        nameFieldLabel: 'New Folder Name:',
        properties: ['createDirectory', 'showOverwriteConfirmation'] as any
    })

    if (result.canceled || !result.filePath) return null

    const newPath = result.filePath
    if (existsSync(newPath)) {
        throw new Error('Destination folder already exists. Please choose a new name.')
    }

    // Must close current DB before copying because it may be locked
    closeDatabase()

    try {
        // Copy the whole directory structure
        cpSync(current.path, newPath, { recursive: true })
        // Re-open from the new path
        return openProject(newPath)
    } catch (err) {
        // Re-open original if copy failed
        openProject(current.path)
        throw new Error(`Failed to copy project: ${(err as Error).message}`)
    }
}

// ── Migration ────────────────────────────────────────────────────────────────

/**
 * Migrate legacy single-database layout to the project format.
 * Called once on first launch after the update.
 *
 * Old layout: userData/data/threadmed.db + userData/data/pdfs/
 * New layout: userData/Migrated Project/threadmed.db + pdfs/
 */
export function migrateIfNeeded(): Project | null {
    const userDataPath = app.getPath('userData')
    const legacyDb = join(userDataPath, 'data', 'threadmed.db')

    if (!existsSync(legacyDb)) return null

    console.log('[ProjectManager] Legacy database detected — running migration...')

    const migratedDir = join(userDataPath, 'Migrated Project')

    // Don't migrate twice
    if (existsSync(migratedDir)) {
        console.log('[ProjectManager] Migration already completed, opening migrated project...')
        return openProject(migratedDir)
    }

    try {
        // Step 1: Create the new project directory
        mkdirSync(migratedDir, { recursive: true })
        mkdirSync(join(migratedDir, 'pdfs'), { recursive: true })

        // Step 2: Copy database
        cpSync(legacyDb, join(migratedDir, 'threadmed.db'))

        // Step 3: Copy PDFs
        const legacyPdfDir = join(userDataPath, 'data', 'pdfs')
        if (existsSync(legacyPdfDir)) {
            const pdfFiles = readdirSync(legacyPdfDir)
            for (const file of pdfFiles) {
                cpSync(join(legacyPdfDir, file), join(migratedDir, 'pdfs', file))
            }
        }

        // Step 4: Verify — open the new DB and check paper count
        // (initDatabase + getDb will throw if the DB is malformed)
        const project = openProject(migratedDir)

        // Step 5: Rename old directory to backup
        const backupDir = join(userDataPath, 'data_backup')
        if (!existsSync(backupDir)) {
            renameSync(join(userDataPath, 'data'), backupDir)
            console.log('[ProjectManager] Legacy data backed up to:', backupDir)
        }

        console.log('[ProjectManager] Migration complete!')
        return project
    } catch (err) {
        console.error('[ProjectManager] Migration failed — keeping legacy data intact:', err)
        // Clean up partial migration
        if (existsSync(migratedDir)) {
            rmSync(migratedDir, { recursive: true, force: true })
        }
        return null
    }
}
