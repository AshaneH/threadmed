// ============================================================================
// ThreadMed — Global UI Event Bus
// ============================================================================
// Simple event dispatcher to trigger re-renders across the app without complex
// context propagation, mainly used to refresh the Sidebar and StatusBar when
// papers are added, deleted, or synced.
// ============================================================================

import { useEffect } from 'react'

type Listener = () => void
const listeners = new Set<Listener>()

/** Trigger a global data refresh across all subscribed components */
export function triggerDataRefresh(): void {
    listeners.forEach(fn => fn())
}

/** Hook to listen for global data refreshes */
export function useDataRefresh(callback: () => void): void {
    useEffect(() => {
        listeners.add(callback)
        return () => {
            listeners.delete(callback)
        }
    }, [callback])
}
