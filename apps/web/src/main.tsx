import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppConfig, DisputeCase, Evidence, SourceRef } from '../../../packages/contracts/src/index.ts';
import './style.css';
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const r = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await r.json();
    if (!r.ok)
        throw new Error(data.error || 'Request failed.');
    return data;
}
const money = (c: DisputeCase) => { try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c.amount.currency }).format(Number(c.amount.value));
}
catch {
    return `${c.amount.currency} ${c.amount.value}`;
} };
const date = (s: string | null) => s && !Number.isNaN(Date.parse(s)) ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not provided';
const readable = (s: string) => s.toLowerCase().replaceAll('_', ' ');
function Icon({ name, size = 20 }: {
    name: string;
    size?: number;
}) {
    const paths: Record<string, React.ReactNode> = {
        shield: <><path d="M12 3 3.5 6v5c0 5 8.5 10 8.5 10s8.5-5 8.5-10V6L12 3Z"/><path d="m8 12 3 3 5-6"/></>,
        grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
        doc: <><path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></>,
        arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
        check: <path d="m5 12 4 4L19 6"/>,
        upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></>,
        spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></>,
        clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
        alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.5"/></>,
        search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
        link: <><path d="m10 13 4-4m-6 1-2 2a4 4 0 0 0 6 6l2-2m-4-8 2-2a4 4 0 0 1 6 6l-2 2"/></>,
        close: <path d="m6 6 12 12M6 18 18 6"/>,
        refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>,
        download: <><path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/></>,
    };
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.doc}</svg>;
}
function App() {
    const [config, setConfig] = useState<AppConfig>();
    const [cases, setCases] = useState<DisputeCase[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [tab, setTab] = useState<'evidence' | 'review' | 'response'>('evidence');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [password, setPassword] = useState('');
    const [source, setSource] = useState<{
        evidence: Evidence;
        quote?: string;
    } | null>(null);
    const [draft, setDraft] = useState('');
    const [carrier, setCarrier] = useState('');
    const [tracking, setTracking] = useState('');
    const [approved, setApproved] = useState(false);
    const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
    const [importId, setImportId] = useState('');
    const [showSetup, setShowSetup] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const active = cases.find(c => c.id === selected);
    const locked = !!active && (['pending', 'unknown', 'succeeded'].includes(active.submission?.state || '') || ['pending', 'unknown'].includes(active.messageReceipt?.state || ''));
    const update = (c: DisputeCase) => setCases(current => current.some(x => x.id === c.id) ? current.map(x => x.id === c.id ? c : x) : [...current, c]);
    async function run(label: string, fn: () => Promise<void>) { setBusy(label); setError(''); setNotice(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    finally {
        setBusy('');
    } }
    async function load() { const conf = await api<AppConfig>('/config'); setConfig(conf); if (conf.authenticated)
        setCases(await api<DisputeCase[]>('/cases')); }
    useEffect(() => { load().catch(e => setError(e.message)); }, []);
    useEffect(() => { setDraft(active?.editedDraft || ''); setApproved(false); setAttachmentIds([]); setCarrier(''); setTracking(''); }, [selected]);
    useEffect(() => { if (active)
        setDraft(active.editedDraft); setApproved(false); }, [active?.draftRevision]);
    useEffect(() => { if (!source && !showSetup)
        return; const previousFocus = document.activeElement as HTMLElement | null; const listener = (e: KeyboardEvent) => { if (e.key === 'Tab') { const dialog = document.querySelector('[role=dialog]'); const items = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], textarea:not(:disabled), [tabindex="0"]') || []); const first = items[0], last = items.at(-1); if (first && last && (e.shiftKey ? document.activeElement === first : document.activeElement === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); } } if (e.key === 'Escape') {
        setSource(null);
        setShowSetup(false);
    } }; window.addEventListener('keydown', listener); return () => { window.removeEventListener('keydown', listener); previousFocus?.focus(); }; }, [source, showSetup]);
    const cited = (ref: SourceRef) => { const e = active?.evidence.find(e => e.id === ref.evidenceId); if (e)
        setSource({ evidence: e, quote: ref.quote }); };
    const refs = (sources: SourceRef[]) => <span className="sources">{sources.map((ref, i) => <button key={`${ref.evidenceId}-${i}`} className="source-chip" onClick={() => cited(ref)} title="Inspect supporting quote"><Icon name="link" size={12}/>{active?.evidence.find(e => e.id === ref.evidenceId)?.name || 'Source'}</button>)}</span>;
    async function upload(files: FileList | null) {
        if (!active || !files?.length)
            return;
        await run('Uploading evidence', async () => {
            for (const file of Array.from(files)) {
                if (file.size > 5 * 1024 * 1024)
                    throw new Error(`${file.name} exceeds 5 MB.`);
                const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = () => reject(new Error('Could not read file.')); r.readAsDataURL(file); });
                const c = await api<DisputeCase>(`/cases/${active.id}/evidence`, { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type || (file.name.endsWith('.txt') ? 'text/plain' : ''), base64: data }) });
                update(c);
            }
            setNotice('Evidence saved. Run a new review to include your documents.');
        });
        if (inputRef.current)
            inputRef.current.value = '';
    }
    const analyzed = cases.filter(c => c.analysis).length;
    const attention = cases.filter(c => c.analysis?.missingEvidence.length || c.analysis?.contradictions.length).length;
    const filtered = cases.filter(c => `${c.title} ${c.id} ${c.buyerName}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'reviewed' ? !!c.analysis : !c.analysis)));
    const changed = !!active && draft !== active.editedDraft;
    if (config && !config.authenticated)
        return <main className="login"><div className="login-card"><span className="logo-mark"><Icon name="shield" size={30}/></span><h1>Your evidence.<br />Your workspace.</h1><p>Sign in to Dispute Defender with your team's workspace password.</p><form onSubmit={e => { e.preventDefault(); run('Signing in', async () => { await api('/login', { method: 'POST', body: JSON.stringify({ password }) }); setPassword(''); await load(); }); }}><label>Workspace password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label><button className="primary" disabled={!!busy}>Open workspace <Icon name="arrow"/></button></form>{error && <p role="alert" className="error">{error}</p>}</div></main>;
    return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => { setSelected(null); setShowSetup(false); }}><span className="logo-mark"><Icon name="shield" size={25}/></span><span>dispute<span className="brand-light">defender</span><small>MERCHANT WORKSPACE</small></span></button>
      <div className="workspace"><span className="avatar">S</span><div>Studio merchant<small>{config?.mode === 'sandbox' ? 'PayPal sandbox account' : 'Demo workspace'}</small></div><span className="workspace-dot"/></div>
      <span className="nav-caption">WORKSPACE</span>
      <button className={!selected ? 'nav-item active' : 'nav-item'} onClick={() => setSelected(null)}><Icon name="grid"/>Dispute inbox<span className="nav-count">{cases.length}</span></button>
      <button className="nav-item" onClick={() => setShowSetup(true)}><Icon name="link"/>Connections</button>
      <div className="sidebar-note"><span className="note-icon"><Icon name="shield"/></span><h3>A little more peace of mind.</h3><p>Keep every claim connected to its evidence. You stay in control of every response.</p></div>
      <div className="sidebar-bottom"><span className="live-dot"/><span>{config?.mode === 'sandbox' ? 'Sandbox environment' : 'Synthetic demo data'}</span><small>v0.1 · HACKATHON BUILD</small>{config?.requiresLogin && <button className="text-button" onClick={() => run('Signing out', async () => { await api('/logout', { method: 'POST', body: '{}' }); await load(); })}>Sign out</button>}</div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span><button onClick={() => setSelected(null)}>Disputes</button>{active && <><span>/</span><strong>{active.id}</strong></>}</div><div className="top-right"><span className="environment"><span />{config?.mode === 'sandbox' ? 'PAYPAL SANDBOX' : 'DEMO MODE'}</span><span className="avatar small">SM</span></div></header>
      <main className="content">
        {error && <div className="banner error" role="alert"><Icon name="alert"/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}
        {notice && <div className="banner success" role="status"><Icon name="check"/><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
        {config?.aiProvider === 'demo' && <div className="demo-banner"><Icon name="spark" size={17}/><span><strong>Explore the workflow.</strong> Reviews use a labelled rule-based demo, not an AI model. {config.mode === 'demo' ? 'All cases are synthetic; PayPal submission is disabled.' : 'Connect AI to enable submission.'}</span><button onClick={() => setShowSetup(true)}>Connect services <Icon name="arrow" size={14}/></button></div>}
        {!active ? <>
          <section className="page-heading"><div><div className="eyebrow">LESS ADMIN. MORE CLARITY.</div><h1>Your dispute inbox<span className="title-dot">.</span></h1><p>Bring the facts together. Move each case forward.</p></div><button className="primary" disabled={!!busy} onClick={() => config?.mode === 'sandbox' ? run('Syncing PayPal', async () => { const result = await api<{
            message: string;
        }>('/paypal/sync', { method: 'POST', body: '{}' }); await load(); setNotice(result.message); }) : setShowSetup(true)}><Icon name="refresh" size={17}/>{busy === 'Syncing PayPal' ? 'Syncing…' : 'Sync PayPal'}</button></section>
          <section className="stats" aria-label="Workspace summary"><div className="stat"><span>Cases in workspace<Icon name="doc" size={18}/></span><strong>{cases.length.toString().padStart(2, '0')}</strong><small>Item-not-received workflow</small></div><div className="stat"><span>Evidence reviewed<Icon name="check" size={18}/></span><strong>{analyzed.toString().padStart(2, '0')}</strong><small>Ready for your assessment</small></div><div className="stat"><span>Needs a closer look<Icon name="alert" size={18}/></span><strong>{attention.toString().padStart(2, '0')}</strong><small>Gaps or potential inconsistencies</small></div><div className="stat dark"><span>You have the final say<Icon name="shield" size={21}/></span><h3>Evidence first.<br />Always.</h3><small>No automatic dispute responses.</small></div></section>
          <section className="inbox panel"><div className="panel-toolbar"><div className="filters">{[['all', 'All cases'], ['unreviewed', 'To review'], ['reviewed', 'Reviewed']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}{value === 'all' && <span>{cases.length}</span>}</button>)}</div><label className="search"><Icon name="search" size={17}/><input aria-label="Search disputes" placeholder="Search cases…" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
            <div className="case-table"><div className="table-head"><span>CASE / ORDER</span><span>AMOUNT</span><span>EVIDENCE</span><span>RESPOND BY</span><span /></div>{filtered.map((c, index) => <button className="case-row" key={c.id} onClick={() => { setSelected(c.id); setTab('evidence'); setError(''); setNotice(''); }}><span className="case-main"><span className={`product-icon product-${index % 4}`}><Icon name="doc" size={23}/></span><span><strong>{c.title}</strong><small>{c.id} <i>·</i> {c.buyerName}</small></span></span><span className="amount">{money(c)}</span><span><span className={`pill ${c.submission?.state === 'succeeded' ? 'green' : c.analysis ? ((c.analysis.missingEvidence.length || c.analysis.contradictions.length) ? 'amber' : 'green') : 'neutral'}`}>{c.submission?.state === 'succeeded' ? 'Submitted' : c.analysis ? ((c.analysis.missingEvidence.length || c.analysis.contradictions.length) ? 'Needs evidence' : 'Reviewed') : 'Awaiting review'}</span><small className="document-count">{c.evidence.length} documents</small></span><span className="due-date">{date(c.dueAt)}</span><span className="row-arrow"><Icon name="arrow" size={18}/></span></button>)}</div>
            {!filtered.length && <div className="empty"><Icon name="doc" size={34}/><h3>{query ? 'No matching cases' : 'Your inbox is clear'}</h3><p>{config?.mode === 'sandbox' ? 'Sync PayPal or import a known dispute ID from Connections.' : 'Try another search or filter.'}</p></div>}
            <footer className="table-footer">{filtered.length} case{filtered.length !== 1 ? 's' : ''} <span><Icon name="shield" size={14}/> {config?.mode === 'demo' ? 'Synthetic examples. No real payments.' : 'Sandbox payments only.'}</span></footer>
          </section>
          <div className="how-it-works"><div><span>01</span><strong>Gather the records</strong><p>Order, delivery and conversation.</p></div><div><span>02</span><strong>Connect the facts</strong><p>Review a timeline with source references.</p></div><div><span>03</span><strong>Respond with confidence</strong><p>Edit and approve every response.</p></div></div>
        </> : <>
          <section className="page-heading case-heading"><div><button className="back" onClick={() => setSelected(null)}>← Back to inbox</button><h1>{active.title}</h1><p>{active.id} <span className="separator">/</span> {active.buyerName} <span className="separator">/</span> {money(active)}</p></div>{active.source === 'sandbox' && <button className="secondary" disabled={!!busy || locked} onClick={() => run('Refreshing case', async () => { const c = await api<DisputeCase>('/paypal/import', { method: 'POST', body: JSON.stringify({ id: active.id }) }); update(c); setNotice('PayPal case refreshed. Changed case details may require a new evidence review.'); })}><Icon name="refresh" size={17}/>Refresh PayPal</button>}<a className="secondary" href={`/api/cases/${active.id}/export`}><Icon name="download" size={17}/>Export package</a></section>
          <div className="case-layout"><div className="case-workspace panel"><div className="case-tabs">{(['evidence', 'review', 'response'] as const).map((t, i) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}><span>{i + 1}</span>{t === 'evidence' ? 'Evidence' : t === 'review' ? 'Review & timeline' : 'Response'}</button>)}</div>
            <div className="tab-body">{tab === 'evidence' && <><div className="section-heading"><div><h2>Build a clear picture.</h2><p>Add the records that help explain what happened.</p></div><span className="pill neutral">{active.evidence.length}/10 files</span></div><input ref={inputRef} type="file" className="visually-hidden" aria-label="Upload evidence files" accept=".txt,.pdf,.png,.jpg,.jpeg" multiple onChange={e => upload(e.target.files)}/><button className="dropzone" disabled={!!busy || locked} onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && !locked)
                upload(e.dataTransfer.files); }}><span className="upload-icon"><Icon name="upload" size={25}/></span><strong>Drop your evidence here, or browse</strong><span>TXT, PDF, PNG or JPG · Up to 5 MB each</span></button><p className="helper">Text files are read directly. PDF and images use the configured extraction service or vision model. Check extracted text against the original before approving.</p>
              <div className="evidence-list">{active.evidence.map(e => <div className="evidence-file" key={e.id}><span className="file-icon"><Icon name="doc"/></span><button className="file-name" onClick={() => setSource({ evidence: e })}><strong>{e.name}</strong><small>{(e.size / 1024).toFixed(1)} KB · {e.extractionStatus === 'ready' ? 'Text available' : 'Needs extraction'}</small></button><a className="icon-button" aria-label={`Download ${e.name}`} href={`/api/cases/${active.id}/evidence/${e.id}`}><Icon name="download" size={17}/></a></div>)}</div>
              <div className="bottom-action"><span><Icon name="shield" size={16}/> Originals stay attached to the case.</span><button className="primary" disabled={!!busy || !active.evidence.some(e => e.extractionStatus === 'ready' && e.text.trim()) || locked} onClick={() => run('Reviewing evidence', async () => { const c = await api<DisputeCase>(`/cases/${active.id}/analyze`, { method: 'POST', body: '{}' }); update(c); setTab('review'); })}><Icon name="spark" size={17}/>{busy === 'Reviewing evidence' ? 'Reviewing…' : active.analysis ? 'Run review again' : 'Review evidence'}</button></div></>}
              {tab === 'review' && (!active.analysis ? <div className="empty"><Icon name="spark" size={36}/><h2>Your evidence, connected.</h2><p>Upload documents and run a review to create a timeline and a source-backed draft.</p><button className="primary" onClick={() => setTab('evidence')}>Go to evidence <Icon name="arrow" size={16}/></button></div> : <><div className="section-heading"><div><h2>The story in your records.</h2><p>{active.analysis.provider === 'demo' ? 'Rule-based demo · not an AI result' : 'AI-assisted review · verify every claim'}</p></div><span className="pill green">{active.analysis.timeline.length} events</span></div><div className="review-summary">{active.analysis.summary}</div>
                {active.analysis.missingEvidence.map((gap, i) => <div className={`finding ${gap.severity}`} key={i}><Icon name="alert" size={18}/><div><strong>{gap.title}</strong><p>{gap.detail}</p></div></div>)}{active.analysis.contradictions.map((flag, i) => <div className="finding critical" key={`c${i}`}><Icon name="alert" size={18}/><div><strong>Check these records</strong><p>{flag.detail}</p>{refs(flag.sources)}</div></div>)}
                <h3 className="timeline-title">Case timeline</h3><div className="timeline">{active.analysis.timeline.map((event, i) => <div className="timeline-event" key={i}><span className="timeline-dot"/><small>{event.date}</small><p>{event.event}</p>{refs(event.sources)}</div>)}{!active.analysis.timeline.length && <p className="helper">No dated events extracted. Inspect the source documents.</p>}</div><div className="bottom-action"><span>Check each source before responding.</span><button className="primary" onClick={() => setTab('response')}>Review response <Icon name="arrow" size={17}/></button></div></>)}
              {tab === 'response' && (!active.analysis && !active.canSendMessage ? <div className="empty"><Icon name="doc" size={36}/><h2>A response starts with evidence.</h2><p>Run an evidence review first.</p><button className="primary" onClick={() => setTab('evidence')}>Add evidence</button></div> : <><div className="section-heading"><div><h2>Your response. Your decision.</h2><p>Inspect the supporting quotes, then edit the response below.</p></div></div><details className="draft-sources"><summary>View generated draft with source references</summary>{active.analysis?.draft.map((p, i) => <div key={i}><p>{p.text}</p>{refs(p.sources)}</div>)}{!active.analysis?.draft.length && <p>No supported draft was generated.</p>}</details><label className="field-label">Response to PayPal<textarea className="response-editor" value={draft} disabled={locked || !!busy} onChange={e => { setDraft(e.target.value); setApproved(false); }} placeholder="Review the evidence before writing your response."/></label><div className="editor-footer"><span className={draft.length > 2000 ? 'text-danger' : ''}>{draft.length}/2,000 characters · Edited text needs your verification</span><button className="secondary" disabled={!!busy || !changed || locked || draft.length > 2000} onClick={() => run('Saving draft', async () => { const c = await api<DisputeCase>(`/cases/${active.id}/draft`, { method: 'PUT', body: JSON.stringify({ text: draft, draftRevision: active.draftRevision }) }); update(c); setNotice('Draft saved.'); })}>Save draft</button></div>
                {active.source === 'sandbox' && <div className="submission-form"><h3>Reply to the buyer</h3><p className="helper">Send the saved response as a text-only inquiry message. This does not submit evidence attachments or resolve the dispute.</p>{active.canSendMessage ? <><label className="check-label approval"><input type="checkbox" checked={approved} disabled={locked || changed || !!busy} onChange={e => setApproved(e.target.checked)}/><span>I reviewed the saved response and approve sending it to the buyer through PayPal sandbox.</span></label><button className="primary" disabled={!!busy || locked || changed || !approved || !draft.trim() || draft.length > 2000} onClick={() => run('Sending inquiry message', async () => { try { update(await api<DisputeCase>(`/cases/${active.id}/message`, { method: 'POST', body: JSON.stringify({ approved: true, draftRevision: active.draftRevision }) })); setApproved(false); setNotice('Inquiry message accepted by PayPal sandbox.'); } finally { update(await api<DisputeCase>(`/cases/${active.id}`)); } })}>Send approved inquiry message</button></> : <p>Inquiry messaging is unavailable. Refresh PayPal to check current actions.</p>}{active.messageReceipt && <p role="status"><strong>{active.messageReceipt.state.toUpperCase()}: </strong>{active.messageReceipt.message}</p>}</div>}
                {active.source === 'demo' ? <div className="submission-notice"><Icon name="shield"/><div><strong>This is a demo case.</strong><p>You can edit and export the review package. Nothing will be sent to PayPal.</p></div></div> : <div className="submission-form"><h3>Prepare sandbox submission</h3>{!active.canProvideEvidence && <div className="submission-notice" role="status"><Icon name="clock"/><div><strong>Proof-of-fulfillment submission is unavailable for this case.</strong><p>You can review and export your package now. Use Refresh PayPal to check for a status change. Exporting does not submit a response.</p></div></div>}<p className="helper">This MVP submits proof of fulfillment with tracking details and original attachments. PayPal must currently allow this action.</p><div className="form-grid"><label>Carrier<input value={carrier} onChange={e => { setCarrier(e.target.value); setApproved(false); }} placeholder="e.g. DHL" disabled={locked}/></label><label>Tracking number<input value={tracking} onChange={e => { setTracking(e.target.value); setApproved(false); }} placeholder="Verified tracking number" disabled={locked}/></label></div><p className="field-label">Select original attachments</p>{active.evidence.filter(e => e.mimeType !== 'text/plain').map(e => <label className="check-label" key={e.id}><input type="checkbox" disabled={locked} checked={attachmentIds.includes(e.id)} onChange={() => { setAttachmentIds(ids => ids.includes(e.id) ? ids.filter(id => id !== e.id) : [...ids, e.id]); setApproved(false); }}/>{e.name}</label>)}{!active.evidence.some(e => e.mimeType !== 'text/plain') && <p className="helper">Upload at least one original PDF, PNG or JPEG. Text transcripts cannot be sent as attachments.</p>}<label className="check-label approval"><input type="checkbox" checked={approved} disabled={locked || changed} onChange={e => setApproved(e.target.checked)}/><span>I reviewed this response, tracking details and selected evidence, and approve sending them to PayPal sandbox.</span></label><button className="primary" disabled={!!busy || locked || !approved || changed || !carrier.trim() || !tracking.trim() || !attachmentIds.length || !active.canProvideEvidence || (!active.analysis || active.analysis.provider === 'demo') || !draft.trim() || draft.length > 2000} onClick={() => run('Submitting evidence', async () => { try {
                const c = await api<DisputeCase>(`/cases/${active.id}/submit`, { method: 'POST', body: JSON.stringify({ approved: true, draftRevision: active.draftRevision, evidenceVersion: active.evidenceVersion, evidenceType: 'PROOF_OF_FULFILLMENT', carrier, trackingNumber: tracking, evidenceIds: attachmentIds }) });
                update(c);
                setNotice('Evidence accepted by PayPal sandbox. This is not a dispute outcome.');
            }
            finally {
                update(await api<DisputeCase>(`/cases/${active.id}`));
            } })}>{busy === 'Submitting evidence' ? 'Submitting…' : 'Submit approved evidence'}<Icon name="arrow" size={17}/></button>{!active.canProvideEvidence && <p className="helper">PayPal has not made proof-of-fulfillment submission available for this case.</p>}</div>}
                {active.submission && <div className={`banner ${active.submission.state === 'succeeded' ? 'success' : 'error'}`} role="status"><Icon name="doc"/><div><strong>{active.submission.state.toUpperCase()}</strong><p>{active.submission.message}</p>{active.submission.debugId && <small>PayPal debug ID: {active.submission.debugId}</small>}</div></div>}</>)}
            </div>
          </div><aside className="case-aside"><div className="panel case-overview"><span className="eyebrow">CASE AT A GLANCE</span><h3>Item not received</h3><dl><dt>Amount disputed</dt><dd className="large-amount">{money(active)}</dd><dt>PayPal status</dt><dd className="capitalize">{readable(active.status)}</dd><dt>Respond by</dt><dd>{date(active.dueAt)}</dd><dt>Transaction reference</dt><dd className="mono">{active.transactionId || 'Not provided'}</dd><dt>Source</dt><dd>{active.source === 'demo' ? 'Synthetic demo fixture' : 'PayPal sandbox API'}</dd></dl></div><div className="buyer-note"><span className="eyebrow">BUYER'S MESSAGE</span><p>“{active.buyerNote}”</p><small>Buyer statement · not verified fact</small></div><div className="review-tip"><Icon name="shield"/><p><strong>Traceable, not infallible.</strong> Source checks confirm quotes appear in records. Review whether those records support each claim.</p></div></aside></div>
        </>}
        <footer className="page-footer"><span>Dispute Defender</span><span>Built for the people behind small businesses.</span></footer>
      </main>
    </div>
    {busy && <div className="busy-toast" role="status"><span className="spinner"/>{busy}…</div>}
    {source && <div className="modal-backdrop" onClick={() => setSource(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="source-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">SOURCE DOCUMENT</span><h2 id="source-title">{source.evidence.name}</h2></div><button autoFocus className="icon-button" aria-label="Close source" onClick={() => setSource(null)}><Icon name="close"/></button></div><p className="helper">Extracted text can contain recognition errors. Compare dates, amounts and tracking IDs with the original document.</p>{source.quote && <blockquote>{source.quote}</blockquote>}<pre className="source-text">{source.evidence.text || 'This original has not been read successfully. Configure extraction and re-upload a readable copy, or add a text transcript.'}</pre></section></div>}
    {showSetup && <div className="modal-backdrop" onClick={() => setShowSetup(false)}><section className="modal setup" role="dialog" aria-modal="true" aria-labelledby="setup-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">WORKSPACE CONNECTIONS</span><h2 id="setup-title">Connect your workflow.</h2></div><button autoFocus className="icon-button" aria-label="Close connections" onClick={() => setShowSetup(false)}><Icon name="close"/></button></div><div className="connection"><Icon name="link"/><div><strong>PayPal sandbox</strong><p>{config?.paypalConfigured ? 'Credentials configured on the server. Sync to test access.' : 'Server credentials are not configured.'}</p></div><span className="pill neutral">{config?.mode}</span></div><div className="connection"><Icon name="spark"/><div><strong>Evidence intelligence</strong><p>{config?.aiProvider === 'demo' ? 'Rule-based baseline. Connect the team AI service or an LLM endpoint.' : `${config?.aiProvider} provider selected. Run a review to test it.`}</p></div></div><p className="helper">Your developer can configure the server using <code>.env.example</code>. Secrets never belong in the browser. This build is a single-merchant workspace.</p>{config?.mode === 'sandbox' && <form onSubmit={e => { e.preventDefault(); run('Importing dispute', async () => { const c = await api<DisputeCase>('/paypal/import', { method: 'POST', body: JSON.stringify({ id: importId }) }); update(c); setSelected(c.id); setShowSetup(false); setTab('evidence'); }); }}><label>Import a known sandbox dispute<input value={importId} onChange={e => setImportId(e.target.value)} placeholder="PP-D-…" required pattern="[A-Za-z0-9-]+"/></label><button className="primary" disabled={!!busy}>Import case <Icon name="arrow" size={17}/></button></form>}<div className="setup-note">Sandbox actions use test payments only. Demo fixtures and sandbox cases are stored separately.</div></section></div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
