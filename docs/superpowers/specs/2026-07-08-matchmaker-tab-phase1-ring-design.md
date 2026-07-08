# Matchmaker Tab Redesign — Phase 1: Score Ring, Count-Up, Flip-to-Rank, XP Bar, Streak

## Context

The Profile screen's Matchmaker tab (`components/profile/MatchmakerPanel.tsx`, rendered from `app/(tabs)/profile.tsx`) currently shows a flat score card: an eyebrow label, a static number, and a percentile caption. The user wants a broader redesign of this tab across five roughly-independent subsystems:

1. **Score ring + count-up + flip-to-rank + XP bar + streak** (this spec)
2. Bell-curve distribution graphic replacing the plain percentile caption
3. 10-week score sparkline + Sent→Accepted→Matched→Still-Talking funnel
4. Interactive badge pills (progress rings on unearned badges, confetti + share-to-story on newly earned ones)
5. Social layer: friend-circle leaderboard by Matches Made + head-to-head comparison cards

Per the project's "one screen at a time" build philosophy, these are being decomposed into five phases, built and reviewed in this priority order. This spec covers **Phase 1 only**. Phases 2–5 are out of scope here and will get their own specs.

All new visuals must stay within the existing palette (coral, plum, cream/ink neutrals, plus mint/butter/blush accents already defined in `constants/colors.ts`) — no new hues.

## Data model (mock)

No backend change in this phase. `matchmaker_stats` in Supabase only has `intros_sent`/`intros_accepted` — there is no score, rank, XP, or streak column, and `score`/`percentileLabel` are already flat `MOCK_MATCHMAKER_STATS` constants in `components/profile/mockProfile.ts` with `TODO` comments pointing at a future real table. This phase follows the same convention: add a new flat mock constant rather than deriving anything from a formula.

```ts
export interface MatchmakerRankProgress {
  tier: "Wingperson" | "Setup Artist" | "Cupid" | "Matchmaker Legend";
  level: number;        // level within the tier, e.g. 4 — illustrative, not formula-derived
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;  // consecutive weeks with >=1 intro sent
}

export const MOCK_RANK_PROGRESS: MatchmakerRankProgress = {
  tier: "Cupid",
  level: 4,
  xpCurrent: 340,
  xpForNextLevel: 500,
  streakWeeks: 3,
};
```

Tier order (low → high): Wingperson → Setup Artist → Cupid → Matchmaker Legend. Tier/level/XP/streak are independent mock fields for now, not algorithmically derived from `score` (which stays a separate flat mock value as it is today). A `TODO` comment in `mockProfile.ts` notes this gets formalized once real progression data exists server-side — do not invent a scoring formula in this phase.

`app/(tabs)/profile.tsx` imports `MOCK_RANK_PROGRESS` alongside the existing `MOCK_MATCHMAKER_STATS` and passes it down to `MatchmakerPanel`, same prop-drilling pattern already in place. No new state management is introduced — the flip interaction is local UI state inside the ring component and does not need to persist across remounts.

## Component architecture

Two new components in `components/profile/`:

- **`MatchmakerScoreRing.tsx`** — the SVG ring, count-up number, and tap-to-flip rank title. Props: `score: number` (0–100), `rankTier: string`, `rankLevel: number`.
- **`RankProgressBar.tsx`** — the XP bar + streak flame row beneath the ring. Props: `xpCurrent: number`, `xpForNextLevel: number`, `streakWeeks: number`.

`MatchmakerPanel.tsx` replaces its current flat score card `View` block with:

```tsx
<MatchmakerScoreRing score={score} rankTier={rankProgress.tier} rankLevel={rankProgress.level} />
<RankProgressBar
  xpCurrent={rankProgress.xpCurrent}
  xpForNextLevel={rankProgress.xpForNextLevel}
  streakWeeks={rankProgress.streakWeeks}
/>
```

`MatchmakerPanelProps` gains a `rankProgress: MatchmakerRankProgress` field. Everything below the score card — the stat tiles / empty-state nudge, and badge pills — is unchanged in this phase.

## Ring gauge + count-up mechanics

Built entirely on `react-native-svg` (already a dependency; already used elsewhere in the app for icons, e.g. `WingMark.tsx`, `TabGlyphs.tsx`) and Reanimated (already a dependency). No new dependency is added — a Skia/Canvas-based gauge was considered and rejected purely to avoid pulling in a new, heavy dependency for something SVG already handles well.

- Two stacked `Circle` elements: a static track circle in a faint neutral (`ink[200]`), and an animated progress circle on top.
- Progress circle strokes with a linear gradient from coral-500 to plum-500 — reusing the `gradients.dusk` stop colors already defined in `constants/colors.ts`, applied via an SVG `<Defs><LinearGradient>`.
- Percentage fill is done via `strokeDasharray` / `strokeDashoffset` against the circle's circumference, animated with `useAnimatedProps` on `Animated.createAnimatedComponent(Circle)`. This is the first use of `createAnimatedComponent` in the codebase but is the standard, well-documented Reanimated pattern for this effect.
- The SVG is rotated -90° so the sweep starts at 12 o'clock and proceeds clockwise.
- Fill animates from 0 → `score`% via a single `withTiming` call, ~1100ms, ease-out, starting on mount.

**Count-up number**, synced to finish exactly when the ring does:
- Uses the standard Reanimated "animated `TextInput`" counter pattern: `Animated.createAnimatedComponent(TextInput)`, `editable={false}`, `caretHidden`, no visible input chrome — styled to be visually identical to the current static `Text` (Bricolage Grotesque, `fontSize['6xl']`, coral-500).
- `useAnimatedProps` sets `text: Math.round(progress.value * score).toString()` every frame, driven on the UI thread — no per-frame JS re-render.

## Tap-to-flip (3D card flip)

- The ring's center content sits in a wrapping `View` with `perspective: 800`.
- Two absolutely-stacked child views: front face (count-up score) and back face (`"{tier}, Lvl {level}"`, same display font/size/color as the score).
- A shared value drives `rotateY` 0° → 180° via `withTiming` (~450ms) on tap. Each face uses `backfaceVisibility: 'hidden'`, with an opacity/display swap at the 90° midpoint so neither face renders mirrored mid-flip.
- Tapping toggles back and forth (0° ⇄ 180°) on each subsequent tap.
- The tap target is disabled until the initial count-up animation completes (~1100ms after mount), so the fill animation is never interrupted by an early tap.
- `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` fires on each flip, matching the tap-feedback convention already used elsewhere in this panel (segmented control, "Make your first intro" button).

## XP bar + streak (`RankProgressBar`)

- A thin track (~6px tall, pill radius) in `surface.creamDeep`, filled portion in coral-500, width animated via `withTiming` (~700ms ease-out) representing `xpCurrent / xpForNextLevel`. This animation starts right after the ring's fill settles (chained, not simultaneous), so the two don't visually compete.
- A caption above the bar in DM Mono, uppercase, `ink[500]`, matching the "eyebrow" style already used for "Matchmaker Score": `"{xpCurrent} / {xpForNextLevel} XP TO NEXT LEVEL"`.
- The streak sits inline on the same row as the caption (right-aligned): a small flame glyph (inline SVG path, coral-500 fill, ~14px) followed by the streak count in DM Mono medium, e.g. `"3"`. This is a static readout — no entrance animation needed.

## Integration / render order in `MatchmakerPanel`

```
<MatchmakerScoreRing ... />
<RankProgressBar ... />
{hasSentIntros ? <StatTiles /> : <EmptyMatchmakerNudge />}   // unchanged
{badges.length > 0 && <BadgePills />}                          // unchanged
```

Because `app/(tabs)/profile.tsx` remounts the active tab's panel via `<Animated.View key={activeIndex} entering={FadeIn} ...>`, switching away from and back to the Matchmaker tab naturally remounts `MatchmakerScoreRing`, replaying the fill/count-up animation each time. No extra "replay on focus" logic is needed.

## Edge cases

- Tap during the initial fill animation is a no-op (button disabled), not queued — a tap during this window is simply ignored.
- Unmount mid-animation: any running Reanimated animations on shared values must be cancelled via `cancelAnimation` in a cleanup effect, matching the pattern already used in `PlaneTrailSuccess`/`SendingView` elsewhere in the app.
- `score` of 0: ring renders with zero sweep (track circle only, no visible progress arc) and the count-up starts and ends at "0" — no special-cased empty state needed since the existing `hasSentIntros` flag already handles the true empty-history case with `EmptyMatchmakerNudge`.

## Testing / verification

No automated test runner is configured in this repo (no jest, no `.test.` files anywhere in the tree). Verification is:
1. `npm run typecheck` and `npm run lint` — both must pass.
2. Manual verification in the running app (Expo): confirm the ring fills smoothly with the coral→plum gradient, the count-up number lands exactly on the mock score when the ring finishes, tapping flips to the rank title and back with correct haptics, the XP bar fills to the right proportion after the ring settles, the streak flame + count render correctly, and switching tabs away and back replays the whole sequence cleanly. Check against the cream (`surface.cream`) background in the actual color scheme — no dark-mode variant exists in this app.
