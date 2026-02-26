// ============================================================================
// ThreadMed — Highlight Layer (PDF Annotation Overlay)
// ============================================================================
// Renders colored rectangle overlays for existing annotations on a PDF page
// and handles text selection → annotation creation flow.
//
// Two-step popup workflow:
// 1. Select text → popup with PICO node buttons
// 2. Click a node → popup morphs into tag typeahead with suggestions
// 3. Enter tag name (or skip) → annotation created
//
// The popup is rendered via createPortal to document.body so it escapes
// the stacking context of the PDF page and sits above the textLayer.
// ============================================================================

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Annotation, Node, Tag } from '@/types'
import { cn } from '@/lib/utils'

interface HighlightLayerProps {
    pageNumber: number
    annotations: Annotation[]
    nodes: Node[]
    scale: number
    editingAnnotationId?: string | null
    onCreateAnnotation: (content: string, pageNumber: number, rectsJson: string, nodeId: string, tagId?: string) => void
    onUpdateAnnotation?: (content: string, pageNumber: number, rectsJson: string) => void
}

interface SelectionPopup {
    // Viewport-absolute coordinates (for position: fixed portal)
    x: number
    y: number
    text: string
    rectsJson: string
}

type PopupStep = 'node' | 'tag'

export function HighlightLayer({ pageNumber, annotations, nodes, scale, editingAnnotationId, onCreateAnnotation, onUpdateAnnotation }: HighlightLayerProps) {
    const [popup, setPopup] = useState<SelectionPopup | null>(null)
    const [popupStep, setPopupStep] = useState<PopupStep>('node')
    const [selectedNode, setSelectedNode] = useState<Node | null>(null)
    const [tagInput, setTagInput] = useState('')
    const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([])
    const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1)
    const [flashingAnnotationId, setFlashingAnnotationId] = useState<string | null>(null)
    const tagInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const pageAnnotations = annotations.filter(a => a.page_number === pageNumber)

    // Load tag suggestions when a node is selected
    useEffect(() => {
        if (!selectedNode) {
            setTagSuggestions([])
            return
        }
        window.api.tags.forNode(selectedNode.id).then(tags => {
            setTagSuggestions(tags)
        })
    }, [selectedNode])

    // Focus tag input when step changes to 'tag'
    useEffect(() => {
        if (popupStep === 'tag') {
            setTimeout(() => tagInputRef.current?.focus(), 50)
        }
    }, [popupStep])

    // ── Text selection detection ──────────────────────────────────────────────
    // Only page 1's HighlightLayer registers the document mouseup listener
    // to avoid N duplicate listeners (one per page). The handler checks which
    // page the selection belongs to and only that page's HighlightLayer shows
    // the popup. We use a custom event to communicate from the single listener.
    useEffect(() => {
        // Only register ONE document listener (from page 1's instance)
        if (pageNumber !== 1) return

        const handleMouseUp = () => {
            setTimeout(() => {
                const selection = window.getSelection()
                if (!selection || selection.isCollapsed) return

                const selectedText = selection.toString().trim()
                if (!selectedText) return

                const anchorNode = selection.anchorNode
                if (!anchorNode) return
                const el = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement
                const pageWrapper = el?.closest('[data-page]')
                if (!pageWrapper) return
                const detectedPage = parseInt(pageWrapper.getAttribute('data-page') || '0', 10)

                const range = selection.getRangeAt(0)
                const clientRects = range.getClientRects()
                if (clientRects.length === 0) return

                // Fire a custom event so the correct page's HighlightLayer handles it
                const lastRect = clientRects[clientRects.length - 1]

                // Calculate rects relative to the page wrapper
                const wrapperRect = pageWrapper.getBoundingClientRect()
                const rects: { x: number; y: number; width: number; height: number }[] = []
                for (let i = 0; i < clientRects.length; i++) {
                    const r = clientRects[i]
                    rects.push({
                        x: (r.left - wrapperRect.left) / scale,
                        y: (r.top - wrapperRect.top) / scale,
                        width: r.width / scale,
                        height: r.height / scale
                    })
                }

                window.dispatchEvent(new CustomEvent('threadmed:textselected', {
                    detail: {
                        pageNumber: detectedPage,
                        text: selectedText,
                        rectsJson: JSON.stringify(rects),
                        // Viewport-absolute coords for fixed-position popup
                        popupX: lastRect.right,
                        popupY: lastRect.bottom + 4
                    }
                }))
            }, 10)
        }

        document.addEventListener('mouseup', handleMouseUp)
        return () => document.removeEventListener('mouseup', handleMouseUp)
    }, [pageNumber, scale])

    // Listen for the custom selection event — only handle if it's for our page
    useEffect(() => {
        const handleSelection = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail.pageNumber !== pageNumber) return

            // If in edit mode, update the annotation directly (no popup)
            if (editingAnnotationId && onUpdateAnnotation) {
                onUpdateAnnotation(detail.text, detail.pageNumber, detail.rectsJson)
                window.getSelection()?.removeAllRanges()
                return
            }

            setPopup({
                x: detail.popupX,
                y: detail.popupY,
                text: detail.text,
                rectsJson: detail.rectsJson
            })
            setPopupStep('node')
            setSelectedNode(null)
            setTagInput('')
            setHighlightedSuggestion(-1)
        }

        window.addEventListener('threadmed:textselected', handleSelection)
        return () => window.removeEventListener('threadmed:textselected', handleSelection)
    }, [pageNumber, editingAnnotationId, onUpdateAnnotation])

    // Flash animation: briefly pulse a highlight when scrolled to from sidebar
    useEffect(() => {
        const handleFlash = (e: Event) => {
            const { annotationId } = (e as CustomEvent).detail
            const hasAnnotation = pageAnnotations.some(a => a.id === annotationId)
            if (!hasAnnotation) return

            setFlashingAnnotationId(annotationId)
            setTimeout(() => setFlashingAnnotationId(null), 1200)
        }

        window.addEventListener('threadmed:flashAnnotation', handleFlash)
        return () => window.removeEventListener('threadmed:flashAnnotation', handleFlash)
    }, [pageAnnotations])

    // Dismiss popup when clicking outside
    useEffect(() => {
        if (!popup) return

        const handleDocClick = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-annotation-popup]')) {
                resetPopup()
            }
        }

        // Delay so the click that ends the selection doesn't immediately dismiss
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleDocClick)
        }, 150)

        return () => {
            clearTimeout(timer)
            document.removeEventListener('mousedown', handleDocClick)
        }
    }, [popup])

    const handleNodeClick = (node: Node) => {
        setSelectedNode(node)
        setPopupStep('tag')
        setTagInput('')
        setHighlightedSuggestion(-1)
    }

    const handleAssignWithTag = async (tagName?: string) => {
        if (!popup || !selectedNode) return

        let tagId: string | undefined
        if (tagName && tagName.trim()) {
            try {
                const tag = await window.api.tags.findOrCreate(selectedNode.id, tagName.trim())
                tagId = tag.id
            } catch (err) {
                console.error('[HighlightLayer] Failed to create tag:', err)
            }
        }

        onCreateAnnotation(popup.text, pageNumber, popup.rectsJson, selectedNode.id, tagId)
        resetPopup()
    }

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const filtered = getFilteredSuggestions()

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedSuggestion(prev => Math.min(prev + 1, filtered.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedSuggestion(prev => Math.max(prev - 1, -1))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (highlightedSuggestion >= 0 && highlightedSuggestion < filtered.length) {
                handleAssignWithTag(filtered[highlightedSuggestion].name)
            } else {
                handleAssignWithTag(tagInput)
            }
        } else if (e.key === 'Escape') {
            resetPopup()
        }
    }

    const getFilteredSuggestions = () => {
        if (!tagInput.trim()) return tagSuggestions.slice(0, 8)
        return tagSuggestions
            .filter(t => t.name.toLowerCase().includes(tagInput.toLowerCase()))
            .slice(0, 8)
    }

    const resetPopup = () => {
        setPopup(null)
        setPopupStep('node')
        setSelectedNode(null)
        setTagInput('')
        setHighlightedSuggestion(-1)
        window.getSelection()?.removeAllRanges()
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {/* Highlight rectangles — inside the page wrapper, below textLayer */}
            <div
                ref={containerRef}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 1 }}
            >
                {pageAnnotations.map(ann => {
                    if (!ann.rects_json) return null
                    try {
                        const rects = JSON.parse(ann.rects_json) as { x: number; y: number; width: number; height: number }[]
                        const nodeColor = ann.color || nodes.find(n => n.id === ann.node_id)?.color || '#3B82F6'
                        const isFlashing = flashingAnnotationId === ann.id
                        return rects.map((rect, i) => (
                            <div
                                key={`${ann.id}-${i}`}
                                className={cn(
                                    "absolute rounded-sm transition-opacity duration-300",
                                    isFlashing && "animate-pulse"
                                )}
                                style={{
                                    left: rect.x * scale,
                                    top: rect.y * scale,
                                    width: rect.width * scale,
                                    height: rect.height * scale,
                                    backgroundColor: nodeColor,
                                    opacity: isFlashing ? 0.5 : 0.25,
                                    pointerEvents: 'none',
                                    mixBlendMode: 'multiply'
                                }}
                            />
                        ))
                    } catch {
                        return null
                    }
                })}
            </div>

            {/* Popup rendered via portal to escape stacking context */}
            {popup && createPortal(
                <div
                    data-annotation-popup
                    className="fixed rounded-xl shadow-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] animate-fade-in"
                    style={{
                        left: popup.x,
                        top: popup.y,
                        zIndex: 9999,
                        minWidth: popupStep === 'tag' ? 220 : 180
                    }}
                    // Stop ALL events from propagating to doc handlers
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {popupStep === 'node' ? (
                        /* ── Step 1: Node Selection ── */
                        <div className="p-2 space-y-1">
                            <p className="text-[11px] font-medium text-[var(--color-text-tertiary)] px-2 pt-1 pb-0.5 uppercase tracking-wider">
                                Assign to Node
                            </p>
                            {nodes.map(node => (
                                <button
                                    key={node.id}
                                    onClick={() => handleNodeClick(node)}
                                    className={cn(
                                        "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-[13px] font-medium",
                                        "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-active)] transition-colors cursor-pointer"
                                    )}
                                >
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: node.color }}
                                    />
                                    {node.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        /* ── Step 2: Tag Typeahead ── */
                        <div className="p-2 space-y-2">
                            <div className="flex items-center gap-2 px-2 pt-1">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: selectedNode?.color }}
                                />
                                <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                                    {selectedNode?.name}
                                </span>
                                <button
                                    onClick={() => { setPopupStep('node'); setSelectedNode(null) }}
                                    className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] ml-auto cursor-pointer"
                                >
                                    Change
                                </button>
                            </div>

                            <div className="px-1">
                                <input
                                    ref={tagInputRef}
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => {
                                        setTagInput(e.target.value)
                                        setHighlightedSuggestion(-1)
                                    }}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder="Type a tag..."
                                    className="w-full bg-[var(--color-bg-active)] border border-[var(--color-border-subtle)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                                />
                            </div>

                            {getFilteredSuggestions().length > 0 && (
                                <div className="px-1 max-h-32 overflow-y-auto">
                                    {getFilteredSuggestions().map((tag, i) => (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleAssignWithTag(tag.name)}
                                            className={cn(
                                                "flex items-center gap-2 w-full px-2.5 py-1 rounded-md text-left text-[12px] cursor-pointer",
                                                "transition-colors",
                                                i === highlightedSuggestion
                                                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]"
                                            )}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedNode?.color, opacity: 0.6 }} />
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2 px-1 pb-1">
                                <button
                                    onClick={() => handleAssignWithTag(tagInput)}
                                    className="flex-1 text-[12px] font-medium text-center py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                    {tagInput.trim() ? `Add "${tagInput.trim()}"` : 'Save'}
                                </button>
                                <button
                                    onClick={() => handleAssignWithTag()}
                                    className="text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] px-2 py-1.5 transition-colors cursor-pointer"
                                >
                                    Skip
                                </button>
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    )
}
