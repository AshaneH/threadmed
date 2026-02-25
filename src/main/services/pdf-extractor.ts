// ============================================================================
// ThreadMed — PDF Text Extraction
// ============================================================================
// Extracts full text from PDF files using pdf-parse (Mozilla pdf.js wrapper).
// Runs in the main process. Returns empty string on failure; never throws.
// ============================================================================

import { readFileSync } from 'fs'

/**
 * Extract all text from a PDF file.
 * @param pdfPath Absolute path to the PDF file
 * @returns Extracted text (all pages concatenated), or empty string on failure
 */
export async function extractTextFromPdf(pdfPath: string): Promise<string> {
    try {
        // pdf-parse is a CJS module — use require to avoid ESM issues
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse')
        const buffer = readFileSync(pdfPath)
        const result = await pdfParse(buffer)
        return result.text || ''
    } catch (err) {
        console.error(`[PDF Extractor] Failed to extract text from ${pdfPath}:`, err)
        return ''
    }
}
