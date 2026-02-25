// ============================================================================
// ThreadMed — Zotero Web API v3 Client
// ============================================================================
// HTTP client for Zotero's REST API. Uses Node 20's native fetch.
// Handles pagination (max 100 items/request), rate limiting (Backoff /
// Retry-After headers), and incremental sync via Library-Version.
// ============================================================================

const ZOTERO_BASE = 'https://api.zotero.org'
const PAGE_SIZE = 100

/** Raw Zotero item as returned by the API (relevant fields only) */
export interface ZoteroItem {
    key: string
    version: number
    data: {
        itemType: string
        title: string
        date?: string
        DOI?: string
        publicationTitle?: string
        abstractNote?: string
        creators?: Array<{
            creatorType: string
            firstName?: string
            lastName?: string
            name?: string
        }>
        parentItem?: string
        contentType?: string
        filename?: string
        linkMode?: string
    }
}

/** Minimal validated connection info */
export interface ZoteroConnectionInfo {
    valid: boolean
    totalItems: number
    error?: string
}

export class ZoteroClient {
    private apiKey: string
    private userId: string
    /** Library-Version from the most recent API response */
    public lastLibraryVersion: number = 0

    constructor(apiKey: string, userId: string) {
        this.apiKey = apiKey
        this.userId = userId
    }

    // ── Core Fetch ──────────────────────────────────────────────────────────

    private async request(
        path: string,
        params: Record<string, string | number> = {},
        retries = 3
    ): Promise<{ data: unknown; headers: Headers }> {
        const url = new URL(`${ZOTERO_BASE}/users/${this.userId}${path}`)
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, String(v))
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            const res = await fetch(url.toString(), {
                headers: {
                    'Zotero-API-Key': this.apiKey,
                    'Zotero-API-Version': '3'
                }
            })

            // Rate limiting
            const backoff = res.headers.get('Backoff') || res.headers.get('Retry-After')
            if (res.status === 429 || backoff) {
                const waitMs = (parseInt(backoff || '5', 10)) * 1000
                console.log(`[Zotero] Rate limited, waiting ${waitMs}ms`)
                await this.sleep(waitMs)
                continue
            }

            if (!res.ok) {
                const body = await res.text()
                throw new Error(`Zotero API error ${res.status}: ${body}`)
            }

            // Track Library-Version
            const libVersion = res.headers.get('Last-Modified-Version')
            if (libVersion) {
                this.lastLibraryVersion = parseInt(libVersion, 10)
            }

            const data = await res.json()
            return { data, headers: res.headers }
        }

        throw new Error('Zotero API: max retries exceeded')
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    // ── Public Methods ──────────────────────────────────────────────────────

    /** Validate credentials by fetching 1 item */
    async validateCredentials(): Promise<ZoteroConnectionInfo> {
        try {
            const { headers } = await this.request('/items', { limit: 1 })
            const totalResults = parseInt(headers.get('Total-Results') || '0', 10)
            return { valid: true, totalItems: totalResults }
        } catch (err) {
            return {
                valid: false,
                totalItems: 0,
                error: err instanceof Error ? err.message : 'Unknown error'
            }
        }
    }

    /**
     * Fetch all top-level items (not attachments) modified since `sinceVersion`.
     * Automatically paginates through all results.
     */
    async fetchItems(sinceVersion: number = 0): Promise<ZoteroItem[]> {
        const allItems: ZoteroItem[] = []
        let start = 0

        while (true) {
            const params: Record<string, string | number> = {
                format: 'json',
                itemType: '-attachment || note',
                limit: PAGE_SIZE,
                start,
                sort: 'dateModified',
                direction: 'desc'
            }
            if (sinceVersion > 0) {
                params.since = sinceVersion
            }

            const { data, headers } = await this.request('/items', params)
            const items = data as ZoteroItem[]
            allItems.push(...items)

            const totalResults = parseInt(headers.get('Total-Results') || '0', 10)
            start += PAGE_SIZE

            if (start >= totalResults || items.length === 0) {
                break
            }
        }

        return allItems
    }

    /** Fetch child items (attachments) for a given parent item key */
    async fetchChildItems(parentKey: string): Promise<ZoteroItem[]> {
        const { data } = await this.request(`/items/${parentKey}/children`, {
            format: 'json'
        })
        return data as ZoteroItem[]
    }

    /** Download an attachment file (PDF) as a Buffer */
    async downloadFile(itemKey: string): Promise<Buffer> {
        const url = `${ZOTERO_BASE}/users/${this.userId}/items/${itemKey}/file`
        const res = await fetch(url, {
            headers: {
                'Zotero-API-Key': this.apiKey,
                'Zotero-API-Version': '3'
            }
        })

        if (!res.ok) {
            throw new Error(`Zotero file download failed: ${res.status}`)
        }

        const arrayBuffer = await res.arrayBuffer()
        return Buffer.from(arrayBuffer)
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Parse a Zotero date string to extract the year.
     * Zotero dates can be "2024", "2024-03-15", "March 2024", etc.
     */
    static parseYear(dateStr: string | undefined): number | null {
        if (!dateStr) return null
        const match = dateStr.match(/(\d{4})/)
        return match ? parseInt(match[1], 10) : null
    }

    /** Extract author names from Zotero creator array */
    static extractAuthors(
        creators: ZoteroItem['data']['creators']
    ): string[] {
        if (!creators) return []
        return creators
            .filter(c => c.creatorType === 'author')
            .map(c => {
                if (c.name) return c.name
                if (c.lastName && c.firstName) return `${c.lastName}, ${c.firstName}`
                return c.lastName || c.firstName || 'Unknown'
            })
    }
}
