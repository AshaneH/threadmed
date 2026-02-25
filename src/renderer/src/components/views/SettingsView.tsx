// ============================================================================
// ThreadMed — Settings View
// ============================================================================
// User preferences and application settings. Includes theme toggle,
// data directory info, and future settings placeholders.
// ============================================================================

import { useState, useEffect } from 'react'
import { Sun, Moon, Database, FolderOpen, Info } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
    title: string
    description?: string
    children: React.ReactNode
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
    return (
        <div className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
            {description && (
                <p className="text-[13px] text-[var(--color-text-tertiary)] mb-5 leading-relaxed">{description}</p>
            )}
            {children}
        </div>
    )
}

type ThemeOption = 'dark' | 'light'

export function SettingsView() {
    const { theme, setTheme } = useTheme()
    const [dbPath, setDbPath] = useState('')
    const [appVersion] = useState('0.1.0')

    useEffect(() => {
        loadDbPath()
    }, [])

    async function loadDbPath() {
        try {
            if (!window.api) return
            const path = await window.api.system.dbPath()
            setDbPath(path)
        } catch (err) {
            console.error('[Settings] Failed to load db path:', err)
        }
    }

    const themeOptions: Array<{ value: ThemeOption; label: string; icon: React.ReactNode; desc: string }> = [
        { value: 'dark', label: 'Dark', icon: <Moon size={18} />, desc: 'Easy on the eyes for long reading sessions' },
        { value: 'light', label: 'Light', icon: <Sun size={18} />, desc: 'Clean and bright for daytime use' }
    ]

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto p-8 space-y-6 animate-fade-in">
                {/* Header */}
                <div className="space-y-2 mb-8">
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Settings</h1>
                    <p className="text-[14px] text-[var(--color-text-secondary)]">
                        Customize ThreadMed to fit your workflow.
                    </p>
                </div>

                {/* ── Appearance ──────────────────────────────────────────────── */}
                <SettingsSection
                    title="Appearance"
                    description="Choose your preferred color theme."
                >
                    <div className="grid grid-cols-2 gap-4">
                        {themeOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className={cn(
                                    'flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all',
                                    'hover:-translate-y-0.5 active:translate-y-0',
                                    theme === opt.value
                                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] shadow-md'
                                        : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-hover)] hover:border-[var(--color-border)]'
                                )}
                            >
                                <div className={cn(
                                    'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                                    theme === opt.value
                                        ? 'bg-[var(--color-accent)] text-white'
                                        : 'bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)]'
                                )}>
                                    {opt.icon}
                                </div>
                                <div className="text-center">
                                    <p className={cn(
                                        'text-[14px] font-semibold',
                                        theme === opt.value ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                                    )}>
                                        {opt.label}
                                    </p>
                                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{opt.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </SettingsSection>

                {/* ── Data & Storage ─────────────────────────────────────────── */}
                <SettingsSection
                    title="Data & Storage"
                    description="Where your papers, annotations, and PDFs are stored."
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-bg-hover)]">
                            <Database size={16} className="text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Database Location</p>
                                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1 truncate font-mono" title={dbPath}>
                                    {dbPath || 'Loading...'}
                                </p>
                            </div>
                            <button className="shrink-0 px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-active)] rounded-lg hover:bg-[var(--color-border)] transition-colors">
                                Open Folder
                            </button>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-bg-hover)]">
                            <FolderOpen size={16} className="text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">PDF Storage</p>
                                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1 font-mono">
                                    {dbPath ? dbPath.replace('threadmed.db', 'pdfs/') : 'Loading...'}
                                </p>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                {/* ── Zotero Integration ──────────────────────────────────────── */}
                <SettingsSection
                    title="Zotero Integration"
                    description="Connect your Zotero account to sync papers automatically."
                >
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-hover)]">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <span className="text-red-400 text-[16px] font-bold">Z</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Not connected</p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)]">Enter your API key to start syncing</p>
                        </div>
                        <button className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-[12px] font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
                            Connect
                        </button>
                    </div>
                </SettingsSection>

                {/* ── About ───────────────────────────────────────────────────── */}
                <SettingsSection title="About">
                    <div className="flex items-center gap-4">
                        <Info size={16} className="text-[var(--color-text-tertiary)]" />
                        <div>
                            <p className="text-[13px] text-[var(--color-text-secondary)]">
                                ThreadMed v{appVersion} — Literature synthesis for evidence-based medicine
                            </p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                                SQLite + FTS5 · Electron · React · TypeScript
                            </p>
                        </div>
                    </div>
                </SettingsSection>
            </div>
        </div>
    )
}
