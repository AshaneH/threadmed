// ============================================================================
// ThreadMed — Paper Dialog
// ============================================================================
// Modal for adding a new paper manually or editing an existing one.
// ============================================================================

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, FileUp, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CreatePaperInput, PaperWithAuthors } from '@/types'

interface PaperDialogProps {
    isOpen: boolean
    onClose: () => void
    onSave: (data: CreatePaperInput & { pdfPath?: string }) => Promise<void>
    initialData?: PaperWithAuthors | null
}

export function PaperDialog({ isOpen, onClose, onSave, initialData }: PaperDialogProps) {
    const [title, setTitle] = useState(initialData?.title || '')
    const [authors, setAuthors] = useState(initialData?.authors?.join(', ') || '')
    const [year, setYear] = useState(initialData?.year?.toString() || '')
    const [journal, setJournal] = useState(initialData?.journal || '')
    const [doi, setDoi] = useState(initialData?.doi || '')
    const [abstract, setAbstract] = useState(initialData?.abstract || '')
    const [pdfPath, setPdfPath] = useState<string | undefined>(undefined)
    const [pdfFilename, setPdfFilename] = useState<string | undefined>(undefined)
    const [isSaving, setIsSaving] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isOpen) {
            setTitle(initialData?.title || '')
            setAuthors(initialData?.authors?.join(', ') || '')
            setYear(initialData?.year?.toString() || '')
            setJournal(initialData?.journal || '')
            setDoi(initialData?.doi || '')
            setAbstract(initialData?.abstract || '')
            setPdfPath(undefined)
            setPdfFilename(undefined)
            setIsSaving(false)
        }
    }, [isOpen, initialData])

    if (!isOpen || !mounted) return null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) return

        try {
            setIsSaving(true)

            // Parse authors from comma-separated string
            const authorList = authors
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean)

            await onSave({
                title: title.trim(),
                authors: authorList,
                year: year ? parseInt(year, 10) : null,
                journal: journal.trim() || null,
                doi: doi.trim() || null,
                abstract: abstract.trim() || null,
                pdfPath
            })
            onClose()
        } catch (err) {
            console.error('[PaperDialog] Failed to save paper:', err)
            alert('Failed to save paper. See console for details.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setIsDragging(true)
        }
    }

    const handleDragLeave = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement
        const related = e.relatedTarget as HTMLElement
        if (!related || !target.contains(related)) {
            setIsDragging(false)
        }
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
        if (pdfFile) {
            const filePath = window.api.system.getFilePath(pdfFile)
            if (filePath) {
                setPdfPath(filePath)
                setPdfFilename(pdfFile.name)
            } else {
                alert("Could not retrieve the file path for the dragged file. Please use the Upload button instead.")
            }
        }
    }

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in text-left">
            <form
                onSubmit={handleSubmit}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "bg-[var(--color-bg-surface)] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all border relative",
                    isDragging ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20 scale-[1.01]" : "border-[var(--color-border)]"
                )}
            >
                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] shrink-0">
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                        {initialData ? 'Edit Paper' : 'Add Paper Manually'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] p-1.5 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Form Body ─────────────────────────────────────────────── */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="e.g., The role of immune cells in tumor progression"
                            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all placeholder:text-[var(--color-text-tertiary)]/50"
                        />
                    </div>

                    {/* Authors */}
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
                            Authors
                        </label>
                        <input
                            type="text"
                            value={authors}
                            onChange={(e) => setAuthors(e.target.value)}
                            placeholder="Comma separated (e.g., Doe J, Smith A)"
                            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all placeholder:text-[var(--color-text-tertiary)]/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        {/* Year */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
                                Year
                            </label>
                            <input
                                type="number"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="e.g., 2024"
                                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all placeholder:text-[var(--color-text-tertiary)]/50"
                            />
                        </div>

                        {/* Journal */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
                                Journal
                            </label>
                            <input
                                type="text"
                                value={journal}
                                onChange={(e) => setJournal(e.target.value)}
                                placeholder="e.g., Nature Medicine"
                                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all placeholder:text-[var(--color-text-tertiary)]/50"
                            />
                        </div>
                    </div>

                    {/* DOI */}
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
                            DOI
                        </label>
                        <input
                            type="text"
                            value={doi}
                            onChange={(e) => setDoi(e.target.value)}
                            placeholder="e.g., 10.1038/s41591-023..."
                            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all placeholder:text-[var(--color-text-tertiary)]/50"
                        />
                    </div>

                    {/* Abstract */}
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
                            Abstract
                        </label>
                        <textarea
                            value={abstract}
                            onChange={(e) => setAbstract(e.target.value)}
                            placeholder="Optional abstract..."
                            rows={4}
                            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all placeholder:text-[var(--color-text-tertiary)]/50 custom-scrollbar resize-none"
                        />
                    </div>

                    {/* PDF Upload */}
                    <div className="space-y-1.5 pt-2 border-t border-[var(--color-border-subtle)]">
                        <label className="text-[13px] font-semibold text-[var(--color-text-secondary)] block">
                            PDF Attachment
                        </label>
                        <div className="flex items-center justify-between bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded bg-[var(--color-bg-active)] flex items-center justify-center shrink-0">
                                    <FileText size={18} className={initialData?.pdf_filename || pdfFilename ? "text-[var(--color-accent)]" : "text-[var(--color-text-tertiary)] opacity-50"} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] text-[var(--color-text-primary)] font-medium truncate">
                                        {pdfFilename ? pdfFilename : (initialData?.pdf_filename ? initialData.pdf_filename : 'No PDF attached')}
                                    </p>
                                    <p className="text-[11px] text-[var(--color-text-tertiary)]">
                                        {pdfFilename ? 'Will be attached on save' : (initialData?.pdf_filename ? 'Currently attached (Drop a new PDF to replace)' : 'Upload or drag and drop a PDF here')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const filePaths = await window.api.system.showOpenDialog({
                                            properties: ['openFile'],
                                            filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
                                        })
                                        if (filePaths && filePaths.length > 0) {
                                            setPdfPath(filePaths[0])
                                            const name = filePaths[0].split(/[/\\]/).pop() || 'Selected PDF'
                                            setPdfFilename(name)
                                        }
                                    } catch (err) {
                                        console.error('Failed to select PDF:', err)
                                    }
                                }}
                                className="cursor-pointer shrink-0 ml-4 flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] text-[12px] font-medium text-[var(--color-text-primary)] transition-colors"
                            >
                                <FileUp size={14} />
                                {initialData?.pdf_filename || pdfFilename ? 'Replace PDF' : 'Upload PDF'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div className="px-6 py-4 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border-subtle)] flex justify-end gap-3 shrink-0 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || !title.trim()}
                        className="flex items-center gap-2 px-5 py-2 bg-[var(--color-accent)] text-white text-[13px] font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[var(--color-accent)]/20"
                    >
                        <Save size={14} />
                        {isSaving ? 'Saving...' : 'Save Paper'}
                    </button>
                </div>

                {/* ── Drag Overlay ────────────────────────────────────────────── */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 rounded-2xl bg-[var(--color-bg-surface)]/90 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in pointer-events-none border-4 border-dashed border-[var(--color-accent)]/50 m-2">
                        <div className="w-24 h-24 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center mb-6 text-[var(--color-accent)] animate-bounce">
                            <FileUp size={48} />
                        </div>
                        <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Drop PDF here</h3>
                        <p className="text-[15px] text-[var(--color-text-secondary)] font-medium text-center max-w-sm">
                            Release to instantly attach this file to the paper.
                        </p>
                    </div>
                )}
            </form>
        </div>
    )

    return createPortal(modalContent, document.body)
}
