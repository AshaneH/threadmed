// ============================================================================
// ThreadMed — PDF Page (Canvas Renderer)
// ============================================================================
// Renders a single PDF page to <canvas> with a text layer overlay.
// Uses IntersectionObserver for lazy rendering — only pages visible in the
// viewport (plus a margin) are actually rendered.
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'

interface PdfPageProps {
    page: PDFPageProxy
    scale: number
    pageNumber: number
    children?: React.ReactNode
}

export function PdfPage({ page, scale, pageNumber, children }: PdfPageProps) {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const textLayerRef = useRef<HTMLDivElement>(null)
    const textLayerInstance = useRef<TextLayer | null>(null)
    const renderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const renderedScaleRef = useRef<number | null>(null)

    // The single canonical viewport scaled by the user's requested zoom level
    const viewport = page.getViewport({ scale })

    // ── IntersectionObserver: track visibility ─────────────────────────────
    useEffect(() => {
        const el = wrapperRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    setIsVisible(entry.isIntersecting)
                }
            },
            { rootMargin: '200px 0px' }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // ── Canvas rendering ──────────────────────────────
    const renderPage = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        if (renderTaskRef.current) {
            renderTaskRef.current.cancel()
            renderTaskRef.current = null
        }

        const dpr = window.devicePixelRatio || 1

        // 1) Set the native backing store (high density pixels)
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)

        // 2) Set the CSS size exactly matching the standard viewport
        canvas.style.width = Math.floor(viewport.width) + 'px'
        canvas.style.height = Math.floor(viewport.height) + 'px'

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // 3) Let PDF.js handle the scale explicitly via context transform avoiding cropbox origin drifting
        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined

        const renderTask = page.render({
            canvas,
            canvasContext: ctx,
            transform,
            viewport: viewport
        })

        renderTaskRef.current = renderTask
        renderTask.promise
            .then(() => {
                renderedScaleRef.current = scale
            })
            .catch(() => { })
    }, [page, scale, viewport])

    // ── Text layer rendering ──────────────────────────────────────────────
    const renderTextLayer = useCallback(() => {
        const textDiv = textLayerRef.current
        if (!textDiv) return

        if (textLayerInstance.current) {
            textLayerInstance.current.cancel()
            textLayerInstance.current = null
        }
        textDiv.innerHTML = ''

        page.getTextContent().then(textContent => {
            const tl = new TextLayer({
                textContentSource: textContent,
                container: textDiv,
                viewport: viewport // Strictly use the canonical viewport matching the canvas layout
            })
            textLayerInstance.current = tl
            tl.render()
        })
    }, [page, viewport])

    useEffect(() => {
        if (!isVisible) return

        if (renderedScaleRef.current !== scale) {
            renderPage()
            renderTextLayer()
        }

        return () => {
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel()
                renderTaskRef.current = null
            }
            if (textLayerInstance.current) {
                textLayerInstance.current.cancel()
                textLayerInstance.current = null
            }
        }
    }, [isVisible, scale, renderPage, renderTextLayer])

    return (
        <div
            ref={wrapperRef}
            className="pdf-page-wrapper relative bg-[var(--color-bg-surface)] shadow-md mb-4"
            style={{ width: Math.floor(viewport.width), height: Math.floor(viewport.height) }}
            data-page={pageNumber}
        >
            <canvas ref={canvasRef} className="block" />
            {/* Highlight overlays go here (z-index 1) — below the text layer */}
            {children}
            {/* Text layer sits on TOP so it can receive mouse events for text selection */}
            <div
                ref={textLayerRef}
                className="absolute inset-0 textLayer leading-none"
                style={{
                    overflow: 'hidden',
                    zIndex: 2,
                    // Strictly required natively by pdf_viewer.css for precise math
                    '--scale-factor': scale,
                    '--total-scale-factor': scale * (page.userUnit || 1)
                } as React.CSSProperties}
            />
        </div>
    )
}
