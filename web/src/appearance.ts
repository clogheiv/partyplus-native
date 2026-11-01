export type PartyDesign = 'partyplus' | 'casual' | 'birthday' | 'cookout' | 'holiday' | 'shower' | 'game-night';
export type PartyLayout = 'illustrated' | 'photo' | 'elegant';
export type PartyAccent = 'navy' | 'cobalt' | 'orchid' | 'forest' | 'coral' | 'gold';
export type PartyFont = 'editorial' | 'modern' | 'classic';
export type PartyArtwork = 'partyplus' | 'confetti' | 'balloons' | 'citrus' | 'evergreen' | 'blossom' | 'game-night' | 'none';

export type PartyAppearance = {
  version: 1;
  design: PartyDesign;
  layout: PartyLayout;
  accent: PartyAccent;
  font: PartyFont;
  artwork: PartyArtwork;
  image?: { id: string; positionX: number; positionY: number; zoom: number };
};

export const defaultAppearance: PartyAppearance = {
  version: 1, design: 'partyplus', layout: 'illustrated', accent: 'navy', font: 'editorial', artwork: 'partyplus',
};

export const appearanceDesigns: { id: PartyDesign; name: string; description: string }[] = [
  { id: 'partyplus', name: 'PartyPlus original', description: 'Colorful. Welcoming. Yours.' },
  { id: 'casual', name: 'Just because', description: 'Easy plans, good company.' },
  { id: 'birthday', name: 'Birthday', description: 'A little extra celebration.' },
  { id: 'cookout', name: 'Cookout', description: 'Fresh air and something good.' },
  { id: 'holiday', name: 'Holiday', description: 'Warm company, festive details.' },
  { id: 'shower', name: 'Shower', description: 'A lovely reason to gather.' },
  { id: 'game-night', name: 'Game night', description: 'Bring your favorite people.' },
];

const presets: Record<PartyDesign, PartyAppearance> = {
  partyplus: defaultAppearance,
  casual: { version: 1, design: 'casual', layout: 'illustrated', accent: 'cobalt', font: 'modern', artwork: 'confetti' },
  birthday: { version: 1, design: 'birthday', layout: 'illustrated', accent: 'orchid', font: 'editorial', artwork: 'balloons' },
  cookout: { version: 1, design: 'cookout', layout: 'illustrated', accent: 'coral', font: 'modern', artwork: 'citrus' },
  holiday: { version: 1, design: 'holiday', layout: 'elegant', accent: 'forest', font: 'classic', artwork: 'evergreen' },
  shower: { version: 1, design: 'shower', layout: 'elegant', accent: 'orchid', font: 'editorial', artwork: 'blossom' },
  'game-night': { version: 1, design: 'game-night', layout: 'illustrated', accent: 'navy', font: 'modern', artwork: 'game-night' },
};

const designs: readonly string[] = appearanceDesigns.map(option => option.id);
const layouts: readonly string[] = ['illustrated', 'photo', 'elegant'];
const accents: readonly string[] = ['navy', 'cobalt', 'orchid', 'forest', 'coral', 'gold'];
const fonts: readonly string[] = ['editorial', 'modern', 'classic'];
const artworks: readonly string[] = ['partyplus', 'confetti', 'balloons', 'citrus', 'evergreen', 'blossom', 'game-night', 'none'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** A fresh curated preset, with no image or shared mutable crop state. */
export function appearanceForDesign(design: PartyDesign | string): PartyAppearance {
  return { ...(designs.includes(design) ? presets[design as PartyDesign] : defaultAppearance) };
}

/** Client display normalization only; server authorization and validation remain authoritative. */
export function normalizeAppearance(value: unknown): PartyAppearance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultAppearance };
  const input = value as Record<string, unknown>;
  if (input.version !== 1) return { ...defaultAppearance };
  const design = typeof input.design === 'string' && designs.includes(input.design) ? input.design as PartyDesign : 'partyplus';
  const preset = appearanceForDesign(design);
  const result: PartyAppearance = {
    version: 1, design,
    layout: typeof input.layout === 'string' && layouts.includes(input.layout) ? input.layout as PartyLayout : preset.layout,
    accent: typeof input.accent === 'string' && accents.includes(input.accent) ? input.accent as PartyAccent : preset.accent,
    font: typeof input.font === 'string' && fonts.includes(input.font) ? input.font as PartyFont : preset.font,
    artwork: typeof input.artwork === 'string' && artworks.includes(input.artwork) ? input.artwork as PartyArtwork : preset.artwork,
  };
  if (input.image && typeof input.image === 'object' && !Array.isArray(input.image)) {
    const image = input.image as Record<string, unknown>;
    if (typeof image.id === 'string' && uuid.test(image.id)) {
      result.image = { id: image.id, positionX: bounded(image.positionX, 50, 0, 100), positionY: bounded(image.positionY, 50, 0, 100), zoom: bounded(image.zoom, 1, 1, 2) };
    }
  }
  return result;
}
