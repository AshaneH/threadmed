// ============================================================================
// ThreadMed — StatusBar Component
// ============================================================================

import { useState, useEffect } from 'react'
import { useDataRefresh } from '@/lib/events'
import { Database, HardDrive } from 'lucide-react'

export function StatusBar() {
    const [paperCount, setPaperCount] = useState<number>(0)
    const [dbPath, setDbPath] = useState<string>('')

    useEffect(() => {
        loadStatus()
    }, [])

    useDataRefresh(loadStatus)

    async function loadStatus() {
        try {
            if (!window.api) return
            const [count, path] = await Promise.all([
                window.api.papers.count(),
                window.api.system.getDbPath()
            ])
            setPaperCount(count)
            setDbPath(path)
        } catch (err) {
            console.error('[StatusBar] Failed to load status:', err)
        }
    }

    return (
        <div className="flex items-center justify-between h-8 px-5 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-tertiary)] select-none shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <HardDrive size={11} className="opacity-40" />
                    <span>{paperCount} paper{paperCount !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Database size={11} className="opacity-40" />
                <span className="truncate max-w-72 opacity-70" title={dbPath}>
                    {dbPath ? dbPath.split(/[\\/]/).slice(-2).join('/') : '...'}
                </span>
            </div>
        </div>
    )
}
