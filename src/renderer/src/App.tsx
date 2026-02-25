// ============================================================================
// ThreadMed — App Root Component
// ============================================================================

import { useState } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AppShell } from './components/layout/AppShell'
import { LibraryView } from './components/views/LibraryView'
import { SettingsView } from './components/views/SettingsView'
import type { ViewId } from './types'

function App() {
    const [activeView, setActiveView] = useState<ViewId>('library')
    const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

    function renderView() {
        switch (activeView) {
            case 'library':
                return (
                    <LibraryView
                        selectedFolderId={selectedFolderId}
                        onPaperSelect={(id) => { setSelectedPaperId(id); setActiveView('paper') }}
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
                return (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
                        <div className="text-center space-y-2">
                            <p className="text-lg font-medium text-[var(--color-text-secondary)]">Paper Detail</p>
                            <p className="text-sm">
                                {selectedPaperId ? `Selected paper: ${selectedPaperId}` : 'No paper selected'}
                            </p>
                            <p className="text-sm">PDF viewer & annotations will be built in Phase 3</p>
                        </div>
                    </div>
                )
            case 'settings':
                return <SettingsView />
            default:
                return null
        }
    }

    return (
        <ThemeProvider>
            <AppShell
                activeView={activeView}
                onViewChange={(view) => {
                    setActiveView(view)
                    if (view !== 'library') setSelectedFolderId(null)
                }}
                selectedPaperId={selectedPaperId}
                onPaperSelect={setSelectedPaperId}
                selectedFolderId={selectedFolderId}
                onFolderSelect={(id) => {
                    setSelectedFolderId(id)
                    setActiveView('library')
                }}
            >
                {renderView()}
            </AppShell>
        </ThemeProvider>
    )
}

export default App
