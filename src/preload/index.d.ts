import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
    PaperWithAuthors, CreatePaperInput, Folder, Node, Annotation,
    AnnotationWithContext, MatrixCell, ZoteroStatus, SyncResult
} from '../renderer/src/types'

export interface ThreadMedAPI {
    papers: {
        list: () => Promise<PaperWithAuthors[]>
        get: (id: string) => Promise<PaperWithAuthors | null>
        create: (input: CreatePaperInput) => Promise<PaperWithAuthors>
        count: () => Promise<number>
        search: (query: string, limit?: number) => Promise<Array<{ id: string, title: string, snippet: string, rank: number }>>
        updateFullText: (id: string, text: string) => Promise<void>
        delete: (id: string) => Promise<void>
        update: (id: string, updates: Partial<CreatePaperInput>) => Promise<void>
    }
    folders: {
        list: () => Promise<Folder[]>
        create: (name: string, parentId?: string) => Promise<Folder>
        update: (id: string, name: string) => Promise<void>
        delete: (id: string) => Promise<void>
        addPaper: (paperId: string, folderId: string) => Promise<void>
        removePaper: (paperId: string, folderId: string) => Promise<void>
        getPapers: (folderId: string) => Promise<PaperWithAuthors[]>
    }
    nodes: {
        list: () => Promise<Node[]>
        create: (name: string, color?: string) => Promise<Node>
        update: (id: string, updates: { name?: string; color?: string }) => Promise<void>
        delete: (id: string) => Promise<void>
    }
    annotations: {
        create: (input: import('../renderer/src/types').CreateAnnotationInput) => Promise<Annotation>
        forPaper: (paperId: string) => Promise<AnnotationWithContext[]>
        forNode: (nodeId: string) => Promise<AnnotationWithContext[]>
        matrix: () => Promise<MatrixCell[]>
        delete: (id: string) => Promise<void>
    }
    system: {
        dbPath: () => Promise<string>
        pdfDir: () => Promise<string>
    }
    zotero: {
        connect: (apiKey: string, userId: string) => Promise<{ valid: boolean; totalItems: number; error?: string }>
        disconnect: () => Promise<void>
        status: () => Promise<ZoteroStatus>
        sync: () => Promise<SyncResult>
        onSyncProgress: (callback: (progress: unknown) => void) => void
        offSyncProgress: () => void
    }
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: ThreadMedAPI
    }
}
