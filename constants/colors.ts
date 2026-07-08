/**
 * Wing color tokens — canonical source of truth.
 *
 * Used by all runtime JS (LinearGradient color arrays, Reanimated, SVG fills,
 * any place a className can't reach). The same scales are hand-mirrored into
 * tailwind.config.js for NativeWind utility classes — keep the two in sync.
 *
 * Provenance:
 *   - coral + plum: exact hex from the Claude Design mockup (June 2026).
 *   - ink ramp (700/500/300/200/100), accents (butter/mint/blush), and creamDeep:
 *     SAMPLED from the mockup swatches (no published hex). Marked `sampled`.
 *     Drop in exact Figma values here when available — this file is the only
 *     place (plus the tailwind mirror) they need to change.
 */

// --- Brand Coral — primary action, "the spark" (exact) ---
export const coral = {
  100: '#FFE0D9', // disabled states, blush bg
  300: '#FF9E8C', // hover fills
  500: '#FF6150', // PRIMARY — all CTAs, active nav, logo
  600: '#ED4733', // button hover
  700: '#C5331F', // button pressed
} as const;

// --- Brand Plum — trust, depth, the human behind the intro (exact) ---
export const plum = {
  100: '#EBDCEE', // mutual-friend badge bg
  300: '#B48BC0',
  500: '#6E3F80', // strong plum accent
  600: '#573166', // dark lockup bg, deep brand
  700: '#43254F',
} as const;

// --- Ink — warm-neutral text scale ---
export const ink = {
  900: '#1A1412', // primary text (warm near-black)
  700: '#4A3F3C', // sampled — tune vs Figma
  500: '#786E6A', // muted text (captions, placeholders) — darkened from #8B7F7B, was ~3.7:1 on cream, now ~4.7:1 (WCAG AA)
  300: '#968C88', // subtle borders, unfocused icons — darkened from #C9C0BD, was ~1.8:1 on white, now ~3.3:1 (WCAG AA for UI components)
  200: '#E4DDDA', // sampled — tune vs Figma
  100: '#F1ECEA', // sampled — tune vs Figma
} as const;

// --- Surfaces ---
export const surface = {
  cream: '#FBF8F5', // app bg (warm cream — NOT pure white)
  creamDeep: '#F4EBE2', // section canvas behind cards — sampled, tune vs Figma
  paper: '#FFFFFF', // white cards sit on cream bg
} as const;

// --- Accent — Butter (warning / PENDING) — sampled, tune vs Figma ---
export const butter = {
  100: '#FBF0CE',
  500: '#F5C84B',
  700: '#C9991F',
} as const;

// --- Accent — Mint (success / MATCHED) — sampled, tune vs Figma ---
export const mint = {
  100: '#D8EFE2',
  500: '#5FB389',
  700: '#2F8F5B',
} as const;

// --- Accent — Blush (soft / Unmatch) — sampled, tune vs Figma ---
export const blush = {
  100: '#F9DCE5',
  300: '#F4A9C0',
  500: '#ED7BA0',
} as const;

/**
 * Signature gradients — hero / splash / avatars / intro-note card ONLY.
 * Ordered stop arrays ready for expo-linear-gradient's `colors` prop.
 */
export const gradients = {
  sunset: [coral[500], blush[300]], // coral → blush (app icon)
  warm: [butter[500], coral[500]], // butter → coral
  dusk: [coral[500], plum[500]], // coral → plum
  // Between coral-500/600 and coral-600/700 — each stop nudged ~35% back
  // toward the next-lighter scale step from coral[600]/coral[700], a touch
  // lighter than that pairing per design feedback. White text: 3.48:1 at the
  // lighter stop, 4.77:1 at the darker stop. Used by the intro-note card + FAB.
  ember: ['#F3503D', '#D33A26'],
} as const;

/**
 * Warm shadow tint. All elevation uses this instead of pure black.
 * The 6 elevation presets (xs…brand) are built with the first Card component.
 */
export const shadowTint = 'rgba(80, 40, 30, 0.12)';

// --- Semantic aliases ---
export const semantic = {
  appBg: surface.cream,
  cardBg: surface.paper,
  textPrimary: ink[900],
  textMuted: ink[500],
  borderSubtle: ink[300],
  primary: coral[500],
} as const;

export const colors = {
  coral,
  plum,
  ink,
  surface,
  butter,
  mint,
  blush,
  gradients,
  shadowTint,
  semantic,
} as const;

export default colors;
