/**
 * Wing elevation tokens — canonical source of truth.
 *
 * 6 warm-tinted shadow tiers (never pure black — see `shadowTint` in
 * colors.ts). Higher tiers = higher in the visual stack: xs/sm/md are
 * resting-surface tiers (compact rows → hero cards → modals/panels), lg/xl
 * are floating-chrome tiers (nav pill → topmost chrome), and `brand` is the
 * coral-glow tier reserved for the FAB / primary CTA so it reads as the
 * single most elevated element on screen.
 */

import type { ViewStyle } from 'react-native';
import { coral, shadowTint } from './colors';

export const elevation: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'brand', ViewStyle> = {
  // Compact list rows — FriendsRow chips, IntroPreviewCard "stack" variant.
  xs: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Standard resting cards — IntroPreviewCard "hero" variant.
  sm: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Raised surfaces — modals, panels.
  md: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // Floating nav pill.
  lg: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  // Topmost neutral floating chrome, above the nav pill.
  xl: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  // Coral-tinted glow reserved for the FAB / primary CTA — bigger + more
  // opaque than `lg` so the FAB visibly separates from the nav pill beneath it.
  brand: {
    shadowColor: coral[500],
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
};

export default elevation;
