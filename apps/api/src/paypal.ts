import type { DisputeCase, SubmitInput } from '../../../packages/contracts/src/index.ts';
export const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
type Raw = Record<string, any>;
export class PayPalError extends Error {
    constructor(message: string, public status: number, public debugId?: string, public uncertain = false) { super(message); }
}
export class PayPal {
    private cachedToken?: {
        token: string;
        expires: number;
    };
    constructor(private clientId: string, private secret: string, private request: typeof fetch = fetch) { }
    get configured() { return !!(this.clientId && this.secret); }
    private async token() {
        if (!this.configured)
            throw new PayPalError('PayPal sandbox credentials are missing.', 503);
        if (this.cachedToken && this.cachedToken.expires > Date.now())
            return this.cachedToken.token;
        const r = await this.request(`${PAYPAL_BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (!r.ok)
            throw new PayPalError('PayPal authentication failed. Check sandbox credentials.', 502);
        const data = await r.json() as {
            access_token: string;
            expires_in: number;
        };
        if (!data.access_token)
            throw new PayPalError('PayPal returned no access token.', 502);
        this.cachedToken = { token: data.access_token, expires: Date.now() + Math.max(0, Number(data.expires_in) - 60) * 1000 };
        return data.access_token;
    }
    private async call(path: string, init: RequestInit = {}) {
        const token = await this.token();
        let r: Response;
        try {
            r = await this.request(`${PAYPAL_BASE}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000), redirect: 'error' });
        }
        catch {
            throw new PayPalError('PayPal did not return a response. Refresh the case in PayPal before retrying a submission.', 502, undefined, init.method === 'POST');
        }
        const data = await r.json().catch(() => ({})) as Raw;
        if (!r.ok) {
            if (r.status === 401)
                this.cachedToken = undefined;
            const reason = typeof data.name === 'string' ? data.name : 'API_ERROR';
            throw new PayPalError(`PayPal ${reason} (HTTP ${r.status}). Check the dispute state and app permissions.`, 502, data.debug_id, init.method === 'POST' && r.status >= 500);
        }
        return { data, debugId: r.headers.get('paypal-debug-id') || undefined };
    }
    async list() {
        const { data } = await this.call('/v1/customer/disputes?page_size=50');
        return { items: (Array.isArray(data.items) ? data.items : []) as Raw[], hasMore: (data.links || []).some((l: Raw) => l.rel === 'next') };
    }
    async detail(id: string): Promise<Raw> {
        if (!/^[A-Za-z0-9-]{1,255}$/.test(id))
            throw new PayPalError('Invalid dispute ID.', 400);
        return (await this.call(`/v1/customer/disputes/${encodeURIComponent(id)}`)).data;
    }
    async sendMessage(id: string, message: string) {
        const raw = await this.detail(id);
        if (!canMessage(raw)) throw new PayPalError('PayPal does not currently allow inquiry messages for this case.', 409);
        if (!message.trim() || message.length > 2000) throw new PayPalError('Message must contain 1–2000 characters.', 400);
        return this.call(`/v1/customer/disputes/${encodeURIComponent(id)}/send-message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    }
    async provideEvidence(id: string, draft: string, approval: SubmitInput, files: {
        name: string;
        mimeType: string;
        bytes: Uint8Array;
    }[]) {
        const raw = await this.detail(id);
        assertSubmittable(raw);
        const form = new FormData();
        // PayPal matches documents[].name to the multipart field name.
        const names = files.map((_, i) => `evidence-${i + 1}`);
        form.append('input', new Blob([JSON.stringify({ evidences: [{ evidence_type: approval.evidenceType, notes: draft, evidence_info: { tracking_info: [{ carrier_name: 'OTHER', carrier_name_other: approval.carrier, tracking_number: approval.trackingNumber }] }, documents: names.map(name => ({ name })) }] })], { type: 'application/json' }));
        files.forEach((f, i) => form.append(names[i], new Blob([Buffer.from(f.bytes)], { type: f.mimeType }), f.name));
        return this.call(`/v1/customer/disputes/${encodeURIComponent(id)}/provide-evidence`, { method: 'POST', body: form });
    }
}
export function canMessage(raw: Raw): boolean { return raw.dispute_life_cycle_stage === 'INQUIRY' && !!raw.links?.some((l: Raw) => ['send_message', 'send-message'].includes(l.rel) && l.method === 'POST'); }
export function assertSubmittable(raw: Raw) {
    if (raw.reason !== 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED')
        throw new PayPalError('This MVP supports item-not-received disputes only.', 409);
    if (raw.status !== 'WAITING_FOR_SELLER_RESPONSE' || !raw.links?.some((l: Raw) => ['provide-evidence', 'provide_evidence'].includes(l.rel) && l.method === 'POST'))
        throw new PayPalError('PayPal does not currently allow this seller to provide evidence.', 409);
    const requested = (raw.evidences || []).filter((e: Raw) => e.source === 'REQUESTED_FROM_SELLER').map((e: Raw) => e.evidence_type);
    if (!requested.includes('PROOF_OF_FULFILLMENT'))
        throw new PayPalError('PayPal has not requested proof of fulfillment. Review the requested evidence in PayPal.', 409);
}
export function normalizeDispute(raw: Raw, previous?: DisputeCase): DisputeCase {
    const tx = raw.disputed_transactions?.[0] || {};
    let allowed = true;
    try {
        assertSubmittable(raw);
    }
    catch {
        allowed = false;
    }
    const next: DisputeCase = {
        id: raw.dispute_id, source: 'sandbox', title: tx.items?.[0]?.item_name || `PayPal dispute ${raw.dispute_id}`, buyerName: tx.buyer?.name || 'PayPal buyer', amount: { value: raw.dispute_amount?.value || '0', currency: raw.dispute_amount?.currency_code || 'USD' }, reason: raw.reason || 'UNKNOWN', status: raw.status || 'UNKNOWN', createdAt: raw.create_time || '', dueAt: raw.seller_response_due_date || null, transactionId: tx.seller_transaction_id || '', buyerNote: (raw.messages || []).filter((m: Raw) => m.posted_by === 'BUYER').map((m: Raw) => m.content).join('\n') || 'No buyer message returned by PayPal.', canProvideEvidence: allowed, canSendMessage: canMessage(raw), messageReceipt: previous?.messageReceipt || null, requestedEvidenceTypes: (raw.evidences || []).filter((e: Raw) => e.source === 'REQUESTED_FROM_SELLER').map((e: Raw) => e.evidence_type), evidence: previous?.evidence || [], evidenceVersion: previous?.evidenceVersion || 0, analysis: previous?.analysis || null, editedDraft: previous?.editedDraft || '', draftRevision: previous?.draftRevision || 0, submission: previous?.submission || null,
    };
    // A refreshed claim can change the context used by the AI and merchant.
    if (previous && ['reason', 'buyerNote', 'transactionId', 'status'].some(key =>
        previous[key as keyof DisputeCase] !== next[key as keyof DisputeCase])) {
        next.analysis = null;
        next.editedDraft = '';
        next.evidenceVersion += 1;
        next.draftRevision += 1;
    }
    return next;
}
