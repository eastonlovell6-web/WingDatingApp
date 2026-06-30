/**
 * Wing typography tokens — canonical source of truth.
 * Hand-mirrored into tailwind.config.js (fontFamily + fontSize) — keep in sync.
 *
 * Three fonts, one job each:
 *   - display (Bricolage Grotesque): headlines, big moments, intro-note text
 *   - body (DM Sans): all reading text, UI copy, button labels, captions
 *   - mono (DM Mono): eyebrow labels (uppercase coral) + stat numerals
 *
 * Fonts are referenced by family name. Actual loading (@expo-google-fonts +
 * useFonts + splash gate) is wired at the app-shell / Onboarding step — these
 * names are the keys those loaders will register.
 */

import { coral, ink } from './colors';

/** Family names — must match the keys passed to useFonts later. */
export const fonts = {
  display: 'BricolageGrotesque',
  body: 'DMSans',
  mono: 'DMMono',
} as const;

/** Font weights by role. */
export const weights = {
  displayBold: '700',
  displaySemibold: '600',
  bodyMedium: '600',
  bodyRegular: '400',
} as const;

/**
 * Size ramp — 2xs → 6xl. Each entry is [fontSize, lineHeight] in px.
 * sm (14) is the caption minimum on mobile; base (16) is body.
 */
export const fontSize = {
  '2xs': [11, 14],
  xs: [12, 16],
  sm: [14, 20], // caption min
  base: [16, 24], // body
  lg: [18, 26],
  xl: [20, 28],
  '2xl': [24, 30],
  '3xl': [30, 36],
  '4xl': [36, 40],
  '5xl': [44, 48],
  '6xl': [52, 54],
} as const;

/**
 * Role presets — ready to spread into a Text `style`.
 * letterSpacing in px; lineHeight pulled from the size ramp.
 */
export const textStyles = {
  display: {
    fontFamily: fonts.display,
    fontWeight: weights.displayBold,
    fontSize: fontSize['6xl'][0],
    lineHeight: fontSize['6xl'][1],
    letterSpacing: -0.5,
    color: ink[900],
  },
  heading: {
    fontFamily: fonts.display,
    fontWeight: weights.displaySemibold,
    fontSize: fontSize['2xl'][0],
    lineHeight: fontSize['2xl'][1],
    letterSpacing: -0.2,
    color: ink[900],
  },
  body: {
    fontFamily: fonts.body,
    fontWeight: weights.bodyRegular,
    fontSize: fontSize.base[0],
    lineHeight: fontSize.base[1],
    color: ink[900],
  },
  caption: {
    fontFamily: fonts.body,
    fontWeight: weights.bodyRegular,
    fontSize: fontSize.sm[0],
    lineHeight: fontSize.sm[1],
    color: ink[500],
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontWeight: weights.bodyMedium,
    fontSize: fontSize.xs[0],
    lineHeight: fontSize.xs[1],
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: coral[500],
  },
  stat: {
    fontFamily: fonts.mono,
    fontWeight: weights.bodyMedium,
    fontSize: fontSize['4xl'][0],
    lineHeight: fontSize['4xl'][1],
    color: ink[900],
  },
} as const;

export type FontSizeToken = keyof typeof fontSize;
export type TextStyleToken = keyof typeof textStyles;
