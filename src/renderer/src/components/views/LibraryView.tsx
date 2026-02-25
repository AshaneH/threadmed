// ============================================================================
// ThreadMed — Library View
// ============================================================================

import { useState, useEffect } from 'react'
import { BookOpen, FileText, ExternalLink, Plus } from 'lucide-react'
import type { Paper } from '@/types'

interface LibraryViewProps {
    onPaperSelect: (id: string) => void
    onNavigate: (view: string) => void
}

export function LibraryView({ onPaperSelect, onNavigate }: LibraryViewProps) {
    const [papers, setPapers] = useState<Paper[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadPapers()
    }, [])

    async function loadPapers() {
        try {
            if (!window.api) { setLoading(false); return }
            const list = await window.api.papers.list()
            setPapers(list)
        } catch (err) {
            console.error('[LibraryView] Failed to load papers:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-[var(--color-text-tertiary)] text-sm">Loading library...</div>
            </div>
        )
    }

    // ── Empty State: Welcome Screen ──────────────────────────────────────────
    if (papers.length === 0) {
        return (
            <div className="flex items-center justify-center h-full px-8">
                <div className="text-center space-y-10 max-w-xl animate-fade-in">
                    {/* Logo / Icon */}
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--color-accent)] to-[#0d9488] flex items-center justify-center mx-auto shadow-xl shadow-[var(--color-accent)]/15">
                        <BookOpen size={42} className="text-white" />
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
                            Welcome to ThreadMed
                        </h1>
                        <p className="text-[var(--color-text-secondary)] text-[15px] leading-relaxed max-w-md mx-auto">
                            Your literature synthesis workbench for evidence-based medicine.
                            Import papers from Zotero, annotate with PICO codes, and build your
                            synthesis matrix.
                        </p>
                    </div>

                    {/* Getting Started Steps */}
                    <div className="space-y-4 text-left">
                        <div className="flex gap-5 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center text-[13px] font-bold shrink-0">
                                1
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                    Connect Zotero
                                </p>
                                <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed">
                                    Link your Zotero library to import papers, metadata, and PDFs automatically.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-5 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-node-intervention)]/15 text-[var(--color-node-intervention)] flex items-center justify-center text-[13px] font-bold shrink-0">
                                2
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                    Annotate & Code
                                </p>
                                <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed">
                                    Highlight text in PDFs and assign to PICO nodes: Population, Intervention,
                                    Comparison, Outcomes.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-5 p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-node-outcomes)]/15 text-[var(--color-node-outcomes)] flex items-center justify-center text-[13px] font-bold shrink-0">
                                3
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                    Synthesize
                                </p>
                                <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed">
                                    View the Synthesis Matrix, search across all papers, and draft your
                                    review with linked evidence.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-5 justify-center pt-1">
                        <button
                            onClick={() => onNavigate('settings')}
                            className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[var(--color-accent)] text-white text-[14px] font-semibold hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/20 hover:shadow-xl hover:shadow-[var(--color-accent)]/30 hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <ExternalLink size={16} />
                            Connect Zotero
                        </button>
                        <button className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[14px] font-semibold hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-text-tertiary)] transition-all hover:-translate-y-0.5 active:translate-y-0">
                            <Plus size={16} />
                            Add Paper Manually
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Paper List ─────────────────────────────────────────────────────────────
    return (
        <div className="p-6 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
                    All Papers
                    <span className="ml-2 text-[14px] font-normal text-[var(--color-text-tertiary)]">
                        ({papers.length})
                    </span>
                </h2>
                <button className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-[13px] font-semibold hover:bg-[var(--color-accent-hover)] transition-all shadow-md shadow-[var(--color-accent)]/15 hover:-translate-y-0.5 active:translate-y-0">
                    <Plus size={14} />
                    Add Paper
                </button>
            </div>

            {papers.map((paper) => (
                <button
                    key={paper.id}
                    onClick={() => onPaperSelect(paper.id)}
                    className="w-full text-left p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-all group hover:-translate-y-0.5 active:translate-y-0"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-active)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-accent-subtle)] transition-colors">
                            <FileText size={18} className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-snug group-hover:text-[var(--color-accent)] transition-colors">
                                {paper.title}
                            </h3>
                            <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed">
                                {paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Author'}
                                {paper.year ? ` · ${paper.year}` : ''}
                                {paper.journal ? ` · ${paper.journal}` : ''}
                            </p>
                        </div>
                    </div>
                </button>
            ))}
        </div>
    )
}
