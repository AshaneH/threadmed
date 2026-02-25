// ============================================================================
// ThreadMed — Paper View (PDF Viewer + Annotation Sidebar)
// ============================================================================
// Split-pane layout: PDF pages on the left, annotation management on the right.
// Uses react-pdf (pdf.js) for rendering and supports text selection for creating
// annotations linked to PICO/thematic nodes.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ZoomIn, ZoomOut, ChevronUp, ChevronDown, FileX } from 'lucide-react'
import { AnnotationSidebar } from './AnnotationSidebar'
import { HighlightLayer } from './HighlightLayer'
import { triggerDataRefresh } from '@/lib/events'
import type { Annotation, Node, PaperWithAuthors } from '@/types'

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString()

interface PaperViewProps {
    paperId: string
    onBack: () => void
}

export function PaperView({ paperId, onBack }: PaperViewProps) {
    const [paper, setPaper] = useState<PaperWithAuthors | null>(null)
    const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [scale, setScale] = useState(1.2)
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [nodes, setNodes] = useState<Node[]>([])
    const [loading, setLoading] = useState(true)
    const [pdfError, setPdfError] = useState<string | null>(null)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

    // Load paper data, PDF, annotations, and nodes
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

            // Load PDF binary
            if (paperData?.pdf_filename) {
                const buffer = await window.api.papers.readPdf(paperId)
                if (buffer) {
                    // Convert Buffer to ArrayBuffer for react-pdf
                    const ab = new Uint8Array(buffer).buffer
                    setPdfData(ab)
                } else {
                    setPdfError('PDF file not found on disk.')
                }
            } else {
                setPdfError('No PDF associated with this paper.')
            }
        } catch (err) {
            console.error('[PaperView] Failed to load:', err)
            setPdfError('Failed to load PDF.')
        } finally {
            setLoading(false)
        }
    }, [paperId])

    const handleDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
        setNumPages(n)
    }

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
            // Refresh annotations
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

    const scrollToPage = (page: number) => {
        const el = pageRefs.current.get(page)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setCurrentPage(page)
        }
    }

    const handleScroll = () => {
        if (!scrollContainerRef.current) return
        const container = scrollContainerRef.current
        const scrollTop = container.scrollTop
        const containerHeight = container.clientHeight

        // Find which page is most visible
        let closestPage = 1
        let closestOffset = Infinity
        pageRefs.current.forEach((el, page) => {
            const rect = el.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            const offset = Math.abs(rect.top - containerRect.top)
            if (offset < closestOffset) {
                closestOffset = offset
                closestPage = page
            }
        })
        setCurrentPage(closestPage)
    }

    const zoomIn = () => setScale(s => Math.min(s + 0.2, 3.0))
    const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.5))

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-[var(--color-text-tertiary)] text-sm">Loading paper...</div>
            </div>
        )
    }

    return (
        <div className="flex h-full">
            {/* ── Left Pane: PDF Viewer ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] shrink-0">
                    <div className="flex items-center gap-1 bg-[var(--color-bg-active)] rounded-lg p-0.5">
                        <button
                            onClick={zoomOut}
                            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                            title="Zoom out"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-[12px] font-medium text-[var(--color-text-secondary)] w-12 text-center tabular-nums">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={zoomIn}
                            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                            title="Zoom in"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    <div className="h-5 w-px bg-[var(--color-border-subtle)]" />

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-active)] transition-colors"
                            disabled={currentPage <= 1}
                        >
                            <ChevronUp size={16} />
                        </button>
                        <span className="text-[12px] font-medium text-[var(--color-text-secondary)] tabular-nums">
                            {currentPage} / {numPages}
                        </span>
                        <button
                            onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-active)] transition-colors"
                            disabled={currentPage >= numPages}
                        >
                            <ChevronDown size={16} />
                        </button>
                    </div>
                </div>

                {/* PDF Pages */}
                {pdfError ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-active)] flex items-center justify-center mb-4">
                            <FileX size={28} className="text-[var(--color-text-tertiary)] opacity-50" />
                        </div>
                        <p className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-1">{pdfError}</p>
                        <p className="text-[13px] text-[var(--color-text-tertiary)]">
                            You can still view the paper metadata and annotations in the sidebar.
                        </p>
                    </div>
                ) : pdfData ? (
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto bg-[var(--color-bg-secondary)]"
                        onScroll={handleScroll}
                    >
                        <Document
                            file={{ data: pdfData }}
                            onLoadSuccess={handleDocumentLoadSuccess}
                            loading={
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-pulse text-sm text-[var(--color-text-tertiary)]">
                                        Rendering PDF...
                                    </div>
                                </div>
                            }
                        >
                            {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                                <div
                                    key={pageNum}
                                    ref={el => { if (el) pageRefs.current.set(pageNum, el) }}
                                    className="flex justify-center py-3 relative"
                                >
                                    <div className="relative shadow-lg">
                                        <Page
                                            pageNumber={pageNum}
                                            scale={scale}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                        />
                                        <HighlightLayer
                                            pageNumber={pageNum}
                                            annotations={annotations}
                                            nodes={nodes}
                                            scale={scale}
                                            onCreateAnnotation={handleCreateAnnotation}
                                        />
                                    </div>
                                </div>
                            ))}
                        </Document>
                    </div>
                ) : null}
            </div>

            {/* ── Right Pane: Annotation Sidebar ──────────────────────────── */}
            <div className="w-[320px] shrink-0">
                <AnnotationSidebar
                    paper={paper}
                    annotations={annotations}
                    nodes={nodes}
                    onDeleteAnnotation={handleDeleteAnnotation}
                    onScrollToPage={scrollToPage}
                    onBack={onBack}
                />
            </div>
        </div>
    )
}
