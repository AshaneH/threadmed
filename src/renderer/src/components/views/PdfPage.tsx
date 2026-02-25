// ============================================================================
// ThreadMed — PDF Page (Canvas Renderer)
// ============================================================================
// Renders a single PDF page to <canvas> with a text layer overlay for
// text selection. Uses pdfjs-dist v5 API directly.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'

interface PdfPageProps {
    page: PDFPageProxy
    scale: number
    pageNumber: number
}

export function PdfPage({ page, scale, pageNumber }: PdfPageProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const textLayerRef = useRef<HTMLDivElement>(null)
    const [dims, setDims] = useState({ width: 0, height: 0 })
    const textLayerInstance = useRef<TextLayer | null>(null)

    useEffect(() => {
        const viewport = page.getViewport({ scale })
        setDims({ width: viewport.width, height: viewport.height })

        // ── Render canvas ────────────────────────────────────────────────
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = viewport.width * dpr
        canvas.height = viewport.height * dpr
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // pdfjs-dist v5: pass `canvas` alongside `canvasContext` and `viewport`
        const renderTask = page.render({
            canvas,
            canvasContext: ctx,
            viewport
        })
        // Suppress harmless cancellation errors from HMR / React strict mode
        renderTask.promise.catch(() => { })

        // ── Render text layer (v5: use TextLayer class) ──────────────────
        const textDiv = textLayerRef.current
        if (textDiv) {
            // Clean up previous text layer
            if (textLayerInstance.current) {
                textLayerInstance.current.cancel()
            }
            textDiv.innerHTML = ''

            page.getTextContent().then(textContent => {
                const tl = new TextLayer({
                    textContentSource: textContent,
                    container: textDiv,
                    viewport
                })
                textLayerInstance.current = tl
                tl.render()
            })
        }

        return () => {
            renderTask.cancel()
            if (textLayerInstance.current) {
                textLayerInstance.current.cancel()
                textLayerInstance.current = null
            }
        }
    }, [page, scale])

    return (
        <div
            className="pdf-page-wrapper relative bg-white shadow-lg rounded-sm overflow-hidden"
            style={{ width: dims.width, height: dims.height }}
            data-page={pageNumber}
        >
            <canvas ref={canvasRef} className="block" />
            <div
                ref={textLayerRef}
                className="absolute inset-0 textLayer"
                style={{ overflow: 'hidden' }}
            />
        </div>
    )
}
