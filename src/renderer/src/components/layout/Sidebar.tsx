// ============================================================================
// ThreadMed — Sidebar Component
// ============================================================================

import { useState, useEffect } from 'react'
import {
    Library,
    Grid3X3,
    Search,
    StickyNote,
    Tags,
    Plus,
    ChevronDown,
    ChevronRight,
    FileText,
    BookOpen,
    Settings,
    Sun,
    Moon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/ThemeContext'
import type { ViewId, Node, Paper } from '@/types'

interface SidebarProps {
    activeView: ViewId
    onViewChange: (view: ViewId) => void
    onPaperSelect: (paperId: string) => void
    selectedPaperId: string | null
}

interface NavItemProps {
    icon: React.ReactNode
    label: string
    isActive: boolean
    onClick: () => void
    badge?: number
    trailing?: React.ReactNode
}

function NavItem({ icon, label, isActive, onClick, badge, trailing }: NavItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-[13px] transition-all duration-150 no-drag',
                'hover:bg-[var(--color-bg-hover)]',
                isActive
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium shadow-sm'
                    : 'text-[var(--color-text-secondary)]'
            )}
        >
            <span className={cn('shrink-0', isActive ? 'opacity-100' : 'opacity-60')}>{icon}</span>
            <span className="truncate">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="ml-auto text-[10px] font-semibold text-[var(--color-text-tertiary)] bg-[var(--color-bg-active)] px-2 py-0.5 rounded-full min-w-5 text-center">
                    {badge}
                </span>
            )}
            {trailing && <span className="ml-auto">{trailing}</span>}
        </button>
    )
}

export function Sidebar({ activeView, onViewChange, onPaperSelect, selectedPaperId }: SidebarProps) {
    const [papers, setPapers] = useState<Paper[]>([])
    const [nodes, setNodes] = useState<Node[]>([])
    const [libraryExpanded, setLibraryExpanded] = useState(true)
    const [nodesExpanded, setNodesExpanded] = useState(true)
    const { theme, toggleTheme } = useTheme()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            if (!window.api) return
            const [paperList, nodeList] = await Promise.all([
                window.api.papers.list(),
                window.api.nodes.list()
            ])
            setPapers(paperList)
            setNodes(nodeList)
        } catch (err) {
            console.error('[Sidebar] Failed to load data:', err)
        }
    }

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-surface)] select-none">
            {/* ── App Header / Drag Region ─────────────────────────────────── */}
            <div className="drag-region flex items-center gap-3 px-5 h-14 border-b border-[var(--color-border-subtle)] shrink-0">
                <div className="no-drag w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[#0d9488] flex items-center justify-center shadow-sm">
                    <BookOpen size={15} className="text-white" />
                </div>
                <span className="text-sm font-bold tracking-tight text-[var(--color-text-primary)] no-drag flex-1">
                    ThreadMed
                </span>
                {/* Quick Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="no-drag w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-all"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
            </div>

            {/* ── Main Navigation ──────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto py-5 px-4">
                {/* Primary Views */}
                <div className="space-y-1 mb-8">
                    <NavItem
                        icon={<Library size={16} />}
                        label="Library"
                        isActive={activeView === 'library'}
                        onClick={() => onViewChange('library')}
                        badge={papers.length}
                    />
                    <NavItem
                        icon={<Grid3X3 size={16} />}
                        label="Synthesis Matrix"
                        isActive={activeView === 'matrix'}
                        onClick={() => onViewChange('matrix')}
                    />
                    <NavItem
                        icon={<Search size={16} />}
                        label="Global Search"
                        isActive={activeView === 'search'}
                        onClick={() => onViewChange('search')}
                    />
                    <NavItem
                        icon={<StickyNote size={16} />}
                        label="Memos"
                        isActive={activeView === 'memos'}
                        onClick={() => onViewChange('memos')}
                    />
                </div>

                {/* ── Divider ─────────────────────────────────────────────────── */}
                <div className="h-px bg-[var(--color-border-subtle)] mb-6" />

                {/* ── Papers List ─────────────────────────────────────────────── */}
                <div className="mb-6">
                    <button
                        onClick={() => setLibraryExpanded(!libraryExpanded)}
                        className="flex items-center gap-2 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors w-full no-drag"
                    >
                        {libraryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Papers
                    </button>
                    {libraryExpanded && (
                        <div className="mt-2 space-y-1">
                            {papers.length === 0 ? (
                                <p className="px-4 py-3 text-[12px] text-[var(--color-text-tertiary)] italic leading-relaxed">
                                    No papers yet. Import from Zotero or add manually.
                                </p>
                            ) : (
                                papers.map((paper) => (
                                    <button
                                        key={paper.id}
                                        onClick={() => {
                                            onPaperSelect(paper.id)
                                            onViewChange('paper')
                                        }}
                                        className={cn(
                                            'flex items-center gap-3 w-full px-4 py-2 rounded-lg text-[12px] transition-all no-drag text-left',
                                            'hover:bg-[var(--color-bg-hover)]',
                                            selectedPaperId === paper.id
                                                ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)]'
                                                : 'text-[var(--color-text-secondary)]'
                                        )}
                                    >
                                        <FileText size={13} className="shrink-0 opacity-40" />
                                        <span className="truncate flex-1">{paper.title}</span>
                                        {paper.year && (
                                            <span className="text-[10px] text-[var(--color-text-tertiary)] shrink-0 tabular-nums">
                                                {paper.year}
                                            </span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* ── Nodes (Codes) ───────────────────────────────────────────── */}
                <div>
                    <button
                        onClick={() => setNodesExpanded(!nodesExpanded)}
                        className="flex items-center gap-2 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors w-full no-drag"
                    >
                        {nodesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Nodes (Codes)
                    </button>
                    {nodesExpanded && (
                        <div className="mt-2 space-y-1">
                            {nodes.map((node) => (
                                <div
                                    key={node.id}
                                    className="flex items-center gap-3 px-4 py-2 text-[12px] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors cursor-default"
                                >
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                        style={{ backgroundColor: node.color }}
                                    />
                                    <span className="truncate flex-1">{node.name}</span>
                                    {node.is_default === 1 && (
                                        <Tags size={10} className="opacity-25 shrink-0" />
                                    )}
                                </div>
                            ))}
                            <button
                                className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent-subtle)] transition-all w-full no-drag mt-1"
                            >
                                <Plus size={14} className="opacity-60" />
                                <span>Add Custom Node</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom: Settings ──────────────────────────────────────────── */}
            <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 shrink-0">
                <NavItem
                    icon={<Settings size={16} />}
                    label="Settings"
                    isActive={activeView === 'settings'}
                    onClick={() => onViewChange('settings')}
                />
            </div>
        </div>
    )
}
