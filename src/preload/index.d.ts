// Type declarations for the preload API exposed to the renderer
import type { ThreadMedAPI } from './index'

declare global {
    interface Window {
        api: ThreadMedAPI
    }
}
