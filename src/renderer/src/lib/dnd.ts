// ============================================================================
// ThreadMed — Drag & Drop Helpers
// ============================================================================
// Shared utilities for managing drag-and-drop hierarchy operations on folders
// and determining validity of drop targets (e.g. depth limits, self-nesting).
// ============================================================================

import type { Folder } from '@/types'

/**
 * Checks if `folderToDragId` is an ancestor of `targetId`, preventing dropping
 * a folder into itself or any of its own descendants.
 */
export const isDescendant = (folders: Folder[], targetId: string, folderToDragId: string): boolean => {
    if (folderToDragId === targetId) return true
    const children = folders.filter(f => f.parent_id === folderToDragId)
    for (const child of children) {
        if (isDescendant(folders, targetId, child.id)) return true
    }
    return false
}

/**
 * Calculates the total depth of a folder tree starting from a specific node.
 * Returning 1 means the node has no children. 
 * Returning 2 means children exist, but no grandchildren, etc.
 */
export const getTreeDepth = (folders: Folder[], folderId: string): number => {
    const children = folders.filter(f => f.parent_id === folderId)
    if (children.length === 0) return 1
    return 1 + Math.max(0, ...children.map(c => getTreeDepth(folders, c.id)))
}

/**
 * Calculates how deep into the folder hierarchy a specific target ID is.
 * Returning 1 means the node sits at the root (parent_id = null).
 */
export const getPathDepth = (folders: Folder[], folderId: string | null): number => {
    if (!folderId) return 0
    let depth = 1
    let curr = folders.find(f => f.id === folderId)
    while (curr?.parent_id) {
        depth++
        curr = folders.find(f => f.id === curr!.parent_id)
    }
    return depth
}
