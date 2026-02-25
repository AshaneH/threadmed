// ============================================================================
// ThreadMed — Highlight Layer (PDF Annotation Overlay)
// ============================================================================
// Renders colored rectangle overlays for existing annotations on a PDF page
// and handles text selection → annotation creation flow.
// ============================================================================

import { useState, useCallback } from 'react'
import type { Annotation, Node } from '@/types'
import { cn } from '@/lib/utils'

interface HighlightLayerProps {
    pageNumber: number
    annotations: Annotation[]
    nodes: Node[]
    scale: number
    onCreateAnnotation: (content: string, pageNumber: number, rectsJson: string, nodeId: string) => void
}

interface SelectionPopup {
    x: number
    y: number
    text: string
    rectsJson: string
}

export function HighlightLayer({ pageNumber, annotations, nodes, scale, onCreateAnnotation }: HighlightLayerProps) {
    const [popup, setPopup] = useState<SelectionPopup | null>(null)

    const pageAnnotations = annotations.filter(a => a.page_number === pageNumber)

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
            return
        }

        const selectedText = selection.toString().trim()
        if (!selectedText) return

        // Get bounding rects relative to the overlay container
        const range = selection.getRangeAt(0)
        const containerRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const clientRects = range.getClientRects()

        const rects: { x: number; y: number; width: number; height: number }[] = []
        for (let i = 0; i < clientRects.length; i++) {
            const r = clientRects[i]
            rects.push({
                x: (r.left - containerRect.left) / scale,
                y: (r.top - containerRect.top) / scale,
                width: r.width / scale,
                height: r.height / scale
            })
        }

        const rectsJson = JSON.stringify(rects)

        // Position popup near the end of selection
        const lastRect = clientRects[clientRects.length - 1]
        setPopup({
            x: lastRect.right - containerRect.left,
            y: lastRect.bottom - containerRect.top + 4,
            text: selectedText,
            rectsJson
        })
    }, [scale])

    const handleAssign = (nodeId: string) => {
        if (!popup) return
        onCreateAnnotation(popup.text, pageNumber, popup.rectsJson, nodeId)
        setPopup(null)
        window.getSelection()?.removeAllRanges()
    }

    const dismissPopup = () => {
        setPopup(null)
    }

    return (
        <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 3 }}
        >
            {/* Existing highlight overlays */}
            {pageAnnotations.map(ann => {
                if (!ann.rects_json) return null
                try {
                    const rects = JSON.parse(ann.rects_json) as { x: number; y: number; width: number; height: number }[]
                    const nodeColor = ann.color || nodes.find(n => n.id === ann.node_id)?.color || '#3B82F6'
                    return rects.map((rect, i) => (
                        <div
                            key={`${ann.id}-${i}`}
                            className="absolute rounded-sm"
                            style={{
                                left: rect.x * scale,
                                top: rect.y * scale,
                                width: rect.width * scale,
                                height: rect.height * scale,
                                backgroundColor: nodeColor,
                                opacity: 0.25,
                                pointerEvents: 'none'
                            }}
                        />
                    ))
                } catch {
                    return null
                }
            })}

            {/* Text selection capture layer */}
            <div
                className="absolute inset-0"
                style={{ zIndex: 4, pointerEvents: 'auto' }}
                onMouseUp={handleMouseUp}
                onClick={(e) => {
                    // If clicking outside popup, dismiss it
                    if (popup && !(e.target as HTMLElement).closest('[data-annotation-popup]')) {
                        dismissPopup()
                    }
                }}
            />

            {/* Node assignment popup */}
            {popup && (
                <div
                    data-annotation-popup
                    className="absolute rounded-xl shadow-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-2 space-y-1 animate-fade-in"
                    style={{
                        left: Math.min(popup.x, 280),
                        top: popup.y,
                        zIndex: 10,
                        pointerEvents: 'auto',
                        minWidth: 180
                    }}
                >
                    <p className="text-[11px] font-medium text-[var(--color-text-tertiary)] px-2 pt-1 pb-0.5 uppercase tracking-wider">
                        Assign to Node
                    </p>
                    {nodes.map(node => (
                        <button
                            key={node.id}
                            onClick={() => handleAssign(node.id)}
                            className={cn(
                                "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-[13px] font-medium",
                                "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-active)] transition-colors"
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
            )}
        </div>
    )
}
