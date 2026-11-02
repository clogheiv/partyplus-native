import { useId, useRef, useState, type ReactNode } from 'react';
import { appearanceDesigns, appearanceForDesign, normalizeAppearance, type PartyAppearance, type PartyArtwork, type PartyAccent, type PartyFont, type PartyLayout } from './appearance';
import './appearance.css';

// Editing-only per-image opt-out; public invitations and thumbnails keep normal sharing behavior.
const editingImageAttributes = (editing: boolean) => editing ? { 'data-pin-nopin': 'true', nopin: 'nopin' } : {};
const brandIcon = '/assets/brand/partyplus-icon.png';
const banner = '/assets/brand/partyplus-banner.jpg';
const bannerSources = '/assets/brand/partyplus-banner-small.jpg 768w, /assets/brand/partyplus-banner.jpg 1440w';
const accents: { id: PartyAccent; name: string }[] = [
  { id: 'navy', name: 'Midnight navy' }, { id: 'cobalt', name: 'Celebration blue' },
  { id: 'orchid', name: 'Orchid' }, { id: 'forest', name: 'Evergreen' },
  { id: 'coral', name: 'Warm coral' }, { id: 'gold', name: 'Golden hour' },
];
const fonts: { id: PartyFont; name: string; description: string }[] = [
  { id: 'editorial', name: 'Editorial', description: 'Expressive & welcoming' },
  { id: 'modern', name: 'Modern', description: 'Bold & easygoing' },
  { id: 'classic', name: 'Classic', description: 'Timeless & elegant' },
];
const layouts: { id: PartyLayout; name: string; description: string }[] = [
  { id: 'illustrated', name: 'Illustrated', description: 'A little personality' },
  { id: 'photo', name: 'Photo', description: 'Make it personal' },
  { id: 'elegant', name: 'Elegant', description: 'Let the details shine' },
];
const artworks: { id: PartyArtwork; name: string }[] = [
  { id: 'partyplus', name: 'PartyPlus original' }, { id: 'confetti', name: 'Confetti' },
  { id: 'balloons', name: 'Balloons' }, { id: 'citrus', name: 'Citrus' },
  { id: 'evergreen', name: 'Evergreen' }, { id: 'blossom', name: 'Blossom' },
  { id: 'game-night', name: 'Game night' }, { id: 'none', name: 'No artwork' },
];

function Artwork({ artwork, compact = false, editing = false }: { artwork: PartyArtwork; compact?: boolean; editing?: boolean }) {
  if (artwork === 'none') return <span className="ap-clean-art" aria-hidden="true"><span/><span/><span/></span>;
  if (artwork === 'partyplus') return compact
    ? <img {...editingImageAttributes(editing)} className="ap-original-icon" src={brandIcon} width="90" height="90" alt="" decoding="async"/>
    : <img {...editingImageAttributes(editing)} className="ap-original-banner" src={banner} srcSet={bannerSources} sizes="(max-width: 640px) 90vw, 560px" width="1440" height="697" alt="" decoding="async"/>;
  return <svg className={`ap-artwork ap-artwork-${artwork}`} viewBox="0 0 320 300" fill="none" aria-hidden="true">
    {artwork === 'confetti' && <>
      <path d="M58 200c20-104 75-139 149-112" stroke="var(--ap-art-one)" strokeWidth="28" strokeLinecap="round"/>
      <path d="m90 229 33-47 37 24 31-68 49 13" stroke="var(--ap-art-two)" strokeWidth="18" strokeLinejoin="round"/>
      <path d="m215 41 8 25 26 1-21 16 7 25-21-15-21 14 8-24-20-16 25 1Z" fill="var(--ap-art-three)"/>
      <path d="m54 69 12 23m194 118-19 16M159 47l-4 15" stroke="var(--ap-art-three)" strokeWidth="10" strokeLinecap="round"/>
      <circle cx="256" cy="135" r="10" fill="var(--ap-art-one)"/><circle cx="46" cy="245" r="7" fill="var(--ap-art-two)"/>
      <path d="m182 255 24-16 3 29Z" fill="var(--ap-art-one)"/>
    </>}
    {artwork === 'balloons' && <>
      <path d="M93 156c-14 28 18 44 4 78m76-109c-20 52 23 71 0 137m58-88c19 36-13 44-3 77" stroke="var(--ap-line-art)" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="93" cy="110" rx="49" ry="61" transform="rotate(-16 93 110)" fill="var(--ap-art-one)"/>
      <ellipse cx="173" cy="83" rx="48" ry="61" transform="rotate(8 173 83)" fill="var(--ap-art-three)"/>
      <ellipse cx="231" cy="130" rx="45" ry="57" transform="rotate(17 231 130)" fill="var(--ap-art-two)"/>
      <path d="m88 167 10-2-3 12Zm81-24 10 1-7 9Zm57 41 10-2-3 10Z" fill="var(--ap-line-art)"/>
      <path d="M67 95c2-13 8-22 17-28m73-18c5-6 12-9 20-9m48 57c11 1 19 8 23 17" stroke="var(--ap-art-paper)" strokeWidth="5" strokeLinecap="round"/>
      <path d="m40 218 8 10m217-185-9 13" stroke="var(--ap-art-two)" strokeWidth="7" strokeLinecap="round"/>
    </>}
    {artwork === 'citrus' && <>
      <path d="M165 61c-3-34 24-52 57-42-6 30-25 45-57 42" fill="var(--ap-art-two)"/>
      <circle cx="147" cy="149" r="90" fill="var(--ap-art-one)"/><circle cx="147" cy="149" r="69" fill="var(--ap-art-paper)"/>
      {[0, 60, 120, 180, 240, 300].map(rotation => <path key={rotation} d="M153 140 153 91a58 58 0 0 1 42 27Z" transform={`rotate(${rotation} 147 149)`} fill="var(--ap-art-three)"/>)}
      <path d="M178 218c13-39 44-55 79-39-8 37-35 57-79 39" fill="var(--ap-art-two)"/>
      <circle cx="257" cy="89" r="7" fill="var(--ap-art-three)"/><path d="m55 249 12-7m184 13 7 12" stroke="var(--ap-art-one)" strokeWidth="6" strokeLinecap="round"/>
    </>}
    {artwork === 'evergreen' && <>
      <path d="M160 262V53m0 172L89 181m71 18 65-38m-65-2-54-34m54 5 43-28m-43 0-29-22" stroke="var(--ap-art-two)" strokeWidth="7" strokeLinecap="round"/>
      {[[-1,0],[1,0]].map(([direction], index) => <g key={index} transform={`translate(160 0) scale(${direction} 1)`} stroke="var(--ap-art-one)" strokeWidth="6" strokeLinecap="round"><path d="M0 215 31 171M0 198l48-33M0 178l16-34M0 155l34-29M0 133l9-29M0 111l22-20M0 88l4-23"/></g>)}
      <circle cx="91" cy="155" r="10" fill="var(--ap-art-three)"/><circle cx="221" cy="198" r="8" fill="var(--ap-art-three)"/>
      <path d="m249 56 6 13 15 1-11 10 3 15-13-8-13 7 3-14-11-10 15-1Z" fill="var(--ap-art-three)"/>
      <path d="m61 228 6 13 15 1-11 10 3 15-13-8-13 7 3-14-11-10 15-1Z" fill="var(--ap-art-three)"/>
    </>}
    {artwork === 'blossom' && <>
      <path d="M159 267V150m0 74c-49 0-78-24-78-56 43 0 73 16 78 47m1 14c44 0 75-23 75-53-42 0-72 14-75 42" stroke="var(--ap-art-two)" strokeWidth="10"/>
      {[0,72,144,216,288].map(rotation => <ellipse key={rotation} cx="160" cy="94" rx="28" ry="49" transform={`rotate(${rotation} 160 130)`} fill="var(--ap-art-one)"/>)}
      <circle cx="160" cy="130" r="24" fill="var(--ap-art-three)"/>
      <path d="m59 95 6-13m184 135 11 5" stroke="var(--ap-art-three)" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="243" cy="60" r="6" fill="var(--ap-art-two)"/>
    </>}
    {artwork === 'game-night' && <>
      <rect x="55" y="60" width="131" height="174" rx="14" transform="rotate(-12 55 60)" fill="var(--ap-art-three)"/>
      <path d="m100 110 20 30-20 30-20-30Z" fill="var(--ap-art-one)"/>
      <rect x="139" y="104" width="126" height="126" rx="20" transform="rotate(12 139 104)" fill="var(--ap-art-one)"/>
      {[[165,135],[216,146],[179,172],[142,185],[204,205]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="8" fill="var(--ap-art-paper)"/>)}
      <path d="m233 51 8 11m-172 188 11-5" stroke="var(--ap-art-two)" strokeWidth="8" strokeLinecap="round"/>
      <circle cx="266" cy="260" r="10" fill="var(--ap-art-two)"/>
    </>}
  </svg>;
}

function appearanceClass(appearance: PartyAppearance) {
  return `ap-accent-${appearance.accent} ap-font-${appearance.font} ap-design-${appearance.design}`;
}

function PhotoFrame({ appearance, photoUrl, fallback, decorative = false, editing = false }: { appearance: PartyAppearance; photoUrl?: string; fallback: ReactNode; decorative?: boolean; editing?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('');
  const crop = appearance.image || { positionX: 50, positionY: 50, zoom: 1 };
  const position = `${crop.positionX}% ${crop.positionY}%`;
  return <div className="ap-photo-frame">{photoUrl && failedUrl !== photoUrl
    ? <img {...editingImageAttributes(editing)} src={photoUrl} alt={decorative ? '' : 'Your party photo'} decoding="async" onError={() => setFailedUrl(photoUrl)} style={{ objectPosition: position, transform: `scale(${crop.zoom})`, transformOrigin: position }}/>
    : <div className="ap-photo-fallback">{fallback}</div>}</div>;
}

function BrandRail({ preview, host, editing = false }: { preview?: boolean; host?: boolean; editing?: boolean }) {
  return <div className="ap-brand-rail"><span className="ap-invite-label">{preview ? 'YOUR INVITATION' : host ? 'HOSTED BY YOU' : 'YOU’RE INVITED'}</span><div className="ap-brand-lockup"><img {...editingImageAttributes(editing)} src={brandIcon} alt="" width="34" height="34" decoding="async"/><div><span className="ap-brand-name">PartyPlus</span><span className="ap-brand-tagline">Party planning, made simple</span></div></div></div>;
}

function eventDate(value?: string) {
  if (!value) return { date: 'Date to come', time: 'Save the date' };
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return { date: value, time: 'Save the date' };
  return { date: new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date), time: value.length > 10 ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date) : 'Save the date' };
}

export type AppearancePosterParty = { id?: string; title?: string; notes?: string; theme?: string; date?: string; location?: string; address?: string; appearance?: PartyAppearance };

export function AppearancePoster({ party, photoUrl, preview = false, host = false }: { party: AppearancePosterParty; photoUrl?: string; preview?: boolean; host?: boolean }) {
  const appearance = normalizeAppearance(party.appearance);
  const Title = preview ? 'h2' : 'h1';
  const date = eventDate(party.date);
  const copy = <div className="ap-poster-copy">{party.theme && <span className="ap-theme-label">{party.theme}</span>}<Title className="ap-event-title">{party.title || 'A very good get-together.'}</Title>{party.notes?.trim() && <p className="ap-party-description">{party.notes}</p>}</div>;
  return <section className={`appearance-poster ${appearanceClass(appearance)} ap-layout-${appearance.layout}${preview ? ' ap-poster-preview' : ''}${appearance.artwork === 'none' ? ' ap-no-artwork' : ''}`} aria-label={preview ? 'Invitation preview' : 'Party invitation'}>
    <BrandRail preview={preview} host={host} editing={preview}/>
    {appearance.layout === 'photo' ? <div className="ap-photo-composition"><PhotoFrame editing={preview} appearance={appearance} photoUrl={photoUrl} fallback={<Artwork editing={preview} artwork={appearance.artwork === 'none' ? 'partyplus' : appearance.artwork} compact/>}/>{copy}</div>
      : appearance.layout === 'elegant' ? <div className="ap-elegant-composition">{appearance.artwork !== 'none' && <div className="ap-elegant-ornament"><Artwork editing={preview} artwork={appearance.artwork} compact/></div>}<span className="ap-elegant-rule" aria-hidden="true"/>{copy}<span className="ap-elegant-rule" aria-hidden="true"/></div>
      : <div className="ap-illustrated-composition">{copy}{appearance.artwork !== 'none' && <div className={`ap-poster-art${appearance.artwork === 'partyplus' ? ' ap-banner-art' : ''}`}><Artwork editing={preview} artwork={appearance.artwork}/></div>}</div>}
    <div className="ap-event-facts"><span>{date.date}</span><span>{date.time}</span><span>{party.location || party.address || 'Place to come'}</span></div>
  </section>;
}

export function AppearanceThumbnail({ appearance: value, photoUrl, partyId: _partyId }: { appearance?: PartyAppearance; photoUrl?: string; partyId?: string }) {
  const appearance = normalizeAppearance(value);
  return <div className={`appearance-thumbnail ${appearanceClass(appearance)} ap-thumbnail-${appearance.layout}`} aria-hidden="true">{appearance.layout === 'photo' && photoUrl
    ? <PhotoFrame appearance={appearance} photoUrl={photoUrl} fallback={<Artwork artwork={appearance.artwork} compact/>} decorative/>
    : <Artwork artwork={appearance.artwork} compact/>}</div>;
}

export type AppearanceControlsProps = {
  value?: PartyAppearance;
  onChange: (appearance: PartyAppearance) => void;
  photoUrl?: string;
  onPhotoSelected: (file: File) => void;
  onPhotoRemoved: () => void;
  uploadBusy?: boolean;
  uploadError?: string;
};

export function AppearanceControls({ value, onChange, photoUrl, onPhotoSelected, onPhotoRemoved, uploadBusy = false, uploadError }: AppearanceControlsProps) {
  const appearance = normalizeAppearance(value);
  const prefix = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const designGalleryRef = useRef<HTMLFieldSetElement>(null);
  const hasImage = Boolean(appearance.image || photoUrl);
  const openFilePicker = () => fileInputRef.current?.click();
  const focusDesignGallery = () => { designGalleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); designGalleryRef.current?.focus({ preventScroll: true }); };
  const update = (patch: Partial<PartyAppearance>) => onChange(normalizeAppearance({ ...appearance, ...patch }));
  const updateCrop = (key: 'positionX' | 'positionY' | 'zoom', value: number) => { if (appearance.image) update({ image: { ...appearance.image, [key]: value } }); };
  const chooseDesign = (design: PartyAppearance['design']) => {
    const next = appearanceForDesign(design);
    onChange(appearance.image ? { ...next, image: { ...appearance.image }, ...(appearance.layout === 'photo' ? { layout: 'photo' as const } : {}) } : next);
  };
  return <section className="appearance-controls" aria-labelledby={`${prefix}-appearance-heading`}>
    <div className="ap-controls-heading"><span className="ap-controls-kicker">INVITATION APPEARANCE</span><h2 id={`${prefix}-appearance-heading`}>Make it yours</h2></div>
    <div className="ap-controls-body">
      <p className="ap-photo-sharing-note">Photos are visible to anyone with the invitation or photo link. Choose a photo you’re comfortable sharing.</p>
      <div className="ap-primary-actions"><button type="button" className="ap-action-secondary" onClick={focusDesignGallery} aria-controls={`${prefix}-design-gallery`}>Choose a design</button><button type="button" className="ap-action-primary" data-appearance-upload disabled={uploadBusy} onClick={openFilePicker}>Upload your own image</button></div>
      <input ref={fileInputRef} className="ap-hidden-file-input" type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={uploadBusy} aria-label="Invitation image file" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) onPhotoSelected(file); event.currentTarget.value = ''; }}/>
      <p className="ap-upload-help">JPEG, PNG, or WebP. Your image stays separate from the invitation text, so every detail is easy to read.</p>
      {uploadBusy && <p className="ap-upload-status" role="status">Preparing your image. Keep this page open.</p>}{uploadError && <p className="ap-upload-error" role="alert">{uploadError}</p>}
      <section className={`ap-photo-settings ap-image-controls${hasImage ? ' ap-image-attached' : ''}`} id="party-image-controls" tabIndex={-1} aria-labelledby={`${prefix}-photo-heading`}>
        <div className="ap-photo-settings-heading"><div><h3 id={`${prefix}-photo-heading`}>Your image</h3>{!hasImage && <p>Use the upload button above to add an image of your own.</p>}</div>{hasImage && <div className="ap-image-actions"><button className="ap-action-secondary" data-appearance-replace type="button" disabled={uploadBusy} onClick={openFilePicker}>Replace image</button><button className="ap-action-remove" type="button" disabled={uploadBusy} onClick={onPhotoRemoved}>Remove image</button></div>}</div>
        {hasImage && <p className="ap-photo-removal-note">Removing it changes this invitation; previously shared photo links may still work.</p>}
        {(photoUrl || appearance.image || appearance.layout === 'photo') && <div className={`ap-crop-editor ${appearanceClass(appearance)}`}><PhotoFrame editing appearance={appearance} photoUrl={photoUrl} fallback={<div className="ap-photo-empty"><Artwork editing artwork="partyplus" compact/><span>{uploadBusy ? 'Getting your photo ready' : appearance.image ? 'Photo preview will appear here' : 'Choose a photo to make this invitation yours'}</span></div>}/>{photoUrl && appearance.layout !== 'photo' && <button className="ap-use-photo" type="button" onClick={() => update({ layout: 'photo' })}>Use the Photo layout</button>}{appearance.image && photoUrl && <fieldset className="ap-crop-sliders" disabled={uploadBusy}><legend>Frame your photo</legend><p>Move and zoom the photo inside the frame. The invitation uses this same shape.</p>{([{ key: 'positionX', label: 'Horizontal position', min: 0, max: 100, step: 1 }, { key: 'positionY', label: 'Vertical position', min: 0, max: 100, step: 1 }, { key: 'zoom', label: 'Zoom', min: 1, max: 2, step: .05 }] as const).map(control => <label className="ap-range-label" htmlFor={`${prefix}-${control.key}`} key={control.key}><span>{control.label}<output htmlFor={`${prefix}-${control.key}`}>{control.key === 'zoom' ? `${appearance.image![control.key].toFixed(2)}×` : `${Math.round(appearance.image![control.key])}%`}</output></span><input type="range" id={`${prefix}-${control.key}`} min={control.min} max={control.max} step={control.step} value={appearance.image![control.key]} onChange={event => updateCrop(control.key, Number(event.target.value))}/></label>)}</fieldset>}</div>}
      </section>
      <fieldset className="ap-fieldset ap-design-destination" ref={designGalleryRef} id={`${prefix}-design-gallery`} tabIndex={-1}><legend>Start with a design</legend><div className="ap-design-gallery">{appearanceDesigns.map(design => {
        const preset = appearanceForDesign(design.id);
        return <label className={`ap-design-card${appearance.design === design.id ? ' ap-selected' : ''}`} key={design.id}><input className="ap-native-radio" type="radio" name={`${prefix}-design`} value={design.id} checked={appearance.design === design.id} onChange={() => chooseDesign(design.id)}/><span className={`ap-design-art ${appearanceClass(preset)}`}><Artwork editing artwork={preset.artwork} compact/></span><span className="ap-card-copy"><strong>{design.name}</strong><small>{design.description}</small></span><span className="ap-choice-check" aria-hidden="true">✓</span></label>;
      })}</div></fieldset>
      
      <details className="ap-advanced-options"><summary><span>More appearance options</span><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div className="ap-advanced-body"><fieldset className="ap-fieldset"><legend>Layout</legend><div className="ap-layout-options">{layouts.map(layout => <label className={`ap-text-option${appearance.layout === layout.id ? ' ap-selected' : ''}`} key={layout.id}><input className="ap-native-radio" type="radio" name={`${prefix}-layout`} value={layout.id} checked={appearance.layout === layout.id} onChange={() => update({ layout: layout.id })}/><span className={`ap-layout-symbol ap-symbol-${layout.id}`} aria-hidden="true"><i/><i/><i/></span><strong>{layout.name}</strong><small>{layout.description}</small></label>)}</div></fieldset>
      <fieldset className="ap-fieldset"><legend>Color</legend><div className="ap-color-options">{accents.map(accent => <label className={`ap-color-option${appearance.accent === accent.id ? ' ap-selected' : ''}`} key={accent.id}><input className="ap-native-radio" type="radio" name={`${prefix}-accent`} value={accent.id} checked={appearance.accent === accent.id} onChange={() => update({ accent: accent.id })}/><span className={`ap-color-dot ap-accent-${accent.id}`} aria-hidden="true"><span>✓</span></span><span>{accent.name}</span></label>)}</div></fieldset>
      <fieldset className="ap-fieldset"><legend>Typography</legend><div className="ap-font-options">{fonts.map(font => <label className={`ap-text-option ap-font-${font.id}${appearance.font === font.id ? ' ap-selected' : ''}`} key={font.id}><input className="ap-native-radio" type="radio" name={`${prefix}-font`} value={font.id} checked={appearance.font === font.id} onChange={() => update({ font: font.id })}/><span className="ap-type-sample" aria-hidden="true">Aa</span><strong>{font.name}</strong><small>{font.description}</small></label>)}</div></fieldset>
      <fieldset className="ap-fieldset"><legend>Artwork</legend><div className="ap-artwork-gallery">{artworks.map(artwork => <label className={`ap-artwork-option ${appearanceClass(appearance)}${appearance.artwork === artwork.id ? ' ap-selected' : ''}`} key={artwork.id}><input className="ap-native-radio" type="radio" name={`${prefix}-artwork`} value={artwork.id} checked={appearance.artwork === artwork.id} onChange={() => update({ artwork: artwork.id })}/><span className="ap-artwork-swatch"><Artwork editing artwork={artwork.id} compact/></span><span>{artwork.name}</span><span className="ap-choice-check" aria-hidden="true">✓</span></label>)}</div></fieldset>
      </div></details>
      <p className="ap-controls-note">The PartyPlus original is always here. Choosing another design keeps your party details and attached photo.</p>
    </div>
  </section>;
}
