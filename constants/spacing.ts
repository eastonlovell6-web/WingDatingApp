/**
 * Wing spacing + radii tokens — canonical source of truth.
 * Hand-mirrored into tailwind.config.js — keep the two in sync.
 */

/**
 * Spacing — 4px base unit. Keyed by the design's step number.
 *
 * NOTE: steps 8/10/12 (40/64/96) intentionally diverge from Tailwind's default
 * px for those keys (32/40/48). The tailwind mirror overrides 8/10/12 so
 * `p-8` === 40px, `p-10` === 64px, `p-12` === 96px across the app.
 */
export const spacing = {
  2: 8,
  4: 16,
  6: 24,
  8: 40,
  10: 64,
  12: 96,
} as const;

/** Corner radii — friendly, generous rounding. */
export const radii = {
  sm: 10, // chips, tight elements
  md: 16, // standard cards, inputs
  lg: 22, // large cards
  xl: 28, // action cards, hero elements, intro-note card
  '2xl': 36, // prominent surfaces
  pill: 999, // buttons, badges, avatars
} as const;

export type SpacingStep = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
