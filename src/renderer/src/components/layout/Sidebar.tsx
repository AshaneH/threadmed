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
    Moon,
    Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/ThemeContext'
import { triggerDataRefresh, useDataRefresh } from '@/lib/events'
import { Folder as FolderIcon } from 'lucide-react'
import { getTreeDepth, isDescendant, getPathDepth } from '@/lib/dnd'
import type { ViewId, Node, Paper, PaperWithAuthors, Folder } from '@/types'

interface SidebarProps {
    activeView: ViewId
    onViewChange: (view: ViewId) => void
    onPaperSelect: (paperId: string) => void
    selectedPaperId: string | null
    selectedFolderId: string | null
    onFolderSelect: (folderId: string | null) => void
    projectName?: string
    onSwitchProject?: () => void
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
                <span className={cn(
                    'ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded-full transition-colors',
                    isActive ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)] group-hover:bg-[var(--color-border-subtle)]'
                )}>
                    {badge}
                </span>
            )}
            {trailing && <div className="ml-auto">{trailing}</div>}
        </button>
    )
}

// ── Recursive Folder Node Component ─────────────────────────────────────────

interface FolderTreeNode extends Folder {
    children: FolderTreeNode[]
}

interface FolderNodeProps {
    node: FolderTreeNode
    level: number
    // State & Callbacks
    expandedFolders: Record<string, boolean>
    setExpandedFolders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    folderPapersMap: Record<string, string[]>
    papers: Paper[]
    allFolders: Folder[]
    dragOverFolderId: string | null
    setDragOverFolderId: (id: string | null) => void
    selectedFolderId: string | null
    onFolderSelect: (id: string | null) => void
    activeView: ViewId
    onViewChange: (view: ViewId) => void
    selectedPaperId: string | null
    onPaperSelect: (id: string) => void
    loadData: () => Promise<void>
}

function FolderNode({
    node,
    level,
    expandedFolders,
    setExpandedFolders,
    folderPapersMap,
    papers,
    allFolders,
    dragOverFolderId,
    setDragOverFolderId,
    selectedFolderId,
    onFolderSelect,
    activeView,
    onViewChange,
    selectedPaperId,
    onPaperSelect,
    loadData
}: FolderNodeProps) {
    const isExpanded = expandedFolders[node.id]
    const folderPaperIds = folderPapersMap[node.id] || []
    const folderPapers = papers.filter(p => folderPaperIds.includes(p.id))



    return (
        <div className="space-y-0.5">
            <button
                draggable
                onDragStart={(e) => {
                    e.stopPropagation()
                    e.dataTransfer.setData('application/threadmed-folder', node.id)
                    // We need to pass the whole tree structure conceptually or just check on drop
                    // To do it safely, we verify cyclings on the backend or inside the drop handler.
                }}
                onDragOver={(e) => {
                    const draggingFolderId = e.dataTransfer.types.find(t => t.startsWith('application/threadmed-dragged-depth-'))
                    if (e.dataTransfer.types.includes('application/threadmed-paper')) {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setDragOverFolderId(node.id)
                    } else if (e.dataTransfer.types.includes('application/threadmed-folder')) {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setDragOverFolderId(node.id)
                    }
                }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOverFolderId(null)

                    const pId = e.dataTransfer.getData('application/threadmed-paper')
                    const sourceFolderId = e.dataTransfer.getData('application/threadmed-source-folder')
                    const draggedFolderId = e.dataTransfer.getData('application/threadmed-folder')

                    if (draggedFolderId) {
                        if (draggedFolderId !== node.id) {
                            const draggedDepth = getTreeDepth(allFolders, draggedFolderId)

                            // Check if nesting exceeds 3 levels
                            const targetPathDepth = getPathDepth(allFolders, node.id)
                            if (targetPathDepth + draggedDepth > 3) {
                                alert(`Cannot drop here! Folders can only be nested 3 levels deep.`)
                                return
                            }

                            if (isDescendant(allFolders, node.id, draggedFolderId)) {
                                alert("Cannot drop a folder into itself or its own subfolder.")
                                return
                            }

                            try {
                                await window.api.folders.update(draggedFolderId, { parent_id: node.id })
                                loadData()
                                triggerDataRefresh()
                            } catch (err) {
                                console.error('[FolderNode onDrop] Error updating folder:', err)
                            }
                        }
                    } else if (pId && sourceFolderId !== node.id) {
                        if (sourceFolderId) {
                            await window.api.folders.removePaper(pId, sourceFolderId)
                        }
                        await window.api.folders.addPaper(pId, node.id)
                        loadData()
                        triggerDataRefresh()
                    }
                }}
                onClick={(e) => {
                    e.stopPropagation()
                    if (activeView !== 'library') onViewChange('library')
                    onFolderSelect(node.id)
                    setExpandedFolders(prev => ({ ...prev, [node.id]: !prev[node.id] }))
                }}
                className={cn(
                    'flex items-center gap-2 w-full py-1.5 rounded-lg text-[12px] transition-all text-left group',
                    dragOverFolderId === node.id
                        ? 'bg-[var(--color-accent-subtle)] border outline-dashed outline-1 outline-[var(--color-accent)]'
                        : selectedFolderId === node.id && activeView === 'library'
                            ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-bg-hover)]'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                )}
                style={{ paddingLeft: `${Math.max(12, level * 16)}px`, paddingRight: '12px' }}
            >
                <div
                    className="w-4 h-4 flex items-center justify-center shrink-0 opacity-40 hover:opacity-100 hover:bg-[var(--color-bg-active)] rounded transition-colors"
                    onClick={(e) => {
                        e.stopPropagation()
                        setExpandedFolders(prev => ({ ...prev, [node.id]: !prev[node.id] }))
                    }}
                >
                    {(node.children.length > 0 || folderPapers.length > 0) ? (
                        isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                    ) : (
                        <div className="w-1 h-1 rounded-full bg-current opacity-30" />
                    )}
                </div>
                <FolderIcon size={12} className={cn("shrink-0", selectedFolderId === node.id ? "text-[var(--color-accent)]" : "opacity-40")} />
                <span className="truncate flex-1">{node.name}</span>

                <div
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-500 rounded transition-all shrink-0 text-[var(--color-text-tertiary)]"
                    onClick={async (e) => {
                        e.stopPropagation()
                        if (window.confirm(`Are you sure you want to delete the folder "${node.name}"?\nPapers inside the folder will NOT be deleted.`)) {
                            await window.api.folders.delete(node.id)
                            if (selectedFolderId === node.id) {
                                onFolderSelect(null)
                            }
                            loadData()
                        }
                    }}
                    title="Delete Folder"
                >
                    <Trash2 size={12} />
                </div>
            </button>

            {/* Nested Content: Subfolders & Papers */}
            {isExpanded && (
                <div className="space-y-0.5 mt-0.5 relative">
                    {/* Vertical line connecting children */}
                    <div className="absolute left-[calc(18px+var(--padding-level))] top-0 bottom-2 w-px bg-[var(--color-border-subtle)]" style={{ '--padding-level': `${level * 16}px` } as any} />

                    {node.children.map(child => (
                        <FolderNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            expandedFolders={expandedFolders}
                            setExpandedFolders={setExpandedFolders}
                            folderPapersMap={folderPapersMap}
                            papers={papers}
                            allFolders={allFolders}
                            dragOverFolderId={dragOverFolderId}
                            setDragOverFolderId={setDragOverFolderId}
                            selectedFolderId={selectedFolderId}
                            onFolderSelect={onFolderSelect}
                            activeView={activeView}
                            onViewChange={onViewChange}
                            selectedPaperId={selectedPaperId}
                            onPaperSelect={onPaperSelect}
                            loadData={loadData}
                        />
                    ))}

                    {folderPapers.length > 0 && (
                        <div className="space-y-0.5">
                            {folderPapers.map(paper => (
                                <button
                                    key={paper.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation() // Prevent dragging the folder
                                        e.dataTransfer.setData('application/threadmed-paper', paper.id)
                                        e.dataTransfer.setData('application/threadmed-source-folder', node.id)
                                    }}
                                    onClick={() => {
                                        onPaperSelect(paper.id)
                                        onViewChange('paper')
                                    }}
                                    className={cn(
                                        'flex items-center gap-2 w-full py-1.5 rounded-md text-[11px] transition-all no-drag text-left',
                                        'hover:bg-[var(--color-bg-hover)]',
                                        selectedPaperId === paper.id && activeView === 'paper'
                                            ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)] font-medium'
                                            : 'text-[var(--color-text-secondary)]'
                                    )}
                                    style={{ paddingLeft: `${Math.max(12, (level + 1) * 16 + 22)}px`, paddingRight: '12px' }}
                                    title={paper.title}
                                >
                                    <FileText size={11} className={cn("shrink-0 relative z-10", paper.pdf_filename ? 'text-[var(--color-accent)] opacity-70' : 'opacity-25')} />
                                    <span className="truncate flex-1 relative z-10">{paper.title}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {node.children.length === 0 && folderPapers.length === 0 && (
                        <p className="py-1.5 text-[11px] text-[var(--color-text-tertiary)] italic" style={{ paddingLeft: `${Math.max(12, (level + 1) * 16 + 22)}px` }}>
                            Empty folder
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}



export function Sidebar({ activeView, onViewChange, onPaperSelect, selectedPaperId, selectedFolderId, onFolderSelect, projectName, onSwitchProject }: SidebarProps) {
    const [papers, setPapers] = useState<Paper[]>([])
    const [nodes, setNodes] = useState<Node[]>([])
    const [folders, setFolders] = useState<Folder[]>([])

    // UI state
    const [libraryExpanded, setLibraryExpanded] = useState(true)
    const [nodesExpanded, setNodesExpanded] = useState(true)
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
    const [folderPapersMap, setFolderPapersMap] = useState<Record<string, string[]>>({})
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

    const { theme, toggleTheme } = useTheme()

    useEffect(() => {
        loadData()
    }, [])

    useDataRefresh(loadData)

    async function loadData() {
        try {
            if (!window.api) return
            const [paperList, nodeList, folderList, mappings] = await Promise.all([
                window.api.papers.list(),
                window.api.nodes.list(),
                window.api.folders.list(),
                window.api.folders.getMappings()
            ])

            const mappingDict: Record<string, string[]> = {}
            for (const { paper_id, folder_id } of mappings) {
                if (!mappingDict[folder_id]) mappingDict[folder_id] = []
                mappingDict[folder_id].push(paper_id)
            }

            setPapers(paperList)
            setNodes(nodeList)
            setFolders(folderList)
            setFolderPapersMap(mappingDict)
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

            {/* ── Project Indicator ──────────────────────────────────────── */}
            {projectName && (
                <button
                    onClick={onSwitchProject}
                    className="no-drag flex items-center gap-2 mx-4 mt-3 px-3 py-2 rounded-lg bg-[var(--color-bg-active)] hover:bg-[var(--color-bg-hover)] transition-colors group border border-[var(--color-border-subtle)]"
                    title="Switch project"
                >
                    <div className="w-5 h-5 rounded bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                        <FileText size={11} className="text-[var(--color-accent)]" />
                    </div>
                    <span className="text-[12px] font-medium text-[var(--color-text-secondary)] truncate flex-1 text-left">
                        {projectName}
                    </span>
                    <ChevronDown size={12} className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
            )}

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

                {/* ── Library Tree (Folders + Papers) ─────────────────────────── */}
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
                            {/* All Papers Root */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (activeView !== 'library') onViewChange('library')
                                    onFolderSelect(null)
                                }}
                                onDragOver={(e) => {
                                    if (e.dataTransfer.types.includes('application/threadmed-folder') || e.dataTransfer.types.includes('application/threadmed-paper')) {
                                        e.preventDefault()
                                        e.dataTransfer.dropEffect = 'move'
                                        setDragOverFolderId('root')
                                    }
                                }}
                                onDragLeave={() => setDragOverFolderId(null)}
                                onDrop={async (e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setDragOverFolderId(null)

                                    const draggedFolderId = e.dataTransfer.getData('application/threadmed-folder')
                                    const pId = e.dataTransfer.getData('application/threadmed-paper')
                                    const sourceFolderId = e.dataTransfer.getData('application/threadmed-source-folder')

                                    if (draggedFolderId) {
                                        await window.api.folders.update(draggedFolderId, { parent_id: null })
                                        loadData()
                                        triggerDataRefresh()
                                    } else if (pId && sourceFolderId) {
                                        await window.api.folders.removePaper(pId, sourceFolderId)
                                        loadData()
                                        triggerDataRefresh()
                                    }
                                }}
                                className={cn(
                                    'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[12px] transition-all no-drag text-left group',
                                    dragOverFolderId === 'root'
                                        ? 'bg-[var(--color-accent-subtle)] border outline-dashed outline-1 outline-[var(--color-accent)]'
                                        : 'hover:bg-[var(--color-bg-hover)]',
                                    selectedFolderId === null && activeView === 'library'
                                        ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)] font-medium'
                                        : 'text-[var(--color-text-secondary)]'
                                )}
                            >
                                <div className="w-4 h-4 shrink-0" /> {/* Spacer for alignment */}
                                <Library size={12} className={cn("shrink-0", selectedFolderId === null ? "text-[var(--color-accent)]" : "opacity-40")} />
                                <span className="truncate flex-1">All Papers</span>
                            </button>

                            {/* Nested Folders Tree */}
                            {(() => {
                                // Build tree
                                const map = new Map<string, FolderTreeNode>()
                                const roots: FolderTreeNode[] = []

                                for (const f of folders) {
                                    map.set(f.id, { ...f, children: [] })
                                }
                                for (const f of folders) {
                                    const node = map.get(f.id)!
                                    if (f.parent_id && map.has(f.parent_id)) {
                                        map.get(f.parent_id)!.children.push(node)
                                    } else {
                                        roots.push(node)
                                    }
                                }

                                return roots.map((rootNode) => (
                                    <FolderNode
                                        key={rootNode.id}
                                        node={rootNode}
                                        level={0}
                                        expandedFolders={expandedFolders}
                                        setExpandedFolders={setExpandedFolders}
                                        folderPapersMap={folderPapersMap}
                                        papers={papers}
                                        allFolders={folders}
                                        dragOverFolderId={dragOverFolderId}
                                        setDragOverFolderId={setDragOverFolderId}
                                        selectedFolderId={selectedFolderId}
                                        onFolderSelect={onFolderSelect}
                                        activeView={activeView}
                                        onViewChange={onViewChange}
                                        selectedPaperId={selectedPaperId}
                                        onPaperSelect={onPaperSelect}
                                        loadData={loadData}
                                    />
                                ))
                            })()}

                            {/* Create New Folder */}
                            {isCreatingFolder ? (
                                <div className="px-3 py-1 block">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && newFolderName.trim()) {
                                                await window.api.folders.create(newFolderName.trim())
                                                setNewFolderName('')
                                                setIsCreatingFolder(false)
                                                loadData()
                                            } else if (e.key === 'Escape') {
                                                setIsCreatingFolder(false)
                                                setNewFolderName('')
                                            }
                                        }}
                                        onBlur={() => {
                                            setIsCreatingFolder(false)
                                            setNewFolderName('')
                                        }}
                                        placeholder="Folder name..."
                                        className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[12px] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-all w-full no-drag mt-1 mb-2"
                                >
                                    <Plus size={12} className="opacity-60 ml-1" />
                                    <span>New Folder</span>
                                </button>
                            )}

                            {/* Unassigned Papers List */}
                            {(() => {
                                const allAssignedPaperIds = new Set(Object.values(folderPapersMap).flat())
                                const unassignedPapers = papers.filter(p => !allAssignedPaperIds.has(p.id))

                                if (papers.length === 0) {
                                    return (
                                        <p className="px-4 py-3 text-[12px] text-[var(--color-text-tertiary)] italic leading-relaxed">
                                            No papers yet. Import from Zotero or add manually.
                                        </p>
                                    )
                                }

                                if (unassignedPapers.length === 0) return null

                                return (
                                    <div className="pt-2 border-t border-[var(--color-border-subtle)]/50 mt-2 space-y-0.5">
                                        {unassignedPapers.map(paper => (
                                            <button
                                                key={paper.id}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('application/threadmed-paper', paper.id)
                                                }}
                                                onClick={() => {
                                                    onPaperSelect(paper.id)
                                                    onViewChange('paper')
                                                }}
                                                className={cn(
                                                    'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[12px] transition-all no-drag text-left',
                                                    'hover:bg-[var(--color-bg-hover)]',
                                                    selectedPaperId === paper.id && activeView === 'paper'
                                                        ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)] font-medium'
                                                        : 'text-[var(--color-text-secondary)]'
                                                )}
                                                title={paper.title}
                                            >
                                                <FileText size={12} className={cn("shrink-0 ml-1", paper.pdf_filename ? 'text-[var(--color-accent)] opacity-70' : 'opacity-25')} />
                                                <span className="truncate flex-1">{paper.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>
                    )}
                </div>

                {/* ── Nodes ─────────────────────────────────────────────────── */}
                <div>
                    <button
                        onClick={() => setNodesExpanded(!nodesExpanded)}
                        className="flex items-center gap-2 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors w-full no-drag"
                    >
                        {nodesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Nodes
                    </button>
                    {nodesExpanded && (
                        <div className="mt-2 space-y-1">
                            {nodes.map((node) => (
                                <button
                                    key={node.id}
                                    onClick={() => onViewChange('matrix')}
                                    className="flex items-center gap-3 px-4 py-2 text-[12px] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer w-full text-left no-drag"
                                >
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                        style={{ backgroundColor: node.color }}
                                    />
                                    <span className="truncate flex-1">{node.name}</span>
                                    {node.is_default === 1 && (
                                        <Tags size={10} className="opacity-25 shrink-0" />
                                    )}
                                </button>
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
