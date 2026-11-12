import { z } from 'zod';
export const SourceRefSchema = z.object({
    evidenceId: z.string().min(1),
    quote: z.string().min(1).max(2000),
    page: z.number().int().positive().optional(),
});
export const AnalysisSchema = z.object({
    summary: z.string().min(1).max(4000),
    timeline: z.array(z.object({ date: z.string().max(80), event: z.string().max(1500), sources: z.array(SourceRefSchema).min(1) })).max(100),
    missingEvidence: z.array(z.object({ title: z.string().max(200), detail: z.string().max(1000), severity: z.enum(['warning', 'critical']) })).max(30),
    contradictions: z.array(z.object({ detail: z.string().max(1500), sources: z.array(SourceRefSchema).min(1) })).max(30),
    draft: z.array(z.object({ text: z.string().min(1).max(4000), sources: z.array(SourceRefSchema).min(1) })).max(30),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type AnalysisContent = z.infer<typeof AnalysisSchema>;
export type Analysis = AnalysisContent & {
    provider: 'demo' | 'service' | 'llm';
    generatedAt: string;
    evidenceVersion: number;
};
export type Evidence = {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    text: string;
    extractionStatus: 'ready' | 'needs-extraction';
    createdAt: string;
};
export type Submission = {
    state: 'pending' | 'succeeded' | 'failed' | 'unknown';
    at: string;
    message: string;
    debugId?: string;
    packageHash: string;
};
export type DisputeCase = {
    id: string;
    source: 'demo' | 'sandbox';
    title: string;
    buyerName: string;
    amount: {
        value: string;
        currency: string;
    };
    reason: string;
    status: string;
    createdAt: string;
    dueAt: string | null;
    transactionId: string;
    buyerNote: string;
    canProvideEvidence: boolean;
    canSendMessage?: boolean;
    messageReceipt?: Submission | null;
    requestedEvidenceTypes: string[];
    evidence: Evidence[];
    evidenceVersion: number;
    analysis: Analysis | null;
    editedDraft: string;
    draftRevision: number;
    submission: Submission | null;
};
export type AnalysisInput = {
    schemaVersion: '1.0';
    case: Pick<DisputeCase, 'id' | 'reason' | 'buyerNote' | 'transactionId'>;
    evidence: Evidence[];
};
export type AppConfig = {
    mode: 'demo' | 'sandbox';
    aiProvider: 'demo' | 'service' | 'llm';
    paypalConfigured: boolean;
    authenticated: boolean;
    requiresLogin: boolean;
};
export const EvidenceUploadSchema = z.object({ name: z.string().min(1).max(180), mimeType: z.enum(['text/plain', 'application/pdf', 'image/png', 'image/jpeg']), base64: z.string().min(1).max(7000000) });
export const SubmitSchema = z.object({
    approved: z.literal(true), draftRevision: z.number().int().nonnegative(), evidenceVersion: z.number().int().nonnegative(),
    evidenceType: z.literal('PROOF_OF_FULFILLMENT'),
    trackingNumber: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9 -]+$/),
    carrier: z.string().trim().min(1).max(100),
    evidenceIds: z.array(z.string().uuid()).min(1).max(10),
});
export type SubmitInput = z.infer<typeof SubmitSchema>;
/** Quotes must actually occur in the cited evidence. Semantic entailment still needs review. */
export function validateGrounding(content: AnalysisContent, evidence: Evidence[]): AnalysisContent {
    const normalized = (s: string) => s.replace(/\s+/g, ' ').trim();
    const refs = [...content.timeline, ...content.contradictions, ...content.draft].flatMap(x => x.sources);
    for (const ref of refs) {
        const source = evidence.find(e => e.id === ref.evidenceId);
        if (!source || !normalized(ref.quote) || !normalized(source.text).includes(normalized(ref.quote)))
            throw new Error('Analysis contains an unknown source or a quote absent from its source.');
        if (ref.page !== undefined) {
            const marker = `[Page ${ref.page}]`;
            const start = source.text.indexOf(marker);
            const end = start < 0 ? -1 : source.text.indexOf('[Page ', start + marker.length);
            if (start < 0 || !normalized(source.text.slice(start + marker.length, end < 0 ? undefined : end)).includes(normalized(ref.quote)))
                throw new Error('Analysis cites a page that does not contain its quote.');
        }
    }
    return content;
}
