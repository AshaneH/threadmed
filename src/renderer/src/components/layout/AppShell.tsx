// ============================================================================
// ThreadMed — AppShell (Root Layout)
// ============================================================================
// Three-panel resizable layout with generous spacing and refined aesthetics.
// ============================================================================

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import type { ViewId } from '@/types'

interface AppShellProps {
    activeView: ViewId
    onViewChange: (view: ViewId) => void
    selectedPaperId: string | null
    onPaperSelect: (paperId: string) => void
    children: React.ReactNode
}

export function AppShell({
    activeView,
    onViewChange,
    selectedPaperId,
    onPaperSelect,
    children
}: AppShellProps) {

    const viewTitles: Record<ViewId, string> = {
        library: 'Library',
        matrix: 'Synthesis Matrix',
        search: 'Global Search',
        memos: 'Memos',
        paper: 'Paper Detail',
        settings: 'Settings'
    }

    return (
        <div className="flex flex-col h-screen bg-[var(--color-bg-base)]">
            {/* ── Main Content Area ─────────────────────────────────────────── */}
            <div className="flex-1 min-h-0">
                <PanelGroup direction="horizontal" autoSaveId="threadmed-layout">
                    {/* ── Left: Sidebar ──────────────────────────────────────────── */}
                    <Panel
                        defaultSize={18}
                        minSize={14}
                        maxSize={30}
                        id="sidebar"
                        order={1}
                    >
                        <Sidebar
                            activeView={activeView}
                            onViewChange={onViewChange}
                            onPaperSelect={onPaperSelect}
                            selectedPaperId={selectedPaperId}
                        />
                    </Panel>

                    <PanelResizeHandle className="w-[1px] bg-[var(--color-border-subtle)] hover:bg-[var(--color-accent)] active:bg-[var(--color-accent)] transition-colors duration-150" />

                    {/* ── Center: Main Content ───────────────────────────────────── */}
                    <Panel
                        defaultSize={50}
                        minSize={30}
                        id="main-content"
                        order={2}
                    >
                        <div className="h-full flex flex-col bg-[var(--color-bg-base)]">
                            {/* Header with comfortable height */}
                            <div className="drag-region h-[52px] border-b border-[var(--color-border-subtle)] flex items-center px-6 shrink-0">
                                <h2 className="text-[14px] font-semibold text-[var(--color-text-secondary)] no-drag tracking-tight">
                                    {viewTitles[activeView]}
                                </h2>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {children}
                            </div>
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-[1px] bg-[var(--color-border-subtle)] hover:bg-[var(--color-accent)] active:bg-[var(--color-accent)] transition-colors duration-150" />

                    {/* ── Right: Detail / PDF Pane ────────────────────────────────── */}
                    <Panel
                        defaultSize={32}
                        minSize={20}
                        maxSize={55}
                        id="detail-pane"
                        order={3}
                    >
                        <div className="h-full flex flex-col bg-[var(--color-bg-elevated)]">
                            <div className="drag-region h-[52px] border-b border-[var(--color-border-subtle)] flex items-center px-6 shrink-0">
                                <h2 className="text-[14px] font-semibold text-[var(--color-text-tertiary)] no-drag tracking-tight">
                                    Document Preview
                                </h2>
                            </div>
                            <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)] text-sm p-8">
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-active)] flex items-center justify-center mx-auto">
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                    </div>
                                    <p className="text-[14px] font-medium text-[var(--color-text-secondary)]">Select a paper to preview</p>
                                    <p className="text-[12px] text-[var(--color-text-tertiary)] opacity-60 leading-relaxed max-w-[200px] mx-auto">
                                        PDF viewer and annotation tools will be available in Phase 3
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </div>

            {/* ── Status Bar ────────────────────────────────────────────────── */}
            <StatusBar />
        </div>
    )
}
