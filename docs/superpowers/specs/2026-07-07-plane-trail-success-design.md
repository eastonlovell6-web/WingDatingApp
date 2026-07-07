# Plane Trail Success Animation — Design

## Context

Reference material: a screen recording of a course app's lesson-loading transition (a mascot blob with a color-cycling gradient "contrail" pill above it, blinking/breathing while loading, smiling and fading out as content resolves).

Wing already has a success animation in the exact slot this is meant for: `app/(auth)/verify.tsx` plays an orbit-loop/contrail animation after the 6th OTP digit is verified, then navigates to `/(auth)/intent`. That animation is being **replaced entirely** by a new one recreating the reference's visual language — a flying plane leaving a colored trail — reskinned to Wing's brand (WingMark plane icon, Sunset gradient, no character face).

## Component & data flow

New component: `components/auth/PlaneTrailSuccess.tsx` (new `/components/auth` folder for auth-flow-specific animated components, separate from generic `/components/ui`).

```tsx
<PlaneTrailSuccess
  visible={showSuccess}
  originX={headerX}
  originY={headerY}
  onFinished={() => router.replace("/(auth)/intent")}
/>
```

Responsibilities split:
- **`verify.tsx`** (unchanged responsibilities): measures the header WingMark position via `headerMarkRef.current?.measureInWindow(...)`, sets `showSuccess = true` on successful `verifyOtp`, fires the initial success haptic (`Haptics.notificationAsync(Success)`). Owns navigation via the `onFinished` callback.
- **`PlaneTrailSuccess`** (new, self-contained): owns all shared values, the three-phase animation sequence, the idle bob loop, and calls `onFinished` via `scheduleOnRN` once the sequence completes.

This deletes the current orbit-loop/contrail implementation in `verify.tsx`: the `ORBIT_*` constants, `orbitPt`/`TAIL_D`/`TAIL_HOT_D` helpers, `successProgress`/`planeScale` shared values, `triggerSuccessAnimation`, `finishSuccess`, `contentFadeStyle`/`headerMarkHideStyle`/`flyerStyle`/`orbitStyle`/`tintStyle`, and the entire `showSuccess` render block (dotted flight path, contrail SVG, free-flying plane, "You're in." text). `verify.tsx` keeps: OTP input UI, `headerMarkRef` + measurement, `handleVerify`, and now renders `<PlaneTrailSuccess />` instead.

## Visual structure

- **Trail**: a vertical pill (rounded rect, pill-radius on the width) rendered as a `LinearGradient`, colored with brand-approved hues only — solid coral-500 near the plane's current position, fading up through blush-300 to fully transparent at the top anchor. This reads as a contrail: hot near the "engine," fading into the distance. (This reverses the literal "Sunset" token order — coral→blush top-to-bottom — for the contrail-fade effect, while staying within the same two brand colors.)
- No blur/soft-glow edges — the reference uses a gaussian-blurred edge on the pill, but Wing has no precedent for that treatment anywhere else (it favors flat shapes + warm-tinted shadows). The trail renders as a clean-edged pill. This is a deliberate, acknowledged simplification versus the literal reference.
- **Plane**: existing `WingMark` component at `LARGE_PLANE` = 56px. No added face or expression — personality is carried by motion, not by a character face, consistent with WingMark being an icon/logo mark elsewhere in the app.
- **Trail width**: ~64px (wider than the plane, so the plane visually nests near the base of the beam) — mirrors the reference's proportions where the pill was wider than the mascot.

## Animation timeline

Total: ~2.6s of active animation + 450ms hold before navigating (matches current animation's overall pacing, ~2.8-3s).

1. **Descend (~650ms)**: Plane leaves the header WingMark position (`originX`/`originY`) and flies down the vertical screen-center to a rest point at `H * 0.42`. The trail pill grows from a fixed top anchor (just below the header) down to the plane's current position in lockstep — the plane appears to "paint" its own trail as it falls. Easing: `Easing.out(Easing.quad)`, matching the existing descend phase's feel.
2. **Idle / loading beat (~1300ms)**: Plane rests at `H * 0.42`; the trail is fully drawn and holds static. The plane does a gentle bob + tilt idle loop — reusing the exact idle motion language already established in `SendingView` (`app/(auth)/index.tsx`): `translateY` oscillating ±4px, small rotate oscillation, both via `withRepeat(withSequence(withTiming(...), withTiming(...)), -1, false)` with `Easing.inOut(Easing.sin)`, 500ms per leg. This stands in for the reference's blink/smile beats — Wing's version signals "still working" through motion, not expression.
3. **Resolve (~600ms)**: Plane and trail fade out together (`opacity` interpolation to 0). "You're in." fades in centered at the same position/font treatment as the current implementation (`fonts.display`, 36px, `ink[900]`). After a 450ms hold, `onFinished` fires.

Haptics: unchanged from today — `Haptics.notificationAsync(Success)` fires when `triggerSuccessAnimation`-equivalent logic starts (in `verify.tsx`, on OTP success), and a `Haptics.impactAsync(Light)` fires right before calling `onFinished`. No new haptic beats are added during the idle loop.

## Edge cases

- If the OTP verify fails after `showSuccess` was never set, nothing changes — existing error-handling in `verify.tsx` is untouched.
- Component unmount/cleanup: `PlaneTrailSuccess` must cancel all shared-value animations (`cancelAnimation`) on unmount, matching the existing cleanup pattern in `verify.tsx`'s `useEffect` return and `SendingView`'s cleanup.
- Screen dimensions: reads `useWindowDimensions()` internally (like the current implementation) so the rest position and trail geometry adapt to device size.

## Testing / verification

No automated test suite covers animation timing in this codebase today (verified by scanning for `.test.` files under `app/(auth)` — none exist). Verification will be manual: run the app, complete OTP verification, and visually confirm the descend → idle bob → resolve → navigate sequence, matching the timeline above, on both a physical run and the simulator if available.
