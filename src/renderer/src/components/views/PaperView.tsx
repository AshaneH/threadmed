// ============================================================================
// ThreadMed — Paper View (PDF Viewer + Annotation Sidebar)
// ============================================================================
// Split-pane layout: custom pdf.js canvas renderer on the left with CSS Grid
// auto-fill for multi-page layouts, annotation sidebar on the right.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { ZoomIn, ZoomOut, Grid2x2, Rows3, FileX } from 'lucide-react'
import { PdfPage } from './PdfPage'
import { AnnotationSidebar } from './AnnotationSidebar'
import { triggerDataRefresh } from '@/lib/events'
import type { Annotation, Node, PaperWithAuthors } from '@/types'

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString()

interface PaperViewProps {
    paperId: string
    onBack: () => void
}

type LayoutMode = 'auto' | 'single'

export function PaperView({ paperId, onBack }: PaperViewProps) {
    const [paper, setPaper] = useState<PaperWithAuthors | null>(null)
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
    const [pages, setPages] = useState<PDFPageProxy[]>([])
    const [scale, setScale] = useState(1.0)
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('auto')
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [nodes, setNodes] = useState<Node[]>([])
    const [loading, setLoading] = useState(true)
    const [pdfError, setPdfError] = useState<string | null>(null)

    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Load paper data, PDF document, annotations, and nodes
    useEffect(() => {
        loadData()
        return () => {
            // Cleanup: destroy PDF document on unmount
            pdfDoc?.destroy()
        }
    }, [paperId])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            setPdfError(null)
            setPages([])

            const [paperData, nodeList] = await Promise.all([
                window.api.papers.get(paperId),
                window.api.nodes.list()
            ])

            setPaper(paperData)
            setNodes(nodeList)

            // Load annotations
            const annList = await window.api.annotations.forPaper(paperId)
            setAnnotations(annList)

            // Load PDF binary via base64 IPC
            if (paperData?.pdf_filename) {
                const base64 = await window.api.papers.readPdf(paperId)
                if (base64) {
                    const binary = atob(base64 as unknown as string)
                    const bytes = new Uint8Array(binary.length)
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i)
                    }

                    const doc = await pdfjsLib.getDocument({ data: bytes }).promise
                    setPdfDoc(doc)

                    // Load all pages
                    const pagePromises: Promise<PDFPageProxy>[] = []
                    for (let i = 1; i <= doc.numPages; i++) {
                        pagePromises.push(doc.getPage(i))
                    }
                    const allPages = await Promise.all(pagePromises)
                    setPages(allPages)
                } else {
                    setPdfError('PDF file not found on disk.')
                }
            } else {
                setPdfError('No PDF associated with this paper.')
            }
        } catch (err: any) {
            console.error('[PaperView] Failed to load:', err)
            setPdfError(err?.message || 'Failed to load PDF.')
        } finally {
            setLoading(false)
        }
    }, [paperId])

    const handleCreateAnnotation = async (content: string, pageNumber: number, rectsJson: string, nodeId: string) => {
        try {
            const node = nodes.find(n => n.id === nodeId)
            await window.api.annotations.create({
                paper_id: paperId,
                node_id: nodeId,
                content,
                page_number: pageNumber,
                rects_json: rectsJson,
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

    const zoomIn = () => setScale(s => Math.min(s + 0.15, 3.0))
    const zoomOut = () => setScale(s => Math.max(s - 0.15, 0.3))

    // Compute page width at current scale (used for grid column sizing)
    const pageWidth = pages.length > 0
        ? pages[0].getViewport({ scale }).width
        : 600

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[13px] text-[var(--color-text-tertiary)]">Loading paper...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full">
            {/* ── Left Pane: PDF Viewer ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] shrink-0">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-[var(--color-bg-active)] rounded-lg p-0.5">
                        <button
                            onClick={zoomOut}
                            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                            title="Zoom out"
                        >
                            <ZoomOut size={15} />
                        </button>
                        <span className="text-[12px] font-medium text-[var(--color-text-secondary)] w-12 text-center tabular-nums select-none">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={zoomIn}
                            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                            title="Zoom in"
                        >
                            <ZoomIn size={15} />
                        </button>
                    </div>

                    <div className="h-5 w-px bg-[var(--color-border-subtle)]" />

                    {/* Layout mode toggle */}
                    <div className="flex items-center gap-0.5 bg-[var(--color-bg-active)] rounded-lg p-0.5">
                        <button
                            onClick={() => setLayoutMode('auto')}
                            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${layoutMode === 'auto'
                                    ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] shadow-sm'
                                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                                }`}
                            title="Auto grid (multi-page)"
                        >
                            <Grid2x2 size={15} />
                        </button>
                        <button
                            onClick={() => setLayoutMode('single')}
                            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${layoutMode === 'single'
                                    ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] shadow-sm'
                                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                                }`}
                            title="Single column"
                        >
                            <Rows3 size={15} />
                        </button>
                    </div>

                    <div className="h-5 w-px bg-[var(--color-border-subtle)]" />

                    {/* Page count */}
                    <span className="text-[12px] text-[var(--color-text-tertiary)] tabular-nums">
                        {pages.length} page{pages.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* PDF Pages */}
                {pdfError ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-active)] flex items-center justify-center mb-4">
                            <FileX size={28} className="text-[var(--color-text-tertiary)] opacity-50" />
                        </div>
                        <p className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-1">{pdfError}</p>
                        <p className="text-[13px] text-[var(--color-text-tertiary)]">
                            You can still view the paper metadata in the sidebar.
                        </p>
                    </div>
                ) : (
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto bg-[var(--color-bg-secondary)] p-4"
                    >
                        <div
                            className="pdf-grid mx-auto"
                            style={
                                layoutMode === 'auto'
                                    ? {
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(auto-fill, ${pageWidth + 16}px)`,
                                        gap: '16px',
                                        justifyContent: 'center'
                                    }
                                    : {
                                        display: 'flex',
                                        flexDirection: 'column' as const,
                                        alignItems: 'center',
                                        gap: '16px'
                                    }
                            }
                        >
                            {pages.map((page, i) => (
                                <PdfPage
                                    key={i + 1}
                                    page={page}
                                    scale={scale}
                                    pageNumber={i + 1}
                                />
                            ))}
                        </div>
                    </div>
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
