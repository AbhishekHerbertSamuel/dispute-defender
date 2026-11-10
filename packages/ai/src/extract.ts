import { z } from 'zod';
/** WASEEM: add PDF/OCR here, or expose POST AI_EXTRACT_URL.
 * The API keeps the original bytes. Extraction must never overwrite originals.
 * Optional remote request: {name,mimeType,base64}; response: {text:string}.
 */
export async function extractEvidence(name: string, mimeType: string, bytes: Buffer, env = process.env): Promise<{
    text: string;
    extractionStatus: 'ready' | 'needs-extraction';
}> {
    if (mimeType === 'text/plain')
        return { text: bytes.toString('utf8'), extractionStatus: 'ready' };
    if (!env.AI_EXTRACT_URL)
        return { text: '', extractionStatus: 'needs-extraction' };
    const response = await fetch(env.AI_EXTRACT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(env.AI_SERVICE_TOKEN ? { Authorization: `Bearer ${env.AI_SERVICE_TOKEN}` } : {}) }, body: JSON.stringify({ name, mimeType, base64: bytes.toString('base64') }), signal: AbortSignal.timeout(60000), redirect: 'error' });
    if (!response.ok)
        throw new Error(`Extraction service returned HTTP ${response.status}; upload was not saved. Retry or upload a text transcript.`);
    const { text } = z.object({ text: z.string().trim().min(1).max(60000) }).parse(await response.json());
    return { text, extractionStatus: 'ready' };
}
