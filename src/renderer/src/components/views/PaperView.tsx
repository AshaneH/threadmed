// ============================================================================
// ThreadMed — Paper View (PDF Viewer + Annotation Sidebar)
// ============================================================================
// Split-pane layout: PDF via Chromium's built-in viewer on the left,
// annotation management sidebar on the right.
// Uses Electron's custom protocol (threadmed-pdf://) to serve local PDFs.
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { FileX } from 'lucide-react'
import { AnnotationSidebar } from './AnnotationSidebar'
import { triggerDataRefresh } from '@/lib/events'
import type { Annotation, Node, PaperWithAuthors } from '@/types'

interface PaperViewProps {
    paperId: string
    onBack: () => void
}

export function PaperView({ paperId, onBack }: PaperViewProps) {
    const [paper, setPaper] = useState<PaperWithAuthors | null>(null)
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [nodes, setNodes] = useState<Node[]>([])
    const [loading, setLoading] = useState(true)
    const [pdfError, setPdfError] = useState<string | null>(null)

    // Load paper data, annotations, and nodes
    useEffect(() => {
        loadData()
    }, [paperId])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            setPdfError(null)

            const [paperData, nodeList] = await Promise.all([
                window.api.papers.get(paperId),
                window.api.nodes.list()
            ])

            setPaper(paperData)
            setNodes(nodeList)

            // Load annotations
            const annList = await window.api.annotations.forPaper(paperId)
            setAnnotations(annList)

            // Check if paper has a PDF
            if (!paperData?.pdf_filename) {
                setPdfError('No PDF associated with this paper.')
            }
        } catch (err: any) {
            console.error('[PaperView] Failed to load:', err)
            setPdfError(err?.message || 'Failed to load paper data.')
        } finally {
            setLoading(false)
        }
    }, [paperId])

    const handleCreateAnnotation = async (content: string, pageNumber: number, _rectsJson: string, nodeId: string) => {
        try {
            const node = nodes.find(n => n.id === nodeId)
            await window.api.annotations.create({
                paper_id: paperId,
                node_id: nodeId,
                content,
                page_number: pageNumber,
                rects_json: undefined,
                color: node?.color
            })
            const updated = await window.api.annotations.forPaper(paperId)
            setAnnotations(updated)
            triggerDataRefresh()
        } catch (err) {
            console.error('[PaperView] Failed to create annotation:', err)
        }
    }

    const handleDeleteAnnotation = async (id: string) => {
        try {
            await window.api.annotations.delete(id)
            setAnnotations(prev => prev.filter(a => a.id !== id))
            triggerDataRefresh()
        } catch (err) {
            console.error('[PaperView] Failed to delete annotation:', err)
        }
    }

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-[var(--color-text-tertiary)] text-sm">Loading paper...</div>
            </div>
        )
    }

    // PDF URL via custom Electron protocol
    const pdfUrl = paper?.pdf_filename ? `threadmed-pdf://${paperId}#toolbar=0&navpanes=0` : null

    return (
        <div className="flex h-full">
            {/* ── Left Pane: PDF Viewer ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {pdfError || !pdfUrl ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-active)] flex items-center justify-center mb-4">
                            <FileX size={28} className="text-[var(--color-text-tertiary)] opacity-50" />
                        </div>
                        <p className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-1">
                            {pdfError || 'No PDF available'}
                        </p>
                        <p className="text-[13px] text-[var(--color-text-tertiary)]">
                            You can still view the paper metadata and annotations in the sidebar.
                        </p>
                    </div>
                ) : (
                    <iframe
                        src={pdfUrl}
                        className="flex-1 w-full border-none bg-[var(--color-bg-secondary)]"
                        title={`PDF: ${paper?.title || 'Document'}`}
                    />
                )}
            </div>

            {/* ── Right Pane: Annotation Sidebar ──────────────────────────── */}
            <div className="w-[320px] shrink-0">
                <AnnotationSidebar
                    paper={paper}
                    annotations={annotations}
                    nodes={nodes}
                    onDeleteAnnotation={handleDeleteAnnotation}
                    onScrollToPage={() => { }}
                    onBack={onBack}
                />
            </div>
        </div>
    )
}
