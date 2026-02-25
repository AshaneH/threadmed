// ============================================================================
// ThreadMed — Library View
// ============================================================================

import { useState, useEffect, Fragment } from 'react'
import { BookOpen, ExternalLink, Plus, FileText, Trash2, Folder as FolderIcon, Edit2, ChevronRight } from 'lucide-react'
import { PaperDialog } from './PaperDialog'
import { triggerDataRefresh, useDataRefresh } from '@/lib/events'
import { isDescendant, getPathDepth, getTreeDepth } from '@/lib/dnd'
import { cn } from '@/lib/utils'
import type { Paper, Folder, CreatePaperInput, PaperWithAuthors } from '@/types'

interface LibraryViewProps {
    selectedFolderId: string | null
    onPaperSelect: (id: string) => void
    onFolderSelect: (id: string | null) => void
    onNavigate: (view: string) => void
}

export function LibraryView({ selectedFolderId, onPaperSelect, onFolderSelect, onNavigate }: LibraryViewProps) {
    const [papers, setPapers] = useState<Paper[]>([])
    const [currentFolder, setCurrentFolder] = useState<Folder | null>(null)
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPaper, setEditingPaper] = useState<PaperWithAuthors | null>(null)
    const [folders, setFolders] = useState<Folder[]>([])
    const [paperFoldersMap, setPaperFoldersMap] = useState<Record<string, string[]>>({})
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [selectedFolderId])

    useDataRefresh(loadData)

    async function loadData() {
        try {
            setLoading(true)
            if (!window.api) return

            // Load all folders and mappings so we can show badges
            const [folderList, mappings] = await Promise.all([
                window.api.folders.list(),
                window.api.folders.getMappings()
            ])
            setFolders(folderList)

            // Build map of paperId -> array of folderIds
            const pMap: Record<string, string[]> = {}
            for (const { paper_id, folder_id } of mappings) {
                if (!pMap[paper_id]) pMap[paper_id] = []
                pMap[paper_id].push(folder_id)
            }
            setPaperFoldersMap(pMap)

            // If viewing a folder, load that folder's details and papers
            if (selectedFolderId) {
                const folderPapers = await window.api.folders.getPapers(selectedFolderId)
                const folder = folderList.find((f: Folder) => f.id === selectedFolderId) || null
                setCurrentFolder(folder)
                setPapers(folderPapers)
            } else {
                // Otherwise load all papers
                const list = await window.api.papers.list()
                setCurrentFolder(null)
                setPapers(list)
            }
        } catch (err) {
            console.error('[LibraryView] Failed to load papers:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(e: React.MouseEvent, id: string) {
        e.stopPropagation() // Prevent selecting the paper
        if (confirm('Are you sure you want to delete this paper? This will also delete any annotations and the PDF file from disk.')) {
            try {
                await window.api.papers.delete(id)
                await loadData() // Refresh view
                triggerDataRefresh() // Refresh Sidebar & StatusBar
            } catch (err) {
                console.error('[LibraryView] Failed to delete paper:', err)
                alert('Failed to delete paper. See console for details.')
            }
        }
    }

    async function handleSavePaper(data: CreatePaperInput) {
        if (editingPaper) {
            await window.api.papers.update(editingPaper.id, data)
        } else {
            const newPaper = await window.api.papers.create(data)
            if (selectedFolderId) {
                // Auto-add to the current folder
                await window.api.folders.addPaper(newPaper.id, selectedFolderId)
            }
        }
        await loadData()
        triggerDataRefresh()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-[var(--color-text-tertiary)] text-sm">Loading library...</div>
            </div>
        )
    }

    const subfolders = currentFolder
        ? folders.filter(f => f.parent_id === currentFolder.id)
        : folders.filter(f => f.parent_id === null)

    // ── Empty State: Welcome Screen ──────────────────────────────────────────
    if (!currentFolder && papers.length === 0 && subfolders.length === 0) {
        return (
            <div className="flex items-center justify-center h-full px-8">
                <div className="text-center space-y-10 max-w-xl animate-fade-in">
                    {/* Logo / Icon */}
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--color-accent)] to-[#0d9488] flex items-center justify-center mx-auto shadow-xl shadow-[var(--color-accent)]/15">
                        <BookOpen size={42} className="text-white" />
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
                            Welcome to ThreadMed
                        </h1>
                        <p className="text-[var(--color-text-secondary)] text-[15px] leading-relaxed max-w-md mx-auto">
                            Your literature synthesis workbench for evidence-based medicine.
                            Import papers from Zotero, annotate with PICO codes, and build your
                            synthesis matrix.
                        </p>
                    </div>

                    {/* Getting Started Steps */}
                    <div className="space-y-4 text-left">
                        <div className="flex gap-5 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center text-[13px] font-bold shrink-0">
                                1
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                    Connect Zotero
                                </p>
                                <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed">
                                    Link your Zotero library to import papers, metadata, and PDFs automatically.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-5 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-node-intervention)]/15 text-[var(--color-node-intervention)] flex items-center justify-center text-[13px] font-bold shrink-0">
                                2
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                    Annotate & Code
                                </p>
                                <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed">
                                    Highlight text in PDFs and assign to PICO nodes: Population, Intervention,
                                    Comparison, Outcomes.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-5 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-node-outcomes)]/15 text-[var(--color-node-outcomes)] flex items-center justify-center text-[13px] font-bold shrink-0">
                                3
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                    Synthesize
                                </p>
                                <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed">
                                    View the Synthesis Matrix, search across all papers, and draft your
                                    review with linked evidence.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-5 justify-center pt-1">
                        <button
                            onClick={() => onNavigate('settings')}
                            className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[var(--color-accent)] text-white text-[14px] font-semibold hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/20 hover:shadow-xl hover:shadow-[var(--color-accent)]/30 hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <ExternalLink size={16} />
                            Connect Zotero
                        </button>
                        <button
                            onClick={() => {
                                setEditingPaper(null)
                                setIsDialogOpen(true)
                            }}
                            className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[14px] font-semibold hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-text-tertiary)] transition-all hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <Plus size={16} />
                            Add Paper Manually
                        </button>
                    </div>
                </div>

                <PaperDialog
                    isOpen={isDialogOpen}
                    onClose={() => setIsDialogOpen(false)}
                    onSave={handleSavePaper}
                />
            </div>
        )
    }



    const handleDropOnFolder = async (e: React.DragEvent, targetId: string | null) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverFolderId(null)

        const pId = e.dataTransfer.getData('application/threadmed-paper')
        const sourceFolderId = e.dataTransfer.getData('application/threadmed-source-folder')
        const draggedFolderId = e.dataTransfer.getData('application/threadmed-folder')

        if (draggedFolderId) {
            if (draggedFolderId !== targetId) {
                if (targetId && isDescendant(folders, targetId, draggedFolderId)) {
                    alert("Cannot drop a folder into itself or its own subfolder.")
                    return
                }

                const targetDepth = getPathDepth(folders, targetId)
                const draggedDepth = getTreeDepth(folders, draggedFolderId)
                if (targetDepth + draggedDepth > 3) {
                    alert(`Cannot drop here! Folders can only be nested 3 levels deep.`)
                    return
                }

                try {
                    await window.api.folders.update(draggedFolderId, { parent_id: targetId })
                    await loadData()
                    triggerDataRefresh()
                } catch (err) {
                    console.error('[LibraryView onDrop] Error updating folder:', err)
                }
            }
        } else if (pId && sourceFolderId !== targetId) {
            if (sourceFolderId) {
                await window.api.folders.removePaper(pId, sourceFolderId)
            }
            if (targetId) {
                await window.api.folders.addPaper(pId, targetId)
            }
            await loadData()
            triggerDataRefresh()
        }
    }

    // ── Paper List ─────────────────────────────────────────────────────────────
    return (
        <div className="p-6 space-y-3 animate-fade-in relative">
            <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2.5">
                        <button
                            onClick={() => onFolderSelect(null)}
                            onDragOver={(e) => {
                                if (e.dataTransfer.types.includes('application/threadmed-paper') || e.dataTransfer.types.includes('application/threadmed-folder')) {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                    if (currentFolder !== null) setDragOverFolderId('root') // Only highlight if not currently in root
                                }
                            }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => handleDropOnFolder(e, null)}
                            className={cn(
                                "transition-colors px-2 py-1 rounded-md",
                                dragOverFolderId === 'root'
                                    ? "bg-[var(--color-accent-subtle)] outline-dashed outline-1 outline-[var(--color-accent)] text-[var(--color-accent)]"
                                    : currentFolder ? "text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"
                            )}
                        >
                            Library
                        </button>

                        {(() => {
                            if (!currentFolder) return null;
                            const path: Folder[] = [];
                            let curr: Folder | undefined = currentFolder;
                            while (curr) {
                                path.unshift(curr);
                                const currentParentId: string | null = curr.parent_id;
                                curr = currentParentId ? folders.find(f => f.id === currentParentId) : undefined;
                            }
                            return path.map((folder, index) => (
                                <Fragment key={folder.id}>
                                    <ChevronRight size={18} className="text-[var(--color-text-tertiary)]" />
                                    <button
                                        onClick={() => onFolderSelect(folder.id)}
                                        onDragOver={(e) => {
                                            if (e.dataTransfer.types.includes('application/threadmed-paper') || e.dataTransfer.types.includes('application/threadmed-folder')) {
                                                e.preventDefault()
                                                e.dataTransfer.dropEffect = 'move'
                                                if (folder.id !== currentFolder.id) setDragOverFolderId(folder.id)
                                            }
                                        }}
                                        onDragLeave={() => setDragOverFolderId(null)}
                                        onDrop={(e) => handleDropOnFolder(e, folder.id)}
                                        className={cn(
                                            "flex items-center gap-2.5 transition-colors min-w-0 shrink px-2 py-1 rounded-md",
                                            dragOverFolderId === folder.id
                                                ? "bg-[var(--color-accent-subtle)] outline-dashed outline-1 outline-[var(--color-accent)] text-[var(--color-accent)]"
                                                : index === path.length - 1
                                                    ? "text-[var(--color-text-primary)] cursor-default"
                                                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
                                        )}
                                        disabled={index === path.length - 1}
                                    >
                                        {index === path.length - 1 && <FolderIcon size={20} className="text-[var(--color-accent)] shrink-0" />}
                                        <span className="truncate max-w-[400px]">{folder.name}</span>
                                    </button>
                                </Fragment>
                            ))
                        })()}
                        <span className="ml-1 text-[14px] font-normal text-[var(--color-text-tertiary)] shrink-0 bg-[var(--color-bg-elevated)] px-2.5 py-0.5 rounded-full border border-[var(--color-border-subtle)]">
                            {papers.length}
                        </span>
                    </h2>
                </div>
                <button
                    onClick={() => {
                        setEditingPaper(null)
                        setIsDialogOpen(true)
                    }}
                    className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-[13px] font-semibold hover:bg-[var(--color-accent-hover)] transition-all shadow-md shadow-[var(--color-accent)]/15 hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Plus size={14} />
                    Add Paper
                </button>
            </div>

            {/* Subfolders */}
            {subfolders.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {subfolders.map(folder => (
                        <button
                            key={folder.id}
                            draggable
                            onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.setData('application/threadmed-folder', folder.id)
                            }}
                            onDragOver={(e) => {
                                if (e.dataTransfer.types.includes('application/threadmed-paper') || e.dataTransfer.types.includes('application/threadmed-folder')) {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                    setDragOverFolderId(folder.id)
                                }
                            }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => handleDropOnFolder(e, folder.id)}
                            onClick={() => onFolderSelect(folder.id)}
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border transition-all text-left group",
                                dragOverFolderId === folder.id
                                    ? "bg-[var(--color-accent-subtle)] border-[var(--color-accent)] border-dashed"
                                    : "bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]"
                            )}
                        >
                            <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-active)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-accent)]/20 transition-colors">
                                <FolderIcon size={18} className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-snug truncate group-hover:text-[var(--color-accent)] transition-colors">
                                    {folder.name}
                                </h3>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {papers.map((paper) => (
                <div
                    key={paper.id}
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('application/threadmed-paper', paper.id)
                        if (currentFolder) {
                            e.dataTransfer.setData('application/threadmed-source-folder', currentFolder.id)
                        }
                    }}
                    className="w-full text-left p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-all group hover:-translate-y-0.5 active:translate-y-0 relative cursor-pointer"
                    onClick={() => onPaperSelect(paper.id)}
                >
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-active)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-accent-subtle)] transition-colors">
                            <FileText size={18} className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-snug group-hover:text-[var(--color-accent)] transition-colors pr-12 line-clamp-2">
                                {paper.title}
                            </h3>
                            <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed truncate">
                                {paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Author'}
                                {paper.year ? ` · ${paper.year} ` : ''}
                                {paper.journal ? ` · ${paper.journal} ` : ''}
                            </p>
                            {/* Folder Badges */}
                            {paperFoldersMap[paper.id] && paperFoldersMap[paper.id].length > 0 && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                    {paperFoldersMap[paper.id].map(fId => {
                                        const fName = folders.find(f => f.id === fId)?.name
                                        if (!fName) return null
                                        return (
                                            <span key={fId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-bg-active)] border border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-tertiary)]">
                                                <FolderIcon size={9} />
                                                <span className="truncate max-w-[100px]">{fName}</span>
                                            </span>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation()
                                    // Fetch full paper details (including authors as an array) before editing
                                    const fullPaper = await window.api.papers.get(paper.id)
                                    setEditingPaper(fullPaper)
                                    setIsDialogOpen(true)
                                }}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors"
                                title="Edit Paper"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={(e) => handleDelete(e, paper.id)}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                title="Delete Paper"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            {/* Folder Empty State */}
            {currentFolder && papers.length === 0 && subfolders.length === 0 && (
                <div
                    className={cn(
                        "flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-2xl transition-all mt-4",
                        dragOverFolderId === currentFolder.id
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                            : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/50 opacity-80"
                    )}
                    onDragOver={(e) => {
                        if (e.dataTransfer.types.includes('application/threadmed-paper') || e.dataTransfer.types.includes('application/threadmed-folder')) {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                            setDragOverFolderId(currentFolder.id)
                        }
                    }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => handleDropOnFolder(e, currentFolder.id)}
                >
                    <FolderIcon size={42} className={cn("mb-3 transition-opacity", dragOverFolderId === currentFolder.id ? "text-[var(--color-accent)] opacity-100" : "opacity-30")} />
                    <p className="text-[14px] font-medium text-[var(--color-text-secondary)]">This folder is empty</p>
                    <p className="text-[13px] mt-1 text-[var(--color-text-tertiary)]">Drag papers or folders here to organize.</p>
                </div>
            )}

            <PaperDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onSave={handleSavePaper}
                initialData={editingPaper}
            />
        </div>
    )
}
