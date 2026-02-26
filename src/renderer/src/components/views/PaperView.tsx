// ============================================================================
// ThreadMed — Paper View (PDF Viewer + Annotation Sidebar)
// ============================================================================
// Split-pane layout: custom pdf.js canvas renderer on the left with CSS Grid
// auto-fill for multi-page layouts, annotation sidebar on the right.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import { ZoomIn, ZoomOut, Grid2x2, Rows3, FileX, Search, X, ChevronUp, ChevronDown, FileUp, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PdfPage } from './PdfPage'
import { HighlightLayer } from './HighlightLayer'
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
    const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // Find in Page state
    const [showFind, setShowFind] = useState(false)
    const [findText, setFindText] = useState('')
    const [findResults, setFindResults] = useState<{ activeMatchOrdinal: number; matches: number } | null>(null)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const findInputRef = useRef<HTMLInputElement>(null)

    // Load paper data, PDF document, annotations, and nodes
    useEffect(() => {
        loadData()
        return () => {
            // Cleanup: destroy PDF document on unmount
            pdfDoc?.destroy()
        }
    }, [paperId])

    const loadData = useCallback(async () => {
        // Clear previous search state when a new paper loads
        currentQueryRef.current = ''
        findRangesRef.current = []
        activeMatchIndexRef.current = 0
        setFindResults(null)

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

    // ── Find-in-Page tracking ────────────────────────────────────────────────
    const findRangesRef = useRef<Range[]>([])
    const activeMatchIndexRef = useRef(0)
    const currentQueryRef = useRef('')

    const updateHighlights = useCallback((activeIndex: number) => {
        const ranges = findRangesRef.current
        if (ranges.length === 0) return

        // Wrap around
        if (activeIndex < 0) activeIndex = ranges.length - 1
        if (activeIndex >= ranges.length) activeIndex = 0

        activeMatchIndexRef.current = activeIndex

        try {
            const CSSHighlights = (window as any).CSS.highlights
            const HighlightAPI = (window as any).Highlight
            if (CSSHighlights && HighlightAPI) {
                const allHighlight = new HighlightAPI(...ranges)
                const activeHighlight = new HighlightAPI(ranges[activeIndex])
                CSSHighlights.set('threadmed-find', allHighlight)
                CSSHighlights.set('threadmed-find-active', activeHighlight)
            }
        } catch (e) {
            // Ignore if unsupported
        }

        setFindResults({ activeMatchOrdinal: activeIndex + 1, matches: ranges.length })

        // Scroll the active match into view smoothly
        const range = ranges[activeIndex]
        const element = range.startContainer.parentElement
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [])

    const executeFind = useCallback((query: string) => {
        currentQueryRef.current = query
        const CSSHighlights = (window as any).CSS?.highlights
        if (!query) {
            if (CSSHighlights) {
                CSSHighlights.delete('threadmed-find')
                CSSHighlights.delete('threadmed-find-active')
            }
            findRangesRef.current = []
            setFindResults(null)
            return
        }

        const ranges: Range[] = []
        const textLayers = scrollContainerRef.current?.querySelectorAll('.textLayer')
        if (!textLayers) return

        const lowerQuery = query.toLowerCase()

        textLayers.forEach(layer => {
            const treeWalker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT
                    return NodeFilter.FILTER_ACCEPT
                }
            })

            let currentNode = treeWalker.nextNode()
            while (currentNode) {
                const text = currentNode.textContent?.toLowerCase() || ''
                let startIndex = 0
                let index = text.indexOf(lowerQuery, startIndex)

                while (index !== -1) {
                    const range = new Range()
                    try {
                        range.setStart(currentNode, index)
                        range.setEnd(currentNode, index + query.length)
                        ranges.push(range)
                    } catch (e) {
                        // ignore range errors
                    }
                    startIndex = index + query.length
                    index = text.indexOf(lowerQuery, startIndex)
                }
                currentNode = treeWalker.nextNode()
            }
        })

        findRangesRef.current = ranges

        if (ranges.length > 0) {
            updateHighlights(0)
        } else {
            if (CSSHighlights) {
                CSSHighlights.delete('threadmed-find')
                CSSHighlights.delete('threadmed-find-active')
            }
            setFindResults({ activeMatchOrdinal: 0, matches: 0 })
        }
    }, [updateHighlights])

    // ── Keyboard & Scroll Events ─────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault()
                setShowFind(true)
                setTimeout(() => findInputRef.current?.focus(), 10)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showFind) {
                handleCloseFind()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [showFind])

    // Use refs for latest zoom functions to bypass stale closures in wheel events
    const zoomIn = useCallback(() => setScale(s => Math.min(s + 0.15, 3.0)), [])
    const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.15, 0.3)), [])

    const zoomInRef = useRef(zoomIn)
    const zoomOutRef = useRef(zoomOut)
    useEffect(() => { zoomInRef.current = zoomIn }, [zoomIn])
    useEffect(() => { zoomOutRef.current = zoomOut }, [zoomOut])

    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (e.ctrlKey) {
            e.preventDefault()
            e.stopPropagation()
            // Using requestAnimationFrame to debounce visually, but directly calling state
            // since React 18 batches state updates.
            if (e.deltaY < 0) {
                zoomInRef.current()
            } else {
                zoomOutRef.current()
            }
        }
    }, [])

    const handleFind = (text: string, forward = true, isNext = false) => {
        if (!text) {
            executeFind('')
            return
        }

        // Search again if query changed OR if there are no existing ranges 
        // (which happens if the paper just changed, or if text layers just finished loading)
        if (text !== currentQueryRef.current || findRangesRef.current.length === 0) {
            executeFind(text)
        } else if (isNext && findRangesRef.current.length > 0) {
            updateHighlights(activeMatchIndexRef.current + (forward ? 1 : -1))
        }
    }

    const handleCloseFind = () => {
        setShowFind(false)
        setFindText('')
        executeFind('')
    }

    const handleCreateAnnotation = async (content: string, pageNumber: number, rectsJson: string, nodeId: string, tagId?: string) => {
        try {
            const node = nodes.find(n => n.id === nodeId)
            await window.api.annotations.create({
                paper_id: paperId,
                node_id: nodeId,
                content,
                page_number: pageNumber,
                rects_json: rectsJson,
                color: node?.color,
                tag_id: tagId
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
            if (editingAnnotationId === id) setEditingAnnotationId(null)
            triggerDataRefresh()
        } catch (err) {
            console.error('[PaperView] Failed to delete annotation:', err)
        }
    }

    // Scroll to the page containing an annotation and flash the highlight
    const handleScrollToAnnotation = useCallback((ann: Annotation) => {
        const pageEl = scrollContainerRef.current?.querySelector(`[data-page="${ann.page_number}"]`)
        if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Dispatch flash event so HighlightLayer can animate the highlight
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('threadmed:flashAnnotation', {
                    detail: { annotationId: ann.id }
                }))
            }, 400)
        }
    }, [])

    // Enter edit mode: next text selection updates this annotation
    const handleEditAnnotation = useCallback((ann: Annotation) => {
        setEditingAnnotationId(ann.id)
        // Scroll to the annotation's page
        handleScrollToAnnotation(ann)
    }, [handleScrollToAnnotation])

    // Update annotation content when re-selected in edit mode
    const handleUpdateAnnotation = useCallback(async (content: string, pageNumber: number, rectsJson: string) => {
        if (!editingAnnotationId) return
        try {
            await window.api.annotations.updateContent(editingAnnotationId, content, rectsJson, pageNumber)
            const updated = await window.api.annotations.forPaper(paperId)
            setAnnotations(updated)
            setEditingAnnotationId(null)
            triggerDataRefresh()
        } catch (err) {
            console.error('[PaperView] Failed to update annotation:', err)
        }
    }, [editingAnnotationId, paperId])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setIsDragging(true)
        }
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement
        const related = e.relatedTarget as HTMLElement
        if (!related || !target.contains(related)) {
            setIsDragging(false)
        }
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
        if (pdfFile) {
            const filePath = window.api.system.getFilePath(pdfFile)
            if (filePath) {
                try {
                    setLoading(true)
                    await window.api.papers.addPdf(paperId, filePath)
                    await loadData()
                    triggerDataRefresh()
                } catch (err) {
                    console.error('Failed to attach dropped PDF:', err)
                    alert('Failed to attach PDF.')
                    setLoading(false)
                }
            } else {
                alert("Could not retrieve the file path for the dragged file. Please use the Upload button instead.")
            }
        }
    }, [paperId, loadData])

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

                    {/* Find in page floating bar */}
                    {showFind && (
                        <div className="flex items-center gap-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-2 py-1 shadow-xl animate-fade-in ml-auto">
                            <Search size={14} className="text-[var(--color-text-tertiary)] ml-1" />
                            <input
                                ref={findInputRef}
                                type="text"
                                value={findText}
                                onChange={(e) => {
                                    setFindText(e.target.value)
                                    handleFind(e.target.value, true, false)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleFind(findText, !e.shiftKey, true)
                                    }
                                }}
                                placeholder="Find in document..."
                                className="bg-transparent border-none outline-none text-[13px] text-[var(--color-text-primary)] w-36 placeholder:text-[var(--color-text-tertiary)]"
                            />
                            {findResults && findResults.matches > 0 && (
                                <span className="text-[11px] text-[var(--color-text-tertiary)] tabular-nums ml-1">
                                    {findResults.activeMatchOrdinal}/{findResults.matches}
                                </span>
                            )}
                            {findText && (!findResults || findResults.matches === 0) && (
                                <span className="text-[11px] text-[var(--color-error)] ml-1">
                                    0/0
                                </span>
                            )}
                            <div className="flex items-center gap-0.5 border-l border-[var(--color-border-subtle)] pl-1 ml-1">
                                <button
                                    onClick={() => handleFind(findText, false, true)}
                                    className="p-1 hover:bg-[var(--color-bg-hover)] rounded text-[var(--color-text-tertiary)]"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    onClick={() => handleFind(findText, true, true)}
                                    className="p-1 hover:bg-[var(--color-bg-hover)] rounded text-[var(--color-text-tertiary)]"
                                >
                                    <ChevronDown size={14} />
                                </button>
                                <button
                                    onClick={handleCloseFind}
                                    className="p-1 hover:bg-[var(--color-bg-hover)] rounded text-[var(--color-text-tertiary)] ml-1"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* PDF Pages */}
                {pdfError ? (
                    <div
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center text-center px-8 transition-all border-2 m-4 rounded-2xl border-dashed",
                            isDragging
                                ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                            isDragging ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]" : "bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)] opacity-50"
                        )}>
                            {isDragging ? <FileText size={32} /> : <FileX size={28} />}
                        </div>
                        <p className={cn(
                            "text-[16px] font-semibold mb-2 transition-colors",
                            isDragging ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"
                        )}>
                            {isDragging ? "Drop PDF anywhere to attach" : (pdfError || "No PDF attached")}
                        </p>
                        <p className="text-[13px] text-[var(--color-text-tertiary)] max-w-sm mx-auto mb-6">
                            You can view the paper metadata in the sidebar. To start annotating, upload a PDF document or drag and drop one anywhere on this screen.
                        </p>

                        <button
                            onClick={async () => {
                                try {
                                    const filePaths = await window.api.system.showOpenDialog({
                                        properties: ['openFile'],
                                        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
                                    })
                                    if (filePaths && filePaths.length > 0) {
                                        setLoading(true)
                                        await window.api.papers.addPdf(paperId, filePaths[0])
                                        await loadData()
                                        triggerDataRefresh()
                                    }
                                } catch (err) {
                                    console.error('Failed to attach PDF:', err)
                                    setLoading(false)
                                }
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-text-tertiary)] transition-all shadow-sm"
                        >
                            <FileUp size={16} />
                            Upload PDF
                        </button>
                    </div>
                ) : (
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto bg-[var(--color-bg-secondary)] p-4"
                        onWheel={handleWheel}
                        style={{ textAlign: 'center' }}
                    >
                        <div
                            className="pdf-grid"
                            style={
                                layoutMode === 'auto'
                                    ? {
                                        display: 'inline-grid',
                                        gridTemplateColumns: `repeat(auto-fill, ${pageWidth + 16}px)`,
                                        gap: '16px',
                                        justifyContent: 'center',
                                        minWidth: '100%',
                                        textAlign: 'left'
                                    }
                                    : {
                                        display: 'inline-flex',
                                        flexDirection: 'column' as const,
                                        alignItems: 'center',
                                        gap: '16px',
                                        minWidth: '100%',
                                        textAlign: 'left'
                                    }
                            }
                        >
                            {pages.map((page, i) => (
                                <PdfPage
                                    key={i + 1}
                                    page={page}
                                    scale={scale}
                                    pageNumber={i + 1}
                                >
                                    <HighlightLayer
                                        pageNumber={i + 1}
                                        annotations={annotations}
                                        nodes={nodes}
                                        scale={scale}
                                        editingAnnotationId={editingAnnotationId}
                                        onCreateAnnotation={handleCreateAnnotation}
                                        onUpdateAnnotation={handleUpdateAnnotation}
                                    />
                                </PdfPage>
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
                    editingAnnotationId={editingAnnotationId}
                    onDeleteAnnotation={handleDeleteAnnotation}
                    onScrollToAnnotation={handleScrollToAnnotation}
                    onEditAnnotation={handleEditAnnotation}
                    onCancelEdit={() => setEditingAnnotationId(null)}
                    onBack={onBack}
                />
            </div>
        </div>
    )
}
