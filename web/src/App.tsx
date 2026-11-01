import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { PartyItem, PartyRsvpStatus } from '../../src/lib/partyTypes';
import { api, type WebParty as Party, type WebEditorDraft } from './api';
import { includePendingItem, partyMapLinks } from './editorDraft';
import Account from './Account';
import { AppearanceControls, AppearancePoster, AppearanceThumbnail } from './PartyAppearance';
import { normalizeAppearance } from './appearance';
import { preparePartyPhoto, storeDraftPhoto, loadDraftPhoto, removeDraftPhoto } from './draftMedia';
import './styles.css';
type Session = Awaited<ReturnType<typeof api.getSession>>;
type Lists = {
    hosting: Party[];
    joined: Party[];
};
const emptyLists: Lists = { hosting: [], joined: [] };
const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
const statusLabel = { yes: 'Going', maybe: 'Maybe', no: 'Not going' };
const dateLabel = (date?: string) => {
    if (!date)
        return 'Date to be decided';
    const parsed = new Date(date.length === 10 ? `${date}T12:00:00` : date);
    return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', weekday: 'short', ...(date.length > 10 ? { hour: 'numeric', minute: '2-digit' } as const : {}) }).format(parsed);
};
const dateInput = (value?: string) => {
    if (!value)
        return '';
    if (value.length === 10)
        return `${value}T12:00`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};
const paletteIndex = (id: string) => Array.from(id).reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0) % 3;
const paletteFor = (id = 'partyplus') => ['tone-cobalt', 'tone-persimmon', 'tone-sunshine'][paletteIndex(id)];
const calendarParts = (date?: string) => {
    const parsed = date ? new Date(date.length === 10 ? `${date}T12:00:00` : date) : null;
    if (!parsed || Number.isNaN(parsed.getTime()))
        return { month: 'DATE', day: '—', weekday: 'TO COME' };
    return { month: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(parsed).toUpperCase(), day: String(parsed.getDate()).padStart(2, '0'), weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(parsed).toUpperCase() };
};
const timeLabel = (date?: string) => {
    if (!date || date.length <= 10 || Number.isNaN(Date.parse(date)))
        return '';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
};
function GatheringArt({ variant = 0 }: {
    variant?: number;
}) {
    return <svg className={`gathering-art art-${variant}`} viewBox="0 0 320 320" fill="none" aria-hidden="true">
    {variant === 0 ? <><path d="M157 57 177 106 224 82 213 134 267 143 225 177 260 219 205 217 204 272 165 235 130 277 122 223 68 239 94 191 45 168 97 150 77 99 128 118Z" fill="currentColor"/><circle cx="157" cy="168" r="43" fill="var(--poster-bg)"/><path d="m280 55-22 19m35 9-27 1M65 274l18-20" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></> : variant === 1 ? <><path d="M160 272V141m0 80c-66 0-105-33-105-77 59 0 99 21 105 63m0 19c61 0 104-30 104-70-57 0-99 15-104 55" stroke="currentColor" strokeWidth="15"/><path d="M160 143c-61-2-83-60-51-88 25-22 51 13 51 13s29-37 55-12c31 30 1 84-55 87Z" fill="currentColor"/><path d="m42 70 7 14m216 178 15-8" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></> : <><circle cx="159" cy="161" r="79" stroke="currentColor" strokeWidth="24"/><path d="M158 27v28m0 214v28M26 160h29m211 0h28M65 67l20 20m150 149 20 20M66 253l20-20M235 86l20-20" stroke="currentColor" strokeWidth="15" strokeLinecap="round"/><circle cx="137" cy="148" r="6" fill="currentColor"/><circle cx="180" cy="148" r="6" fill="currentColor"/><path d="M128 181c17 22 42 22 61 0" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/></>}
  </svg>;
}
function InvitationPoster({ party, preview = false, host = false, photoUrl }: {
    party: Partial<Party>;
    preview?: boolean;
    host?: boolean;
    photoUrl?: string;
}) {
    return <AppearancePoster party={party} preview={preview} host={host} photoUrl={photoUrl || api.partyPhotoUrl(normalizeAppearance(party.appearance).image?.id)}/>;
}
function Icon({ name, size = 20 }: {
    name: string;
    size?: number;
}) {
    const paths: Record<string, ReactNode> = {
        external: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>, chevron: <path d="m6 9 6 6 6-6"/>, copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/></>, plus: <path d="M12 5v14M5 12h14"/>, arrow: <path d="m9 5 7 7-7 7M4 12h12"/>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></>,
        pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
        people: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/></>,
        grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
        check: <path d="m5 12 4 4L19 6"/>, share: <><path d="M12 16V3m-5 5 5-5 5 5M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/></>,
        back: <path d="m12 5-7 7 7 7M5 12h15"/>, sparkle: <><path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z"/></>,
    };
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.sparkle}</svg>;
}
function Notice({ children, kind = 'info' }: {
    children: ReactNode;
    kind?: string;
}) { return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>; }
export default function App() {
    const [path, setPath] = useState(location.pathname + location.search);
    const [session, setSession] = useState<Session>(null);
    const [lists, setLists] = useState<Lists>(emptyLists);
    const [booting, setBooting] = useState(true);
    const [listError, setListError] = useState('');
    const [toast, setToast] = useState('');
    const heading = useRef<HTMLElement>(null);
    const navigate = (to: string) => { history.pushState({}, '', to); setPath(to); window.scrollTo(0, 0); };
    const refresh = async () => { const current = await api.getSession(); setSession(current); try {
        const next = current ? await api.listParties() : emptyLists;
        setLists(next);
        setListError('');
        if (current && !current.isAnonymous) void api.retryPhotoCleanup().catch(() => {});
        if ((next.hosting.length || next.joined.length) && !sessionStorage.getItem('partyplus.returning-use')) {
            sessionStorage.setItem('partyplus.returning-use', '1');
            void api.track('returning_use');
        }
    }
    catch (e) {
        setListError(message(e));
    } return current; };
    useEffect(() => { const pop = () => setPath(location.pathname + location.search); window.addEventListener('popstate', pop); refresh().catch(e => setListError(message(e))).finally(() => setBooting(false)); return () => window.removeEventListener('popstate', pop); }, []);
    useEffect(() => { heading.current?.focus(); }, [path]);
    useEffect(() => { if (!toast)
        return; const timer = window.setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
    const partyMatch = path.match(/^\/(?:i|party)\/([^/?]+)/);
    const legacyInvite = /^\/(?:share|_share|__share)(?:\?|$)/.test(path) ? new URLSearchParams(path.split('?')[1]).get('id') || '' : '';
    let partyId = legacyInvite;
    try {
        if (partyMatch)
            partyId = decodeURIComponent(partyMatch[1]);
    }
    catch {
        partyId = '';
    }
    const creating = path.split('?')[0] === '/create';
    const account = path.split('?')[0] === '/account';
    const infoPage = ['support', 'privacy', 'terms'].includes(path.slice(1).split('?')[0]) ? path.slice(1).split('?')[0] : '';
    const known = partyId || creating || account || infoPage || path.split('?')[0] === '/';
    const Link = ({ to, children, className = '' }: {
        to: string;
        children: ReactNode;
        className?: string;
    }) => <a href={to} className={className} aria-current={(to === '/' ? path === '/' : path.startsWith(to)) ? 'page' : undefined} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        navigate(to);
    } }}>{children}</a>;
    return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <Link to="/" className="brand"><img className="brand-icon" src="/assets/brand/partyplus-icon.png" alt="" width="56" height="56" decoding="async"/><span className="brand-copy"><span className="brand-word">PartyPlus</span><span className="brand-caption">Party planning, made simple</span></span></Link>
      <nav className="primary-nav" aria-label="Main navigation"><Link to="/" className={`nav-link ${!account && !creating && !partyId && !infoPage ? 'active' : ''}`}><Icon name="grid" size={18}/><span>My parties</span></Link><Link to="/create" className={`nav-link ${creating ? 'active' : ''}`}><Icon name="plus" size={19}/><span>Create a party</span></Link></nav>
      <div className="header-account">{api.config.environment !== 'production' && <span className="environment-tag">{api.config.environment}</span>}<Link to="/account" className={`account-nav ${account ? 'active' : ''}`}><span className="avatar">{session?.email?.slice(0, 1).toUpperCase() || <Icon name="people" size={18}/>}</span><span>{session && !session.isAnonymous ? 'Account' : 'Sign in'}</span><Icon name="arrow" size={16}/></Link></div>
    </div></header>
    <div className="main-wrap">
      <main id="main" ref={heading} tabIndex={-1}>
        {booting ? <Loading /> : infoPage ? <InfoPage page={infoPage} navigate={navigate}/> : account ? <Account session={session} refresh={refresh} navigate={navigate} notify={setToast}/> : creating ? <Editor session={session} navigate={navigate} onSaved={refresh} notify={setToast}/> : partyId ? <PartyPage key={partyId} id={partyId} session={session} refresh={refresh} joined={lists.joined.some(p => p.id === partyId)} navigate={navigate} notify={setToast} editing={path.includes('edit=1')} isInvitation={Boolean(legacyInvite || path.startsWith('/i/'))}/> : !known ? <div className="empty panel"><h1>This page wandered off.</h1><p>Your next gathering is still waiting.</p><Link to="/" className="button primary">Back to my parties</Link></div> : <Dashboard lists={lists} error={listError} retry={() => refresh().catch(e => setListError(message(e)))} navigate={navigate} session={session}/>}
      </main>
      <footer className="site-footer"><div><span className="footer-wordmark"><img src="/assets/brand/partyplus-icon.png" alt="" width="34" height="34" loading="lazy" decoding="async"/>PartyPlus</span><p>Anyone with the invitation link can view party details.<br />Works in your browser. No app download.</p></div><div className="footer-right"><span className="footer-motto">Party planning, made simple</span><nav aria-label="Information"><Link to="/support">Support</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></nav></div></footer>
    </div>
    {toast && <div className="toast" role="status"><span className="toast-check"><Icon name="check"/></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
  </div>;
}
function Loading() { return <div className="loading panel" role="status"><span className="loader"/><h2>Getting things ready…</h2><p>Your next get-together is on its way.</p></div>; }
function Dashboard({ lists, error, retry, navigate, session }: {
    lists: Lists;
    error: string;
    retry: () => void;
    navigate: (p: string) => void;
    session: Session;
}) {
    const [tab, setTab] = useState<'hosting' | 'joined'>(lists.hosting.length === 0 && lists.joined.length > 0 ? 'joined' : 'hosting');
    const [query, setQuery] = useState('');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const isPast = (party: Party) => Boolean(party.date && !Number.isNaN(Date.parse(party.date)) && Date.parse(party.date) < now.getTime());
    const sortParties = (a: Party, b: Party) => (a.date ? Date.parse(a.date) : Infinity) - (b.date ? Date.parse(b.date) : Infinity);
    const parties = lists[tab].filter(party => `${party.title} ${party.location || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
    const upcoming = parties.filter(party => !isPast(party)).sort(sortParties);
    const past = parties.filter(isPast).sort(sortParties).reverse();
    const all = [...lists.hosting, ...lists.joined];
    const next = all.filter(party => !isPast(party)).sort(sortParties)[0];
    const hasAny = all.length > 0;
    const renderTicket = (party: Party) => {
        const calendar = calendarParts(party.date);
        const claimed = party.items.filter(item => item.claimedBy || item.claimedByUserId).length;
        const response = party.ownRsvp;
        return <button className={`party-ticket ${paletteFor(party.id)}`} key={party.id} onClick={() => navigate(`/party/${encodeURIComponent(party.id)}`)}>
      <span className="ticket-date"><span>{calendar.month}</span><strong>{calendar.day}</strong><small>{calendar.weekday}</small></span>
      <span className="ticket-content"><span className="ticket-kicker">{tab === 'hosting' ? 'HOSTED BY YOU' : response ? statusLabel[response.status].toUpperCase() : 'YOU’RE INVITED'}{party.theme && <span> / {party.theme}</span>}</span><strong className="ticket-title">{party.title}</strong><span className="ticket-location"><Icon name="pin" size={17}/>{party.location || 'Location to be decided'}</span><span className="ticket-meta">{party.date && timeLabel(party.date) && <span>{timeLabel(party.date)}</span>}<span>{claimed}/{party.items.length} items claimed</span>{party.cloudStatus && party.cloudStatus !== 'committed' && <span className="pending-tag">Needs sync</span>}</span></span>
      <span className="ticket-end ticket-appearance"><AppearanceThumbnail appearance={party.appearance} photoUrl={api.partyPhotoUrl(normalizeAppearance(party.appearance).image?.id)} partyId={party.id}/><span className="ticket-open"><span>Open party</span><Icon name="arrow"/></span></span>
    </button>;
    };
    return <>
    {session?.isAnonymous && lists.joined.length > 0 && <Notice>Your guest access is saved in this browser. Verify your email to return on another device. <button className="text-button" onClick={() => navigate('/account')}>Keep my parties with me <Icon name="arrow" size={16}/></button></Notice>}
    <section className="dashboard-intro"><div><span className="eyebrow">GOOD COMPANY STARTS HERE</span><h1>My parties<span className="editorial-dot">.</span></h1><p>{hasAny ? 'Your plans, your people. All in one good place.' : 'Give your people something to look forward to.'}</p></div><button className="button primary new-party-button" onClick={() => navigate('/create')}><Icon name="plus"/>Create a party</button></section>
    <section className={`dashboard-feature dashboard-brand-feature ${next ? paletteFor(next.id) : 'tone-cobalt'}`}>
      <div className="feature-copy"><span className="eyebrow">{next ? 'NEXT ON YOUR CALENDAR' : 'AN EXCUSE TO GET TOGETHER'}</span><h2>{next ? next.title : <>Less back &amp; forth.<br /><em>More see you there.</em></>}</h2><p>{next ? dateLabel(next.date) : 'Make the plan. Share one invitation. Make it easy for guests to pitch in.'}</p><button className="button paper" onClick={() => navigate(next ? `/party/${encodeURIComponent(next.id)}` : '/create')}>{next ? 'Open invitation' : 'Make your first plan'}<Icon name="arrow"/></button></div>
      <figure className={`brand-banner-panel ${next ? 'next-party-appearance' : ''}`}>{next ? <AppearanceThumbnail appearance={next.appearance} photoUrl={api.partyPhotoUrl(normalizeAppearance(next.appearance).image?.id)} partyId={next.id}/> : <img className="brand-banner-image" src="/assets/brand/partyplus-banner.jpg" srcSet="/assets/brand/partyplus-banner-small.jpg 768w, /assets/brand/partyplus-banner.jpg 1440w" sizes="(max-width: 640px) calc(100vw - 92px), (max-width: 900px) 44vw, (max-width: 1360px) 40vw, 555px" alt="Original PartyPlus celebration banner" width="1440" height="697" decoding="async"/>}<figcaption><span>Party planning, made simple</span><span className="banner-confetti" aria-hidden="true"><i/><i/><i/></span></figcaption></figure>
    </section>
    <section className="parties-section" aria-label="Your saved parties"><div className="list-toolbar"><div className="tabs" role="tablist" aria-label="Party lists"><button id="hosting-tab" role="tab" aria-selected={tab === 'hosting'} aria-controls="party-list" className={tab === 'hosting' ? 'selected' : ''} onClick={() => setTab('hosting')}>Hosting <span>{lists.hosting.length}</span></button><button id="joined-tab" role="tab" aria-selected={tab === 'joined'} aria-controls="party-list" className={tab === 'joined' ? 'selected' : ''} onClick={() => setTab('joined')}>Joined <span>{lists.joined.length}</span></button></div>{lists[tab].length > 2 && <label className="party-search"><Icon name="search" size={18}/><span className="sr-only">Find a party</span><input type="search" placeholder="Find a party" value={query} onChange={e => setQuery(e.target.value)}/></label>}</div>
      {error && <Notice kind="error">{error} <button className="text-button" onClick={retry}>Try again</button></Notice>}
      <div id="party-list" role="tabpanel" aria-labelledby={`${tab}-tab`}>
        {upcoming.length > 0 && <><div className="list-section-label"><h2>Coming up</h2><span>{upcoming.length} {upcoming.length === 1 ? 'gathering' : 'gatherings'}</span></div><div className="ticket-list">{upcoming.map(renderTicket)}</div></>}
        {past.length > 0 && <details className="past-parties" open={!upcoming.length}><summary><span>Good times past</span><span>{past.length}<Icon name="chevron" size={18}/></span></summary><div className="ticket-list">{past.map(renderTicket)}</div></details>}
        {!parties.length && !error && <div className="empty panel"><div className="empty-art" aria-hidden="true"><GatheringArt variant={tab === 'hosting' ? 1 : 0}/></div><span className="eyebrow">{query ? 'LET’S TRY AGAIN' : tab === 'hosting' ? 'THE FIRST OF MANY' : 'YOU BELONG HERE'}</span><h2>{query ? 'No plans by that name.' : tab === 'hosting' ? 'Start with a date. Or just an idea.' : 'An invitation is all it takes.'}</h2><p>{query ? 'Try another party name or location.' : tab === 'hosting' ? 'Birthday dinner, backyard potluck, a very ordinary Tuesday. There’s always a reason.' : 'Open an invitation link and save the party. Your joined gatherings will be right here.'}</p>{query ? <button className="button outline" onClick={() => setQuery('')}>Clear search</button> : tab === 'hosting' ? <button className="button primary" onClick={() => navigate('/create')}>Create a party<Icon name="plus"/></button> : !session ? <button className="button outline" onClick={() => navigate('/account')}>Sign in to find your parties<Icon name="arrow"/></button> : null}</div>}
      </div>
    </section>
    <div className="editorial-note"><span aria-hidden="true">✳</span><p>A good host doesn’t have to do it all.<br /><strong>Make a list. Make room for everyone.</strong></p><span className="note-rule"/></div>
  </>;
}
function Editor({ session, navigate, onSaved, original, notify }: {
    session: Session;
    navigate: (p: string) => void;
    onSaved: () => Promise<unknown>;
    original?: Party;
    notify: (text: string) => void;
}) {
    const [draft, setDraft] = useState<WebEditorDraft>(() => {
        const stored = api.loadDraft();
        if (original)
            return stored?.id === original.id && stored.revision === original.revision ? stored : { ...original, items: [...original.items] };
        return stored && !stored.revision && !stored.canEdit ? stored : { id: crypto.randomUUID(), title: '', date: '', location: '', notes: '', theme: '', items: [], createdAt: new Date().toISOString() };
    });
    const [previewOpen, setPreviewOpen] = useState(() => window.matchMedia('(min-width: 980px)').matches);
    const draftRef = useRef(draft);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [photoBusy, setPhotoBusy] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [photoPreview, setPhotoPreview] = useState<string>();
    const photoSelection = useRef(0);
    const photoId = normalizeAppearance(draft.appearance).image?.id;
    useEffect(() => {
        let active = true; let objectUrl: string | undefined;
        setPhotoPreview(undefined);
        if (draft.id && photoId) void loadDraftPhoto(draft.id, photoId).then(blob => {
            if (blob && active) { objectUrl = URL.createObjectURL(blob); setPhotoPreview(objectUrl); }
        }).catch(() => { if (active) setPhotoError('This browser could not recover the photo draft. Choose the photo again if its preview is missing.'); });
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [draft.id, photoId]);
    useEffect(() => { api.storeDraft(draft); }, [draft]);
    const changeDraft = (build: (current: WebEditorDraft) => WebEditorDraft) => { const next = build(draftRef.current); api.storeDraft(next); draftRef.current = next; setDraft(next); return next; };
    const update = (field: keyof WebEditorDraft, value: unknown) => changeDraft(d => ({ ...d, [field]: value, ...(field === 'pendingItemName' && value && !d.pendingItemId ? { pendingItemId: crypto.randomUUID() } : {}) }));
    const addItem = () => changeDraft(d => includePendingItem(d, () => crypto.randomUUID()));
    const removeItem = (item: PartyItem) => changeDraft(d => ({ ...d, items: d.items?.filter(i => i.id !== item.id), removedItemIds: original?.items.some(i => i.id === item.id) ? [...(d.removedItemIds || []), item.id] : d.removedItemIds }));
    const selectPhoto = async (file: File) => {
        const selection = ++photoSelection.current; setPhotoBusy(true); setPhotoError('');
        try {
            const blob = await preparePartyPhoto(file);
            if (selection !== photoSelection.current) return;
            const imageId = crypto.randomUUID(); const partyId = draftRef.current.id!;
            await storeDraftPhoto(partyId, imageId, blob);
            const previousId = normalizeAppearance(draftRef.current.appearance).image?.id;
            changeDraft(d => ({ ...d, appearance: { ...normalizeAppearance(d.appearance), layout: 'photo', image: { id: imageId, positionX: 50, positionY: 50, zoom: 1 } } }));
            setPreviewOpen(true);
            if (previousId && previousId !== original?.appearance?.image?.id) void removeDraftPhoto(partyId, previousId).catch(() => {});
        } catch (e) { if (selection === photoSelection.current) setPhotoError(message(e)); }
        finally { if (selection === photoSelection.current) setPhotoBusy(false); }
    };
    const removePhoto = () => {
        const oldId = normalizeAppearance(draftRef.current.appearance).image?.id;
        changeDraft(d => ({ ...d, appearance: { ...normalizeAppearance(d.appearance), image: undefined, ...(d.appearance?.layout === 'photo' ? { layout: 'illustrated' as const } : {}) } }));
        setPhotoError('');
        if (oldId && draft.id) void removeDraftPhoto(draft.id, oldId).catch(() => {});
    };
    const submit = async (e: FormEvent) => { e.preventDefault(); setError(''); if (photoBusy) { setError('Wait for your photo to finish preparing before saving.'); return; } if (draftRef.current.pendingItemQty?.trim() && !draftRef.current.pendingItemName?.trim()) {
        setError('Enter an item name for that quantity, or clear the quantity before saving.');
        return;
    } const prepared = changeDraft(d => includePendingItem(d, () => crypto.randomUUID())); if (!session || session.isAnonymous) {
        navigate('/account?next=' + encodeURIComponent(original ? `/party/${original.id}?edit=1` : '/create'));
        return;
    } setBusy(true); try {
        const now = new Date().toISOString();
        const { pendingItemName, pendingItemQty, pendingItemId, ...fields } = prepared;
        const imageId = normalizeAppearance(fields.appearance).image?.id;
        if (imageId) {
            const localPhoto = await loadDraftPhoto(fields.id!, imageId);
            if (localPhoto) await api.uploadPartyPhoto(fields.id!, imageId, localPhoto);
        }
        const saved = await api.saveParty({ ...fields, id: fields.id || crypto.randomUUID(), title: fields.title!.trim(), items: fields.items || [], createdAt: fields.createdAt || now, updatedAt: now } as Party);
        api.clearDraft();
        if (imageId) void removeDraftPhoto(saved.id, imageId).catch(() => {});
        let cleanupPending = false;
        try { cleanupPending = (await api.finalizePartyPhotos(saved.id, imageId, normalizeAppearance(original?.appearance).image?.id)) > 0; }
        catch { cleanupPending = true; }
        await onSaved();
        navigate(`/party/${saved.id}`);
        if (cleanupPending) notify('Party saved. Older photo cleanup will retry next time you return.');
    }
    catch (e) {
        setError(message(e));
    }
    finally {
        setBusy(false);
    } };
    return <><button className="back-link" onClick={() => navigate(original ? `/party/${original.id}` : '/')}><Icon name="back" size={17}/>{original ? 'Back to party' : 'My parties'}</button><div className="page-heading"><span className="eyebrow">{original ? 'THE DETAILS MATTER' : 'LET’S MAKE SOMETHING HAPPEN'}</span><h1>{original ? 'A little change. A better plan.' : <>An excuse to<br /><em>get together.</em></>}</h1><p>{original ? 'Your guests see the details you save. Keep everyone in the loop.' : 'Start with the occasion. The good company will follow.'}</p></div>
    {!session || session.isAnonymous ? <Notice>Your draft is saved in this browser. Verify your email to host a party. <button className="text-button" onClick={() => navigate('/account?next=%2Fcreate')}>Sign in to host <Icon name="arrow" size={16}/></button></Notice> : null}
    <form onSubmit={submit} className="editor-layout"><div className="editor-main"><section className="panel form-panel"><div className="form-section-title"><span className="step-number">01</span><h2>The occasion</h2></div><label>Party name <span className="required">*</span><input required maxLength={120} placeholder="e.g. Sunday supper at ours" value={draft.title || ''} onChange={e => update('title', e.target.value)}/></label><div className="field-row"><label>Date &amp; time<input type="datetime-local" value={dateInput(draft.date)} onInput={e => update('date', e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '')} onChange={e => update('date', e.target.value ? new Date(e.target.value).toISOString() : '')}/></label><label>Party vibe<input maxLength={80} placeholder="Cozy, casual, all-out…" value={draft.theme || ''} onChange={e => update('theme', e.target.value)}/></label></div></section><section className="panel form-panel"><div className="form-section-title"><span className="step-number">02</span><h2>A place. A little context.</h2></div><label>Location<input maxLength={300} placeholder="An address or a place everyone knows" value={draft.location || ''} onChange={e => update('location', e.target.value)}/></label><label>A note for your guests<textarea rows={4} maxLength={4000} placeholder="What should everyone know? Add a time, directions, or a little inspiration." value={draft.notes || ''} onChange={e => update('notes', e.target.value)}/></label></section>
      <section className="panel form-panel"><div className="form-section-title"><span className="step-number">03</span><h2>The bring-along list</h2></div><p className="muted">Give guests a few ideas for what to bring. You can add more later.</p><div className="add-item-row"><label className="grow">Item<input value={draft.pendingItemName || ''} maxLength={120} placeholder="A big green salad" onChange={e => update('pendingItemName', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') {
        e.preventDefault();
        addItem();
    } }}/></label><label className="quantity-field">Quantity<input value={draft.pendingItemQty || ''} maxLength={60} placeholder="Serves 6" onChange={e => update('pendingItemQty', e.target.value)}/></label><button type="button" className="button secondary add-item-button" aria-label="Add item" onClick={addItem} disabled={!draft.pendingItemName?.trim()}><Icon name="plus"/><span>Add item</span></button></div>{draft.pendingItemName?.trim() && <p className="pending-item-note"><Icon name="check" size={16}/>This item is ready to add. Save your party to include it, or select Add item to keep building your list.</p>}<ul className="edit-items">{draft.items?.map(item => <li key={item.id}><span><strong>{item.name}</strong>{item.qty && <small>{item.qty}</small>}{item.claimedBy && <small>Being brought by {item.claimedBy}</small>}</span>{item.claimedBy || item.claimedByUserId ? <span className="badge subtle">CLAIMED</span> : <button type="button" className="remove-button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item)}>Remove</button>}</li>)}</ul>{!draft.items?.length && <p className="list-placeholder">A drink, a dish, a little something to share.</p>}</section>
      <section className="panel form-panel appearance-panel"><div className="form-section-title"><span className="step-number">04</span><h2>Party appearance</h2><span className="badge subtle">OPTIONAL</span></div><p className="muted">Keep the PartyPlus original, or choose a look that feels like your gathering.</p><AppearanceControls value={draft.appearance} onChange={appearance => { update('appearance', appearance); setPreviewOpen(true); }} photoUrl={photoPreview || api.partyPhotoUrl(photoId)} onPhotoSelected={file => { void selectPhoto(file); }} onPhotoRemoved={removePhoto} uploadBusy={photoBusy || busy} uploadError={photoError}/><button type="button" className="text-button" onClick={() => { setPreviewOpen(true); requestAnimationFrame(() => document.getElementById('live-invitation-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>See invitation preview<Icon name="arrow" size={17}/></button></section>
      {error && <Notice kind="error">{error}</Notice>}{draft.id && api.hasPending(draft.id) && <Notice kind="warning">Your change is saved in this browser and still needs confirmation. <button className="text-button" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try {
        await api.retry(draft.id!);
        const latest = await api.readParty(draft.id!);
        if (!latest)
            throw Error('The saved party could not be reloaded. Your draft is preserved.');
        api.storeDraft({ ...draft, revision: latest.revision, canEdit: latest.canEdit, hostId: latest.hostId, updatedAt: latest.updatedAt });
        await onSaved();
        navigate('/party/' + draft.id + '?edit=1');
    }
    catch (e) {
        setError(message(e));
    }
    finally {
        setBusy(false);
    } }}>Retry saved change</button></Notice>}<div className="form-actions"><span>{original ? 'Changes are shared with your guests.' : 'Draft saved in this browser'}</span><button className="button primary" type="submit" disabled={busy || photoBusy || !draft.title?.trim()}>{busy ? 'Saving…' : photoBusy ? 'Preparing photo…' : original ? 'Save changes' : session && !session.isAnonymous ? 'Create party' : 'Sign in & create'}<Icon name="arrow" size={17}/></button></div></div>
      <aside className="editor-preview"><div className="preview-heading"><span className="eyebrow">A PEEK AT YOUR PLANS</span><button type="button" className="preview-toggle" aria-expanded={previewOpen} aria-controls="live-invitation-preview" onClick={() => setPreviewOpen(value => !value)}><span>Live invitation preview</span><Icon name="chevron" size={18}/></button></div>{previewOpen && <div id="live-invitation-preview"><InvitationPoster party={draft} preview photoUrl={photoPreview}/><div className="preview-receipt"><span><Icon name="calendar" size={17}/>{dateLabel(draft.date)}</span><span><Icon name="pin" size={17}/>{draft.location || 'Your place goes here'}</span><span><Icon name="check" size={17}/>{(draft.items?.length || 0) + (draft.pendingItemName?.trim() ? 1 : 0)} things to bring</span></div><p className="preview-fineprint">Save your party to get one invitation link. Your guests can RSVP and choose what to bring right in their browser.</p><span className="preview-stamp">GOOD COMPANY<br />IS THE WHOLE POINT.</span></div>}</aside></form>
  </>;
}
function PartyPage({ id, session, refresh, joined, navigate, notify, editing, isInvitation }: {
    id: string;
    session: Session;
    refresh: () => Promise<Session>;
    joined: boolean;
    navigate: (p: string) => void;
    notify: (s: string) => void;
    editing: boolean;
    isInvitation: boolean;
}) {
    const [party, setParty] = useState<Party | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [didJoin, setDidJoin] = useState(joined);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [name, setName] = useState('');
    const [status, setStatus] = useState<PartyRsvpStatus>('yes');
    const [count, setCount] = useState(1);
    const [suggestion, setSuggestion] = useState('');
    const [rsvpSaved, setRsvpSaved] = useState(false);
    const [shareOptions, setShareOptions] = useState(false);
    const invitationUrl = `${location.origin}/i/${encodeURIComponent(id)}`;
    const invitationMessage = `You're invited${party?.title ? ` to ${party.title}` : ''}! Open the invitation in your browser: ${invitationUrl}`;
    const mine = party?.ownRsvp ?? party?.rsvps?.find(r => r.id === session?.id);
    const load = async () => { setLoading(true); setError(''); try {
        const p = await api.readParty(id);
        setParty(p);
        if (p?.isJoined)
            setDidJoin(true);
        const me = p?.ownRsvp ?? p?.rsvps?.find(r => r.id === session?.id);
        if (me) {
            setName(me.name);
            setStatus(me.status);
            setCount(me.attendeeCount);
            setRsvpSaved(true);
        }
    }
    catch (e) {
        setError(message(e));
    }
    finally {
        setLoading(false);
    } };
    useEffect(() => { void load(); if (isInvitation)
        void api.track('invitation_opened', id).catch(() => { }); }, [id]);
    const refreshParty = async () => { const latest = await api.readParty(id); setParty(latest); };
    useEffect(() => { const onVisible = () => { if (document.visibilityState === 'visible')
        void refreshParty().catch(() => { }); }; document.addEventListener('visibilitychange', onVisible); return () => document.removeEventListener('visibilitychange', onVisible); }, [id]);
    const act = async (key: string, fn: () => Promise<void>) => { setError(''); setBusy(key); try {
        await fn();
    }
    catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError'))
            setError(message(e));
    }
    finally {
        setBusy('');
    } };
    const share = async (native: boolean) => { if (native && navigator.share) {
        await navigator.share({ title: party?.title, text: 'Let’s get together!', url: invitationUrl });
        await api.track('invitation_share_sheet_opened', id);
        notify('Share sheet used.');
    }
    else {
        await navigator.clipboard.writeText(invitationUrl);
        await api.track('invitation_link_copied', id);
        notify('Invitation link copied. Ready to share!');
    } };
    if (loading)
        return <Loading />;
    if (!party)
        return <div className="empty panel"><span className="empty-icon"><Icon name="calendar" size={28}/></span><h1>{error ? 'We couldn’t open this party.' : 'This party isn’t available.'}</h1><p>{error || 'The invitation may have expired or the host may have removed it. Check the link with your host.'}</p><button className="button primary" onClick={load}>Try again</button><button className="text-button" onClick={() => navigate('/')}>My parties</button></div>;
    if (editing && party.canEdit)
        return <Editor original={party} session={session} navigate={navigate} notify={notify} onSaved={async () => { await refresh(); await refreshParty(); }}/>;
    const maps = partyMapLinks(party.location, party.address);
    const host = party.canEdit === true;
    const yes = (party.rsvps || []).filter(r => r.status === 'yes');
    const going = party.totals?.attending ?? yes.reduce((n, r) => n + (r.attendeeCount || 1), 0);
    const claimed = party.items.filter(i => i.claimedBy || i.claimedByUserId).length;
    const pending = api.hasPending(id) || (party.cloudStatus && party.cloudStatus !== 'committed');
    return <><div className="party-toolbar"><button className="back-link" onClick={() => navigate('/')}><Icon name="back" size={17}/>My parties</button><button className="text-button" disabled={!!busy} onClick={() => act('refresh', async () => { await refreshParty(); await refresh(); notify('Party details refreshed.'); })}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh party'}</button></div><section className="event-presentation"><InvitationPoster party={party} host={host}/><div className="event-information"><div className="event-when"><span className="info-label">WHEN</span><span><Icon name="calendar"/>{dateLabel(party.date)}</span></div><div className="event-where"><span className="info-label">WHERE</span>{maps ? <a href={maps.map} target="_blank" rel="noopener noreferrer" className="location-link"><Icon name="pin"/><span>{party.location || party.address}{party.address && party.address !== party.location && <small>{party.address}</small>}</span><Icon name="external" size={17}/></a> : <span><Icon name="pin"/>Location to be decided</span>}{maps && <a href={maps.directions} target="_blank" rel="noopener noreferrer" className="directions-link">Get directions<Icon name="arrow" size={16}/></a>}</div></div><div className="event-actionbar"><span>{host ? 'You make the plan. Let your people pitch in.' : 'An invitation for you. Make yourself at home.'}</span><div>{!host && <button className="button primary" onClick={() => { document.getElementById('party-rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.querySelector<HTMLInputElement>('#party-rsvp input')?.focus({preventScroll:true}); }}>RSVP<Icon name="arrow" size={18}/></button>}<button className={host ? 'button primary' : 'button secondary'} disabled={!!busy} onClick={() => { setShareOptions(true); requestAnimationFrame(() => document.getElementById('invite-sharing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>Share invite<Icon name="share" size={18}/></button><button className="button outline" disabled={!!busy} onClick={() => act('share', () => share(false))}>Copy link<Icon name="copy" size={18}/></button>{host && <button className="button outline" onClick={() => navigate(`/party/${id}?edit=1`)}>Edit party</button>}</div></div></section>
    {error && <Notice kind="error">{error}</Notice>}{pending && <Notice kind="warning">{party.cloudStatus === 'conflict' ? 'This party changed elsewhere. Reload the latest details before trying again.' : 'These changes need to sync. Keep this page open and retry when your connection is ready.'}<button className="text-button" disabled={!!busy} onClick={() => act('retry', async () => { const p = await api.retry(id); await refresh(); if (p)
        await refreshParty();
    else {
        notify('Party deleted.');
        navigate('/');
    } })}>{busy === 'retry' ? 'Retrying…' : 'Retry sync'}</button><button className="text-button" onClick={load}>Reload party</button></Notice>}
    <div className="party-layout">{!host && <section className="panel rsvp-panel" id="party-rsvp"><span className="eyebrow">YOUR SEAT AT THE TABLE</span><h2>{rsvpSaved ? 'Your RSVP' : 'Are you coming?'}</h2><form onSubmit={e => { e.preventDefault(); void act('rsvp', async () => { setParty(await api.rsvp(id, { name: name.trim(), status, attendeeCount: count })); await refresh(); setDidJoin(true); setRsvpSaved(true); notify('Your RSVP is saved.'); }); }}><label>Your name<input autoComplete="name" required maxLength={100} value={name} placeholder="How your host knows you" onChange={e => setName(e.target.value)}/></label><fieldset className="rsvp-options"><legend>Your response</legend>{(['yes', 'maybe', 'no'] as const).map(s => <label key={s} className={status === s ? 'selected' : ''}><input type="radio" name="response" checked={status === s} value={s} onChange={() => setStatus(s)}/><span>{statusLabel[s]}</span></label>)}</fieldset>{status !== 'no' && <label>People in your group, including you<input type="number" min={1} max={100} required value={count} onChange={e => setCount(Number(e.target.value))}/></label>}<button className="button primary full-width" disabled={!!busy}>{busy === 'rsvp' ? 'Saving RSVP…' : rsvpSaved ? 'Update RSVP' : 'Save my RSVP'}<Icon name="check" size={17}/></button><p className="form-fine-print">Your response saves this party to your joined list.</p></form>{!didJoin && <button className="text-button save-party" disabled={!!busy} onClick={() => act('join', async () => { await api.joinParty(id); await refresh(); setDidJoin(true); notify('Party saved to your joined list.'); })}>{busy === 'join' ? 'Saving…' : 'Just save this party for now'}<Icon name="plus" size={16}/></button>}{didJoin && <p className="saved-note"><Icon name="check" size={16}/>Saved to your joined parties</p>}</section>}
      <div className="party-main">{party.notes && <section className="panel detail-panel host-letter"><span className="eyebrow">A NOTE FROM YOUR HOST</span><h2>A few little details</h2><p className="party-notes">{party.notes}</p></section>}
      <section className="panel detail-panel"><div className="section-heading compact"><div><span className="eyebrow">01 / A LITTLE SOMETHING TO SHARE</span><h2>Claim an item to bring</h2></div><span className="count-chip">{claimed} of {party.items.length} claimed</span></div><p className="muted">{host ? 'Guests can RSVP “Going” to choose something to bring. You can manage the list in Edit party details.' : mine?.status === 'yes' ? 'Pick something to bring. A little contribution goes a long way.' : 'RSVP “Going” to claim something from the list.'}</p><div className="bring-list-key"><span>THE BRING-ALONG LIST</span><span>{party.items.length - claimed} STILL OPEN</span></div><div className="progress-track"><span style={{ width: `${party.items.length ? claimed / party.items.length * 100 : 0}%` }}/></div><ul className="bring-list">{party.items.map(item => { const own = item.isMine ?? Boolean(session?.id && item.claimedByUserId === session.id); const taken = Boolean(item.claimedBy || item.claimedByUserId); return <li key={item.id}><span className={`item-check ${taken ? 'taken' : ''}`}>{taken ? <Icon name="check" size={16}/> : <Icon name="plus" size={16}/>}</span><div className="grow"><strong>{item.name}</strong><span>{item.qty || 'A little something to share'}{item.claimedBy ? ` · ${own ? 'You’re bringing this' : `Claimed by ${item.claimedBy}`}` : taken ? ' · Claimed' : ''}</span></div><button className={`button small ${own ? 'secondary' : 'outline'}`} disabled={!!busy || mine?.status !== 'yes' || (taken && !own)} onClick={() => act(item.id, async () => { setParty(await api.claim(id, item.id, !own)); notify(own ? 'Item released.' : 'You’re on the list. Thanks for pitching in!'); })}>{busy === item.id ? 'Saving…' : own ? 'Release' : taken ? 'Claimed' : 'I’ll bring it'}</button></li>; })}</ul>{!party.items.length && <div className="list-placeholder">No items listed yet. You can suggest something to bring.</div>}
        <form className="suggest-form" onSubmit={e => { e.preventDefault(); if (!suggestion.trim())
        return; void act('suggest', async () => { setParty(await api.suggest(id, suggestion.trim())); setSuggestion(''); await refresh(); setDidJoin(true); notify('Your idea was added to the list.'); }); }}><label htmlFor="suggestion">Have something else in mind?</label><div className="input-action"><input id="suggestion" placeholder="Suggest something to bring" maxLength={120} value={suggestion} onChange={e => setSuggestion(e.target.value)} required/><button className="button secondary" disabled={!!busy || !suggestion.trim()}>{busy === 'suggest' ? 'Adding…' : 'Add idea'}<Icon name="plus" size={17}/></button></div></form></section>
      <section className="panel detail-panel"><div className="section-heading compact"><div><span className="eyebrow">02 / THE GOOD COMPANY</span><h2>Who’s coming?</h2></div><span className="count-chip">{going} going</span></div>{!party.rsvps?.length ? <p className="muted">{host ? 'The first RSVP is still to come.' : going > 0 ? `Guest responses are shared with the host. ${going} going.` : 'Guest responses are shared with the host.'}</p> : <ul className="guest-list">{party.rsvps.map((r, i) => <li key={r.id || `${r.name}-${i}`}><span className={`guest-avatar guest-${i % 3}`}>{r.name?.slice(0, 1).toUpperCase() || '?'}</span><span className="grow"><strong>{r.name || 'Guest'}{r.id === session?.id ? ' (you)' : ''}</strong>{r.attendeeCount > 1 && <small>Group of {r.attendeeCount}</small>}</span><span className={`rsvp-pill ${r.status}`}>{statusLabel[r.status] || 'Responded'}</span></li>)}</ul>}</section>
    </div><section className="share-panel" id="invite-sharing"><Icon name="share" size={25}/><h3>{host ? 'Make it a full house.' : 'Pass the invitation.'}</h3><p>One link has all the details. Guests open it right in their browser.</p><button className="button secondary full-width" disabled={!!busy} aria-expanded={shareOptions} aria-controls="share-options" onClick={() => setShareOptions(value => !value)}>Share invite <Icon name="share" size={17}/></button><button className="button outline full-width copy-invite" disabled={!!busy} onClick={() => act('share', () => share(false))}>Copy link<Icon name="copy" size={18}/></button>{shareOptions && <div className="share-options" id="share-options"><p>Choose where to share. You pick the recipients and send it in your app.</p>{typeof navigator.share === 'function' && <button className="button secondary full-width" disabled={!!busy} onClick={() => act('share', () => share(true))}>Choose from my apps</button>}<div className="share-outlets"><a href={`sms:?body=${encodeURIComponent(invitationMessage)}`}>Text message</a><a href={`https://wa.me/?text=${encodeURIComponent(invitationMessage)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a><a href={`mailto:?subject=${encodeURIComponent(party.title + ' — you’re invited')}&body=${encodeURIComponent(invitationMessage)}`}>Email</a></div><p>For Messenger or another app, use your device’s share options, or copy the link and paste it there.</p><input aria-label="Invitation link" value={invitationUrl} readOnly onFocus={event => event.currentTarget.select()}/><small>Opening an app or copying a link does not mean the invitation was delivered.</small></div>}<small>Anyone with the link can view this party. No PartyPlus app download needed.</small></section>
      {host && <section className="panel host-panel"><span className="eyebrow">HOST CORNER</span><h3>The host desk.</h3><button className="button outline full-width" onClick={() => navigate(`/party/${id}?edit=1`)}>Edit party details</button>{!confirmDelete ? <button className="danger-text" onClick={() => setConfirmDelete(true)}>Delete party</button> : <div className="delete-confirm" role="alertdialog" aria-labelledby="delete-heading"><h4 id="delete-heading">Delete this party?</h4><p>This removes the party and its invitation for everyone.</p><div><button className="button danger small" disabled={!!busy} onClick={() => act('delete', async () => { await api.deleteParty(id); await refresh(); notify('Party deleted.'); navigate('/'); })}>{busy === 'delete' ? 'Deleting…' : 'Yes, delete'}</button><button className="text-button" onClick={() => setConfirmDelete(false)}>Keep party</button></div></div>}</section>}
    </div>
  </>;
}
function InfoPage({ page, navigate }: {
    page: string;
    navigate: (p: string) => void;
}) {
    const title = page === 'support' ? 'A little help, right here.' : page === 'privacy' ? 'Your plans. Your people.' : 'A few things to know.';
    return <><button className="back-link" onClick={() => navigate('/')}><Icon name="back" size={17}/>My parties</button><div className="page-heading"><span className="eyebrow">{page.toUpperCase()}</span><h1>{title}</h1></div><article className="panel info-panel">{page === 'support' ? <>
    <h2>Need a hand?</h2><p>Email <a href="mailto:clogherlabs@gmail.com">clogherlabs@gmail.com</a> with what happened and the party invitation link, if relevant. Never send your sign-in code.</p>
    <h3>Finding a party from the earlier app</h3><p>Existing party records are preserved. Open your original invitation link to view the party. Older app device IDs do not prove account ownership. If you need host access restored, contact support for a review; restoration is not automatic.</p>
    <h3>A change is waiting to sync</h3><p>Keep this browser’s saved data, reconnect, and use “Retry sync” on your party. Your saved change is retried with the same operation so an uncertain connection does not create duplicate actions.</p>
    <h3>Keeping access to your responses</h3><p>Guests can respond without an account. Verify a new email in the same browser to keep those responses with you. Before leaving a guest session or clearing browser data, save your invitation links and verify your email.</p>
    <h3>Signing in</h3><p>Use the most recent code sent to your email. If it expires, request another from the sign-in page. If your email already belongs to an account, use the existing-account option and read the guest-access notice before continuing.</p>
  </> : page === 'privacy' ? <>
    <h2>Party information</h2><p>PartyPlus uses party details, RSVP names and responses, group sizes, and item contributions to help hosts and guests coordinate gatherings. Avoid including information you would not want the invited group to see.</p>
    <h3>Invitation links</h3><p>Anyone with an invitation link can open the party. Treat the link like an invitation: share it with people you intend to invite. Hosts can review guest responses. Guest views may show fewer details.</p>
    <h3>Accounts and this browser</h3><p>Email verification supports host accounts and access to saved parties. Anonymous guest sessions, party drafts, and changes awaiting confirmation can be stored in this browser. Clearing browser data or signing out of a guest session can affect your ability to update earlier responses.</p>
    <h3>Product events</h3><p>PartyPlus records basic usage events, such as opening invitations and copying links, to understand whether the service works. A copied invitation or an opened share sheet does not confirm that an invitation was delivered.</p>
    <h3>Questions or data requests</h3><p>Contact <a href="mailto:clogherlabs@gmail.com">clogherlabs@gmail.com</a> for questions about privacy or your information.</p>
  </> : <>
    <h2>Using PartyPlus</h2><p>PartyPlus helps people plan gatherings, share invitations, respond, and coordinate things to bring. Hosts are responsible for the details they share and for organizing their gatherings.</p>
    <h3>Share thoughtfully</h3><p>Share invitation links with the people you want to invite. Use accurate details, respect other guests, and only contribute content you have permission to share. Do not use the service for unlawful or abusive activity.</p>
    <h3>Save confirmation</h3><p>A change waiting to sync is not yet confirmed by the service. Check the saved response or retry status before relying on an update. Availability may be interrupted, so contact your host directly about urgent changes.</p>
    <h3>Questions</h3><p>Contact <a href="mailto:clogherlabs@gmail.com">clogherlabs@gmail.com</a> for help with the service, your account, or party access.</p>
  </>}</article></>;
}
