// ============================================================================
// ThreadMed — Project Picker (Landing Screen)
// ============================================================================
// Shown when no project is open. Lets the user create a new project,
// open an existing .tdmd project, or pick from recent projects.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { FolderOpen, Plus, Trash2, Clock, FileText, ChevronRight, Edit2, Check, X } from 'lucide-react'

interface Project {
    name: string
    path: string
    lastOpenedAt: string
}

interface ProjectPickerProps {
    onProjectOpen: (project: Project) => void
}

export function ProjectPicker({ onProjectOpen }: ProjectPickerProps) {
    const [recentProjects, setRecentProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Rename state
    const [editingPath, setEditingPath] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const editInputRef = useRef<HTMLInputElement>(null)

    const loadRecent = useCallback(async () => {
        try {
            const projects = await window.api.projects.list()
            setRecentProjects(projects)
        } catch (err) {
            console.error('[ProjectPicker] Failed to load recent projects:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadRecent()
    }, [loadRecent])

    // Focus input when editing starts
    useEffect(() => {
        if (editingPath && editInputRef.current) {
            editInputRef.current.focus()
            editInputRef.current.select()
        }
    }, [editingPath])

    const handleNewProject = async () => {
        try {
            setError(null)
            const project = await window.api.projects.new()
            if (project) {
                onProjectOpen(project)
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to create project')
        }
    }

    const handleOpenProject = async () => {
        try {
            setError(null)
            const project = await window.api.projects.open()
            if (project) {
                onProjectOpen(project)
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to open project')
        }
    }

    const handleOpenRecent = async (project: Project) => {
        try {
            setError(null)
            const opened = await window.api.projects.openRecent(project.path)
            onProjectOpen(opened)
        } catch (err: any) {
            setError(err?.message || 'Failed to open project')
            // Refresh the list in case the project was removed
            loadRecent()
        }
    }

    const handleDeleteProject = async (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm(`Are you sure you want to permanently delete "${project.name}"? This will remove all papers, annotations, and PDFs in this project. This action cannot be undone.`)) {
            return
        }
        try {
            await window.api.projects.delete(project.path)
            loadRecent()
        } catch (err) {
            console.error('[ProjectPicker] Failed to delete project:', err)
        }
    }

    const handleStartRename = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingPath(project.path)
        setEditValue(project.name)
    }

    const handleSaveRename = async (projectPath: string, e?: React.MouseEvent | React.FormEvent) => {
        e?.stopPropagation()
        e?.preventDefault()

        const trimmed = editValue.trim()
        if (!trimmed) {
            setEditingPath(null)
            return
        }

        try {
            await window.api.projects.rename(projectPath, trimmed)
            setEditingPath(null)
            loadRecent()
        } catch (err: any) {
            setError(err?.message || 'Failed to rename project')
        }
    }

    const handleCancelRename = (e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingPath(null)
    }

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffMins = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMs / 3600000)
            const diffDays = Math.floor(diffMs / 86400000)

            if (diffMins < 1) return 'Just now'
            if (diffMins < 60) return `${diffMins}m ago`
            if (diffHours < 24) return `${diffHours}h ago`
            if (diffDays < 7) return `${diffDays}d ago`
            return date.toLocaleDateString()
        } catch {
            return ''
        }
    }

    return (
        <div className="h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center select-none">
            {/* Logo & Title */}
            <div className="text-center mb-10">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/60 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[var(--color-accent)]/20">
                    <FileText size={40} className="text-white" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">ThreadMed</h1>
                <p className="text-[14px] text-[var(--color-text-tertiary)] mt-1.5">Literature Synthesis Tool</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-8">
                <button
                    onClick={handleNewProject}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-[14px] hover:opacity-90 transition-all shadow-md shadow-[var(--color-accent)]/25 hover:shadow-lg hover:shadow-[var(--color-accent)]/30 active:scale-[0.98]"
                >
                    <Plus size={18} strokeWidth={2.5} />
                    New Project
                </button>
                <button
                    onClick={handleOpenProject}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-[14px] hover:bg-[var(--color-bg-hover)] transition-all shadow-sm active:scale-[0.98]"
                >
                    <FolderOpen size={18} />
                    Open Project
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] max-w-md text-center">
                    {error}
                </div>
            )}

            {/* Recent Projects */}
            {!loading && recentProjects.length > 0 && (
                <div className="w-full max-w-lg">
                    <p className="text-[12px] uppercase tracking-wider font-semibold text-[var(--color-text-tertiary)] mb-3 px-1 flex items-center gap-2">
                        <Clock size={12} />
                        Recent Projects
                    </p>
                    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
                        {recentProjects.map((project, i) => {
                            const isEditing = editingPath === project.path

                            return (
                                <div
                                    key={project.path}
                                    onClick={() => !isEditing && handleOpenRecent(project)}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors group ${isEditing ? 'bg-[var(--color-bg-hover)]' : 'cursor-pointer hover:bg-[var(--color-bg-hover)]'
                                        } ${i > 0 ? 'border-t border-[var(--color-border-subtle)]' : ''}`}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-[var(--color-bg-active)] flex items-center justify-center shrink-0">
                                        <FileText size={16} className="text-[var(--color-accent)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <form
                                                onSubmit={(e) => handleSaveRename(project.path, e)}
                                                className="flex items-center gap-2"
                                            >
                                                <input
                                                    ref={editInputRef}
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            setEditingPath(null)
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex-1 bg-[var(--color-bg-active)] border border-[var(--color-accent)] rounded px-2 py-0.5 text-[14px] font-medium text-[var(--color-text-primary)] outline-none"
                                                />
                                                <button
                                                    type="submit"
                                                    className="p-1 rounded hover:bg-[var(--color-accent-subtle)] text-[var(--color-accent)] transition-colors"
                                                    title="Save"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelRename}
                                                    className="p-1 rounded hover:bg-neutral-500/20 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </form>
                                        ) : (
                                            <>
                                                <p className="text-[14px] font-medium text-[var(--color-text-primary)] truncate">
                                                    {project.name}
                                                </p>
                                                <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                                                    {project.path}
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    {!isEditing && (
                                        <>
                                            <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0 mr-2">
                                                {formatDate(project.lastOpenedAt)}
                                            </span>
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleStartRename(project, e)}
                                                    className="p-1.5 rounded-md hover:bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-all shrink-0"
                                                    title="Rename project"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteProject(project, e)}
                                                    className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--color-text-tertiary)] hover:text-red-400 transition-all shrink-0 ml-1"
                                                    title="Delete project"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <ChevronRight size={14} className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-50 shrink-0 transition-opacity ml-2" />
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && recentProjects.length === 0 && (
                <p className="text-[13px] text-[var(--color-text-tertiary)] text-center max-w-sm">
                    Create a new project to get started, or open an existing <code className="px-1 py-0.5 rounded bg-[var(--color-bg-active)] text-[12px]">.tdmd</code> project file.
                </p>
            )}

            {/* Version */}
            <p className="absolute bottom-4 text-[11px] text-[var(--color-text-tertiary)] opacity-50">
                ThreadMed v0.1.0
            </p>
        </div>
    )
}
