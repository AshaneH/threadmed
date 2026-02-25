// ============================================================================
// ThreadMed — PDF File Naming Service
// ============================================================================
// Generates standardized academic filenames: Smith2024.pdf, SmithJones2024.pdf,
// WangEtAl2024.pdf. Handles collisions with b/c/d suffixes.
// ============================================================================

import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Extract the last name from a full author name.
 * Handles "Last, First" and "First Last" formats.
 */
function extractLastName(fullName: string): string {
    const trimmed = fullName.trim()
    if (trimmed.includes(',')) {
        // "Last, First" format
        return trimmed.split(',')[0].trim()
    }
    // "First Last" format
    const parts = trimmed.split(/\s+/)
    return parts[parts.length - 1]
}

/**
 * Sanitize a string for use in a filename.
 * Removes special chars, keeps alphanumeric and underscores.
 */
function sanitize(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 40) // limit length
}

/**
 * Generate a standardized PDF filename.
 *
 * Rules:
 * - 1 author:  Smith2024.pdf
 * - 2 authors: SmithJones2024.pdf
 * - 3+ authors: SmithEtAl2024.pdf
 * - Unknown author: Untitled2024.pdf
 * - Unknown year: SmithNoYear.pdf
 * - Collision: Smith2024b.pdf, Smith2024c.pdf, ...
 */
export function generatePdfFilename(
    authors: string[],
    year: number | null,
    pdfDir: string
): string {
    // Build the base name from authors
    let authorPart: string
    if (!authors || authors.length === 0) {
        authorPart = 'Untitled'
    } else if (authors.length === 1) {
        authorPart = sanitize(extractLastName(authors[0]))
    } else if (authors.length === 2) {
        authorPart = sanitize(extractLastName(authors[0])) + sanitize(extractLastName(authors[1]))
    } else {
        authorPart = sanitize(extractLastName(authors[0])) + 'EtAl'
    }

    if (!authorPart) authorPart = 'Untitled'

    const yearPart = year ? String(year) : 'NoYear'
    const baseName = `${authorPart}${yearPart}`

    // Check for collisions and add suffix if needed
    let filename = `${baseName}.pdf`
    if (!existsSync(join(pdfDir, filename))) {
        return filename
    }

    // Collision: try b, c, d, ...
    const suffixes = 'bcdefghijklmnopqrstuvwxyz'
    for (const suffix of suffixes) {
        filename = `${baseName}${suffix}.pdf`
        if (!existsSync(join(pdfDir, filename))) {
            return filename
        }
    }

    // Extreme fallback: use timestamp
    filename = `${baseName}_${Date.now()}.pdf`
    return filename
}
