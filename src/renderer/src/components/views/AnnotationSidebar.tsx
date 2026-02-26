// ============================================================================
// ThreadMed — Annotation Sidebar
// ============================================================================
// Right panel showing paper metadata and annotations grouped by PICO node.
// Supports click-to-scroll, flash highlight, and annotation re-select editing.
// ============================================================================

import { Trash2, FileText, ChevronLeft, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Annotation, Node, PaperWithAuthors } from '@/types'

interface AnnotationSidebarProps {
    paper: PaperWithAuthors | null
    annotations: Annotation[]
    nodes: Node[]
    editingAnnotationId: string | null
    onDeleteAnnotation: (id: string) => void
    onScrollToAnnotation: (ann: Annotation) => void
    onEditAnnotation: (ann: Annotation) => void
    onCancelEdit: () => void
    onBack: () => void
}

export function AnnotationSidebar({
    paper,
    annotations,
    nodes,
    editingAnnotationId,
    onDeleteAnnotation,
    onScrollToAnnotation,
    onEditAnnotation,
    onCancelEdit,
    onBack
}: AnnotationSidebarProps) {
    // Group annotations by node ID
    const grouped = new Map<string, Annotation[]>()
    for (const ann of annotations) {
        if (!grouped.has(ann.node_id)) grouped.set(ann.node_id, [])
        grouped.get(ann.node_id)!.push(ann)
    }

    return (
        <div className="h-full flex flex-col bg-[var(--color-bg-primary)] border-l border-[var(--color-border-subtle)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--color-border-subtle)] space-y-3">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors"
                >
                    <ChevronLeft size={16} />
                    Back to Library
                </button>

                {paper && (
                    <div className="space-y-1.5">
                        <h2 className="text-[15px] font-bold text-[var(--color-text-primary)] leading-snug line-clamp-3">
                            {paper.title}
                        </h2>
                        <p className="text-[12px] text-[var(--color-text-tertiary)] leading-relaxed">
                            {paper.authors?.length > 0 ? paper.authors.join(', ') : 'Unknown Author'}
                            {paper.year ? ` · ${paper.year}` : ''}
                            {paper.journal ? ` · ${paper.journal}` : ''}
                        </p>
                    </div>
                )}
            </div>

            {/* Edit mode banner */}
            {editingAnnotationId && (
                <div className="px-4 py-2.5 bg-[var(--color-accent)]/10 border-b border-[var(--color-accent)]/20 flex items-center gap-2">
                    <Pencil size={13} className="text-[var(--color-accent)] shrink-0" />
                    <span className="text-[12px] font-medium text-[var(--color-accent)] flex-1">
                        Select new text on the PDF to update this annotation
                    </span>
                    <button
                        onClick={onCancelEdit}
                        className="p-1 rounded hover:bg-[var(--color-accent)]/20 text-[var(--color-accent)] transition-colors"
                        title="Cancel editing"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Annotation List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {annotations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-60">
                        <FileText size={36} className="mb-3 opacity-30" />
                        <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">No annotations yet</p>
                        <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1 max-w-[200px]">
                            Select text in the PDF and assign it to a PICO node.
                        </p>
                    </div>
                ) : (
                    nodes
                        .filter(node => grouped.has(node.id))
                        .map(node => {
                            const nodeAnnotations = grouped.get(node.id) || []
                            return (
                                <div key={node.id} className="space-y-2">
                                    {/* Node Header */}
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: node.color }}
                                        />
                                        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                            {node.name}
                                        </span>
                                        <span className="text-[11px] text-[var(--color-text-tertiary)] ml-auto">
                                            {nodeAnnotations.length}
                                        </span>
                                    </div>

                                    {/* Annotation Cards */}
                                    {nodeAnnotations.map(ann => {
                                        const isEditing = editingAnnotationId === ann.id
                                        return (
                                            <div
                                                key={ann.id}
                                                className={cn(
                                                    "group relative p-3 rounded-lg border",
                                                    "bg-[var(--color-bg-elevated)] transition-all cursor-pointer",
                                                    isEditing
                                                        ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30 shadow-md"
                                                        : "border-[var(--color-border-subtle)] hover:border-[var(--color-border)]"
                                                )}
                                                style={{ borderLeftColor: node.color, borderLeftWidth: 3 }}
                                                onClick={() => onScrollToAnnotation(ann)}
                                            >
                                                <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed line-clamp-4">
                                                    "{ann.content}"
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                                                        Page {ann.page_number}
                                                    </span>
                                                    {ann.tag_name && (
                                                        <span
                                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                                            style={{
                                                                backgroundColor: `${node.color}18`,
                                                                color: node.color,
                                                                border: `1px solid ${node.color}30`
                                                            }}
                                                        >
                                                            {ann.tag_name}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Action buttons */}
                                                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onEditAnnotation(ann)
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                                                        title="Re-select text for this annotation"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onDeleteAnnotation(ann.id)
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                        title="Delete annotation"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-3 border-t border-[var(--color-border-subtle)] text-center">
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                    {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} across {grouped.size} node{grouped.size !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    )
}
