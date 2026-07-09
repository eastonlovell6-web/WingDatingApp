# Matchmaker Tab Redesign — Phase 2: Share Card, Streak Urgency, Action Copy, Visual Cleanup

## Context

Phase 1 (`2026-07-08-matchmaker-tab-phase1-ring-design.md`) shipped the SVG score ring, count-up, tap-to-flip rank, and XP/streak bar in `MatchmakerScoreRing.tsx` / `RankProgressBar.tsx`, wired into `MatchmakerPanel.tsx`. This phase keeps that structure (ring, XP bar, stat tiles, badge row all stay) and makes seven targeted changes on top of it:

1. Share button on the score card → branded, shareable stat card (IG Story / iMessage sized)
2. Streak indicator gets a visible "Streak" label + at-risk/countdown state
3. Score becomes an action pointer: milestone microcopy near the ring, plus a pending-intro banner as the primary on-screen prompt when applicable
4. "Top Matchmaker" badge recolored off coral (coral reserved for score/CTA only)
5. XP bar gets a "Level Progress" label, distinct from the ring above it
6. Floating "+" FAB gets proper clearance from the tab bar icon beneath it
7. All three badge pills unified to one variant (outline), varying only by tone

Priority order per user: share button first, then streak fix + action microcopy, then visual cleanup (items 4–7).

## Data model (mock)

Continues the phase 1 convention: flat mock constants, no invented formulas, `TODO` comments pointing at future real tables.

`components/profile/mockProfile.ts`:

```ts
export interface MatchmakerRankProgress {
  tier: "Wingperson" | "Setup Artist" | "Cupid" | "Matchmaker Legend";
  level: number;
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
  streakAtRisk: boolean;        // NEW
  streakResetsInDays: number;   // NEW — only meaningful when streakAtRisk is true
}

export const MOCK_RANK_PROGRESS: MatchmakerRankProgress = {
  tier: "Cupid",
  level: 4,
  xpCurrent: 340,
  xpForNextLevel: 500,
  streakWeeks: 3,
  streakAtRisk: true,
  streakResetsInDays: 1,
};

// NEW — precomputed nudge copy. Not derived from a formula; same convention
// as score/percentileLabel above. TODO: replace once real progression math exists.
export const MOCK_NEXT_MILESTONE_COPY = "2 more intros to reach 100";
```

`MOCK_BADGES` retoned (items 4 + 7):

```ts
export const MOCK_BADGES: MatchmakerBadge[] = [
  { id: "1", label: "Top Matchmaker", tone: "butter", variant: "outline" },
  { id: "2", label: "5 Intros Sent", tone: "plum", variant: "outline" },
  { id: "3", label: "3 Matches Made", tone: "mint", variant: "outline" },
];
```

**Pending intro prompt** reuses the existing `MOCK_SENT_INTROS` from `components/intros/mockSentIntros.ts` (no new mock file) — it already carries `status: "pending" | "matched"`, both names, and `sentAt`. This is the matchmaker's own aggregate view of their sent intros, already surfaced identically on the Intros tab, so reusing it here doesn't cross the matchmaker-firewall rule (no accept/pass/read detail leaks). `app/(tabs)/profile.tsx` computes:

```ts
const pendingIntro = MOCK_SENT_INTROS.find((i) => i.status === "pending");
```

and passes it to `MatchmakerPanel` as an optional prop. Only the single most-recent pending intro is shown (first match, matching the array's existing newest-first ordering) — no need to handle multiple simultaneously per the "fire and forget, keep it simple" product ethos.

## Component changes

### `RankProgressBar.tsx` — streak label + at-risk state (item 2), bar label (item 5)

- New props: `streakAtRisk: boolean`, `streakResetsInDays: number`.
- Add a `LEVEL PROGRESS` eyebrow caption (DM Mono, uppercase, `ink[500]`, same style family as the "Matchmaker Score" eyebrow) above the existing `"{xpCurrent} / {xpForNextLevel} XP TO NEXT LEVEL"` row, so the bar reads as a distinct element from the ring above it rather than a second unlabeled progress indicator.
- Streak readout gains a `STREAK` mono caption next to the flame+count (currently just an icon + bare number, which is the bug being fixed).
- When `streakAtRisk` is true: wrap the streak group in a `coral[100]` pill background with `coral[600]` text/icon, and append `· ENDS IN {streakResetsInDays} DAY{s}` to the caption. This is a static style/copy change only — no new animation, consistent with the app's existing restraint around non-celebratory moments (e.g. silent pass).
- When `streakAtRisk` is false: unchanged neutral treatment (ink-900 text, coral-500 flame), just with the new `STREAK` word added.

### `MatchmakerPanel.tsx` — action microcopy, pending banner, share entry point (items 1, 3), badge render (item 7 is data-only, no component change needed since `Badge` already supports `variant`/`tone` props)

- New props: `nextMilestoneCopy: string`, `pendingIntro?: SentIntro`.
- New small subcomponent `PendingIntroBanner` (inline in this file, not its own file — it's ~10 lines of JSX, doesn't warrant a new file): renders above the score card when `pendingIntro` is present. Plum-100 background card, one line: `"Your intro for {personAName} & {personBName} is still awaiting a reply"`, second line in `ink-500`: `"Sent {formatRelativeTime(sentAt)}"` (reusing `lib/format.ts`'s existing `formatRelativeTime`). Not a button — no `onPress` — since there is nothing actionable, only informational, consistent with the matchmaker-firewall rule that nothing beyond "both accepted" is ever exposed.
- Below `MatchmakerScoreRing`, add a centered microcopy line rendering `nextMilestoneCopy` (DM Sans medium, `coral[600]`, small) — always shown regardless of `pendingIntro`, giving the ring a persistent reason-to-act.
- New share icon button (top-right of the score card's header row, next to the "Matchmaker Score" eyebrow) — hand-drawn SVG share glyph (upload-arrow-into-tray shape, matching the app's existing convention of inline SVG icons with no icon library), `ink[500]` stroke. `onPress` fires a light haptic and opens `ShareScoreModal` via local `useState<boolean>`.

### `components/profile/MatchmakerShareCard.tsx` (new) — the branded visual

Pure presentational component, props: `score: number`, `rankTier: string`, `rankLevel: number`, `percentileLabel: string`, `badges: MatchmakerBadge[]`.

- Root `View`, fixed 1080×1920 logical size (rendered at a scaled-down preview size on screen; actual capture forces this resolution via `ViewShot`'s `width`/`height` options — see below), `LinearGradient` background using `gradients.dusk`, corner radius `xl`.
- Top: `WingMark` (white variant) + `MATCHMAKER SCORE` eyebrow (DM Mono, white, uppercase, letter-spaced).
- Center: score number in Bricolage bold, white, ~96px equivalent (scaled proportionally to the 1080-wide canvas), `"{rankTier} · Lvl {rankLevel}"` subtitle beneath in DM Sans medium, white 70% opacity.
- Below: `percentileLabel` text, white, centered.
- Badge row: simple translucent-white (`rgba(255,255,255,0.18)`) pill chips with white text, one per badge label — deliberately not reusing the in-app `Badge` component's tonal palette, since butter/plum/mint tones would lose contrast against the coral→plum gradient background. This is a distinct visual context (a marketing/share artifact), not in-app UI.
- Footer: small "wing" wordmark/tagline, white 50% opacity.

### `components/profile/ShareScoreModal.tsx` (new)

- Full-screen `Modal` (`animationType="slide"`, `transparent` false), dark scrim background.
- Holds a `useRef` for `ViewShot` wrapping a preview-sized render of `MatchmakerShareCard` (on-screen size: `width: Math.min(300, screenWidth - 64)`, height computed at the 9:16 ratio — `ViewShot`'s explicit `options={{ width: 1080, height: 1920, quality: 1 }}` forces the captured PNG to the target resolution independent of on-screen preview size, so the preview can render smaller/cheaper while the shared image stays full-res).
- "Share" button (coral-500 fill, matching the existing `Button` component) — on press: capture via `viewShotRef.current.capture()`, then `Sharing.shareAsync(uri)`. Button shows a spinner in place of its label while capturing (typically sub-second, but the UI accounts for it since capture is async).
- Close (X) icon top-right, dismisses the modal without sharing.
- If `Sharing.isAvailableAsync()` resolves false (rare, some Android configs) or the capture/share call rejects, the modal simply stays open with no crash — no toast/alert needed for this first pass, this is a genuine edge case with no realistic repro path on the target platforms (iOS primary, per `app.json`'s `supportsTablet`/no explicit Android-only concerns).

### `app/(tabs)/profile.tsx`

- Import `MOCK_SENT_INTROS` from `components/intros/mockSentIntros`, `MOCK_NEXT_MILESTONE_COPY` from `mockProfile`.
- Compute `pendingIntro` as shown above.
- Pass `nextMilestoneCopy={MOCK_NEXT_MILESTONE_COPY}` and `pendingIntro={pendingIntro}` to `MatchmakerPanel`.

### `components/home/TabBar.tsx` — FAB clearance (item 6)

- `FAB_OVERHANG` changes from `28` to `44`. This gives ~13pt of clearance between the FAB's bottom edge and the tab icon centered beneath it in the pill (currently ~9px, effectively overlapping at the FAB's widest point). `TAB_BAR_CLEARANCE` is derived from this constant and already consumed by every tab screen's `ScrollView` bottom padding, so no other file needs to change for scroll clearance to stay correct.

## New dependencies

- `react-native-view-shot` — captures the share card view as a PNG.
- `expo-sharing` — opens the native share sheet (Instagram Stories, Messages, Save Image, etc. all surface automatically; no per-destination code).

Both require a native rebuild (Expo dev client / EAS build) rather than working in bare Expo Go — same constraint the codebase already documents/works around for `expo-image-picker` in `profile.tsx`'s defensive `require`. No defensive try/catch wrapper is needed for these two, though, since they're pure JS-facing APIs without a TurboModule crash risk like the image picker comment describes — a plain static `import` is fine.

## Edge cases

- `pendingIntro` absent (no pending sent intros): banner doesn't render, milestone microcopy is the only action-pointer shown. This is the common case for a brand-new matchmaker with `MOCK_HAS_SENT_INTROS: false` too — banner logic short-circuits on `undefined` cleanly.
- `streakWeeks === 0` combined with `streakAtRisk: true`: still renders (a first-time streak literally about to lapse before it starts is a valid, if unusual, mock state) — no special case needed.
- Share modal opened, then the score ring's tap-to-flip animation elsewhere on screen: independent local state, no interaction between the two.
- Badge row with 0 badges: unchanged existing behavior (`badges.length > 0` guard already in `MatchmakerPanel`).

## Testing / verification

No automated test runner in this repo (per phase 1 spec, still true). Verification is:

1. `npm run typecheck` and `npm run lint` — both must pass.
2. Manual verification in the running app (Expo dev client, since `react-native-view-shot` needs a native rebuild — plain `npx expo start` / Expo Go will not load this screen once the dependency is added):
   - Streak shows "STREAK" label; toggling `streakAtRisk` in the mock shows the coral-100 at-risk pill + countdown copy.
   - Milestone microcopy renders under the ring; pending-intro banner renders above the score card when `MOCK_SENT_INTROS` has a pending entry, and disappears when it doesn't.
   - Tapping the share icon opens the modal, previews the branded card correctly on the cream background behind the scrim, "Share" opens the native share sheet with a real image attached (verify by actually sending it to Messages or saving to Photos).
   - Badge pills render as three outline chips (butter / plum / mint), none filled, none coral.
   - XP bar shows "LEVEL PROGRESS" label distinct from the ring.
   - Floating "+" FAB no longer visually touches/overlaps the tab icon beneath it; scroll-to-bottom clearance on all four tab screens still looks correct (no clipped content).
