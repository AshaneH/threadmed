// ============================================================================
// ThreadMed — IPC Hook
// ============================================================================
// Typed React hook for invoking IPC methods from the preload bridge.
// ============================================================================

/** Access the ThreadMed API exposed by the preload script */
export function useApi() {
    return window.api
}
