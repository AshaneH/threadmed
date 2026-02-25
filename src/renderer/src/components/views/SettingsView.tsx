// ============================================================================
// ThreadMed — Settings View
// ============================================================================
// User preferences and application settings. Includes theme toggle,
// Zotero connection, data directory info, and about section.
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, Database, FolderOpen, Info, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import type { ZoteroStatus, SyncProgress, SyncResult, ConnectResult } from '@/types'

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

    // Zotero state
    const [zoteroStatus, setZoteroStatus] = useState<ZoteroStatus | null>(null)
    const [apiKey, setApiKey] = useState('')
    const [userId, setUserId] = useState('')
    const [connecting, setConnecting] = useState(false)
    const [connectError, setConnectError] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
    const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

    useEffect(() => {
        loadDbPath()
        loadZoteroStatus()

        // Listen for sync progress events
        if (window.api) {
            window.api.zotero.onSyncProgress((progress) => {
                setSyncProgress(progress as SyncProgress)
            })
        }

        return () => {
            if (window.api) {
                window.api.zotero.offSyncProgress()
            }
        }
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

    async function loadZoteroStatus() {
        try {
            if (!window.api) return
            const status = await window.api.zotero.status() as ZoteroStatus
            setZoteroStatus(status)
        } catch (err) {
            console.error('[Settings] Failed to load Zotero status:', err)
        }
    }

    async function handleConnect() {
        if (!apiKey.trim() || !userId.trim()) {
            setConnectError('Both API key and User ID are required')
            return
        }

        setConnecting(true)
        setConnectError('')

        try {
            const result = await window.api.zotero.connect(apiKey.trim(), userId.trim()) as ConnectResult
            if (result.valid) {
                setApiKey('')
                setUserId('')
                await loadZoteroStatus()
            } else {
                setConnectError(result.error || 'Invalid credentials')
            }
        } catch (err) {
            setConnectError(err instanceof Error ? err.message : 'Connection failed')
        } finally {
            setConnecting(false)
        }
    }

    async function handleDisconnect() {
        try {
            await window.api.zotero.disconnect()
            setZoteroStatus(null)
            setLastSyncResult(null)
            setSyncProgress(null)
            await loadZoteroStatus()
        } catch (err) {
            console.error('[Settings] Disconnect failed:', err)
        }
    }

    async function handleSync() {
        setSyncing(true)
        setSyncProgress(null)
        setLastSyncResult(null)

        try {
            const result = await window.api.zotero.sync() as SyncResult
            setLastSyncResult(result)
            await loadZoteroStatus()
        } catch (err) {
            console.error('[Settings] Sync failed:', err)
        } finally {
            setSyncing(false)
            setSyncProgress(null)
        }
    }

    const themeOptions: Array<{ value: ThemeOption; label: string; icon: React.ReactNode; desc: string }> = [
        { value: 'dark', label: 'Dark', icon: <Moon size={18} />, desc: 'Easy on the eyes for long reading sessions' },
        { value: 'light', label: 'Light', icon: <Sun size={18} />, desc: 'Clean and bright for daytime use' }
    ]

    const progressLabel = syncProgress
        ? syncProgress.phase === 'metadata' ? 'Fetching metadata...'
            : syncProgress.phase === 'downloading' ? `Importing ${syncProgress.current}/${syncProgress.total}: ${syncProgress.paperTitle || ''}`
                : syncProgress.phase === 'extracting' ? `Extracting text ${syncProgress.current}/${syncProgress.total}: ${syncProgress.paperTitle || ''}`
                    : syncProgress.phase === 'error' ? `Error: ${syncProgress.error}`
                        : 'Complete'
        : ''

    const progressPercent = syncProgress && syncProgress.total > 0
        ? Math.round((syncProgress.current / syncProgress.total) * 100)
        : 0

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

                {/* ── Zotero Integration ──────────────────────────────────────── */}
                <SettingsSection
                    title="Zotero Integration"
                    description="Connect your Zotero account to sync papers, metadata, and PDFs."
                >
                    {zoteroStatus?.connected ? (
                        /* Connected State */
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-hover)]">
                                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center">
                                    <CheckCircle2 size={20} className="text-[var(--color-accent)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                                        Connected
                                    </p>
                                    <p className="text-[11px] text-[var(--color-text-tertiary)]">
                                        User ID: {zoteroStatus.userId}
                                        {zoteroStatus.lastSync && ` · Last sync: ${new Date(zoteroStatus.lastSync).toLocaleString()}`}
                                    </p>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    className="shrink-0 px-3 py-1.5 text-[11px] font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>

                            {/* Sync Button + Progress */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className={cn(
                                        'flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-[13px] font-semibold transition-all',
                                        syncing
                                            ? 'bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                                            : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-md shadow-[var(--color-accent)]/15'
                                    )}
                                >
                                    {syncing ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <RefreshCw size={14} />
                                    )}
                                    {syncing ? 'Syncing...' : 'Sync Now'}
                                </button>

                                {/* Progress Bar */}
                                {syncing && syncProgress && (
                                    <div className="space-y-2 p-4 rounded-xl bg-[var(--color-bg-hover)]">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[var(--color-text-secondary)] truncate max-w-[80%]">
                                                {progressLabel}
                                            </span>
                                            <span className="text-[var(--color-text-tertiary)] tabular-nums shrink-0">
                                                {progressPercent}%
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-[var(--color-bg-active)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Sync Result */}
                                {lastSyncResult && !syncing && (
                                    <div className="p-4 rounded-xl bg-[var(--color-bg-hover)] text-[12px] space-y-1">
                                        <p className="text-[var(--color-text-secondary)] font-medium">Sync Complete</p>
                                        <p className="text-[var(--color-text-tertiary)]">
                                            {lastSyncResult.imported} imported · {lastSyncResult.updated} updated · {lastSyncResult.pdfsDownloaded} PDFs
                                        </p>
                                        {lastSyncResult.errors.length > 0 && (
                                            <div className="mt-2 text-red-400 space-y-0.5">
                                                {lastSyncResult.errors.slice(0, 5).map((err, i) => (
                                                    <p key={i} className="truncate">⚠ {err}</p>
                                                ))}
                                                {lastSyncResult.errors.length > 5 && (
                                                    <p>...and {lastSyncResult.errors.length - 5} more</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Disconnected State — Connect Form */
                        <div className="space-y-4">
                            <p className="text-[12px] text-[var(--color-text-tertiary)] leading-relaxed">
                                Create an API key at{' '}
                                <a
                                    href="https://www.zotero.org/settings/keys"
                                    className="text-[var(--color-accent)] hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    zotero.org/settings/keys
                                </a>
                                {' '}with "Allow library access" enabled. Your User ID is shown on that page.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">
                                        API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your Zotero API key"
                                        className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">
                                        User ID
                                    </label>
                                    <input
                                        type="text"
                                        value={userId}
                                        onChange={(e) => setUserId(e.target.value)}
                                        placeholder="Enter your Zotero User ID (numeric)"
                                        className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            {connectError && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-[12px]">
                                    <XCircle size={14} />
                                    {connectError}
                                </div>
                            )}

                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className={cn(
                                    'flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-[13px] font-semibold transition-all',
                                    connecting
                                        ? 'bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                                        : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-md shadow-[var(--color-accent)]/15'
                                )}
                            >
                                {connecting ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : null}
                                {connecting ? 'Connecting...' : 'Connect'}
                            </button>
                        </div>
                    )}
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
