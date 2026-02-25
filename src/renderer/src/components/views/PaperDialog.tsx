// ============================================================================
// ThreadMed — Paper Dialog
// ============================================================================
// Modal for adding a new paper manually or editing an existing one.
// ============================================================================

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import type { CreatePaperInput, PaperWithAuthors } from '@/types'

interface PaperDialogProps {
    isOpen: boolean
    onClose: () => void
    onSave: (data: CreatePaperInput) => Promise<void>
    initialData?: PaperWithAuthors | null
}

export function PaperDialog({ isOpen, onClose, onSave, initialData }: PaperDialogProps) {
    const [title, setTitle] = useState(initialData?.title || '')
    const [authors, setAuthors] = useState(initialData?.authors?.join(', ') || '')
    const [year, setYear] = useState(initialData?.year?.toString() || '')
    const [journal, setJournal] = useState(initialData?.journal || '')
    const [doi, setDoi] = useState(initialData?.doi || '')
    const [abstract, setAbstract] = useState(initialData?.abstract || '')
    const [isSaving, setIsSaving] = useState(false)

    if (!isOpen) return null

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
                abstract: abstract.trim() || null
            })
            onClose()
        } catch (err) {
            console.error('[PaperDialog] Failed to save paper:', err)
            alert('Failed to save paper. See console for details.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--color-bg-surface)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--color-border)] flex flex-col max-h-[90vh] overflow-hidden">
                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] shrink-0">
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                        {initialData ? 'Edit Paper' : 'Add Paper Manually'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] p-1.5 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Form Body ─────────────────────────────────────────────── */}
                <form id="paper-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
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
                            rows={5}
                            placeholder="Paste the abstract here..."
                            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all placeholder:text-[var(--color-text-tertiary)]/50 resize-y"
                        />
                    </div>
                </form>

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
                        form="paper-form"
                        disabled={isSaving || !title.trim()}
                        className="flex items-center gap-2 px-5 py-2 bg-[var(--color-accent)] text-white text-[13px] font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[var(--color-accent)]/20"
                    >
                        <Save size={14} />
                        {isSaving ? 'Saving...' : 'Save Paper'}
                    </button>
                </div>
            </div>
        </div>
    )
}
