// ============================================================================
// ThreadMed — App Root Component
// ============================================================================

import { useState, useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AppShell } from './components/layout/AppShell'
import { LibraryView } from './components/views/LibraryView'
import { PaperView } from './components/views/PaperView'
import { SettingsView } from './components/views/SettingsView'
import { ProjectPicker } from './components/views/ProjectPicker'
import type { ViewId } from './types'

interface Project {
    name: string
    path: string
    lastOpenedAt: string
}

function App() {
    const [activeProject, setActiveProject] = useState<Project | null>(null)
    const [projectLoading, setProjectLoading] = useState(true)
    const [activeView, setActiveView] = useState<ViewId>('library')
    const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

    // On mount, check if a project was auto-opened by the main process
    useEffect(() => {
        ; (async () => {
            try {
                const project = await window.api.projects.active()
                if (project) {
                    setActiveProject(project)
                }
            } catch (err) {
                console.error('[App] Failed to check active project:', err)
            } finally {
                setProjectLoading(false)
            }
        })()
    }, [])

    // Listen for OS native menu events (New, Open, Close Project)
    useEffect(() => {
        const cleanupOpened = window.api.projects.onOpened((project: Project) => {
            handleProjectOpen(project)
        })
        const cleanupClosed = window.api.projects.onClosed(() => {
            handleSwitchProject()
        })
        return () => {
            cleanupOpened()
            cleanupClosed()
        }
    }, [])

    const handleProjectOpen = (project: Project) => {
        setActiveProject(project)
        // Reset app state for the new project
        setActiveView('library')
        setSelectedPaperId(null)
        setSelectedFolderId(null)
    }

    const handleSwitchProject = () => {
        setActiveProject(null)
        setActiveView('library')
        setSelectedPaperId(null)
        setSelectedFolderId(null)
    }

    function renderView() {
        switch (activeView) {
            case 'library':
                return (
                    <LibraryView
                        selectedFolderId={selectedFolderId}
                        onPaperSelect={(id) => { setSelectedPaperId(id); setActiveView('paper') }}
                        onFolderSelect={setSelectedFolderId}
                        onNavigate={(view) => setActiveView(view as ViewId)}
                    />
                )
            case 'matrix':
                return (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
                        <div className="text-center space-y-2">
                            <p className="text-lg font-medium text-[var(--color-text-secondary)]">Synthesis Matrix</p>
                            <p className="text-sm">The EBM Matrix will be built in Phase 4</p>
                        </div>
                    </div>
                )
            case 'search':
                return (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
                        <div className="text-center space-y-2">
                            <p className="text-lg font-medium text-[var(--color-text-secondary)]">Global Search</p>
                            <p className="text-sm">FTS5-powered search will be built in Phase 4</p>
                        </div>
                    </div>
                )
            case 'memos':
                return (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
                        <div className="text-center space-y-2">
                            <p className="text-lg font-medium text-[var(--color-text-secondary)]">Memos</p>
                            <p className="text-sm">Markdown memo editor will be built in Phase 5</p>
                        </div>
                    </div>
                )
            case 'paper':
                return selectedPaperId
                    ? <PaperView paperId={selectedPaperId} onBack={() => setActiveView('library')} />
                    : null
            case 'settings':
                return <SettingsView />
            default:
                return null
        }
    }

    // Show loading spinner while checking for auto-opened project
    if (projectLoading) {
        return (
            <ThemeProvider>
                <div className="h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                </div>
            </ThemeProvider>
        )
    }

    // Show project picker if no project is open
    if (!activeProject) {
        return (
            <ThemeProvider>
                <ProjectPicker onProjectOpen={handleProjectOpen} />
            </ThemeProvider>
        )
    }

    return (
        <ThemeProvider>
            <AppShell
                activeView={activeView}
                onViewChange={(view) => {
                    setActiveView(view)
                }}
                selectedPaperId={selectedPaperId}
                onPaperSelect={setSelectedPaperId}
                selectedFolderId={selectedFolderId}
                onFolderSelect={(id) => {
                    setSelectedFolderId(id)
                    setActiveView('library')
                }}
                projectName={activeProject.name}
                onSwitchProject={handleSwitchProject}
            >
                {renderView()}
            </AppShell>
        </ThemeProvider>
    )
}

export default App
