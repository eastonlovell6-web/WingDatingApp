# Wing

A mobile dating app where every match starts with a mutual friend. No swiping on strangers, no cold matches: someone you already know has to introduce you first.

## The idea

Wing replaces the anonymous swipe deck with two friend-mediated flows:

- **Matchmaker:** a friend picks two people they know, writes a short note, and sends an introduction. Both people see the note and each other's profile and accept independently. If either passes, nothing happens and no one is told.
- **Request:** a user browses friends-of-friends only, never a global pool, and asks a specific mutual friend to make the introduction.

Chat only unlocks once both sides of an introduction accept.

## Product rules

A few decisions came directly out of early user interviews and are enforced server-side, not just in the UI:

- **Silent rejection:** passing on an intro never notifies anyone. No "they passed," no confirmation.
- **Matchmaker firewall:** once an intro is sent, the matchmaker gets exactly one follow-up notification (both sides accepted) and nothing else. No visibility into chat, no read status.
- **Sub-60-second matchmaker flow:** pick two friends, write a note, send. No required follow-up.
- **Max 3 pending intros per user**, enforced server-side.
- **No read receipts anywhere** in the app.

## Stack

- React Native + Expo Router, TypeScript
- NativeWind (Tailwind for React Native)
- Zustand for client state, TanStack Query for server state
- Supabase: Postgres with Row Level Security, phone/OTP auth, Edge Functions, Storage, Realtime

Logic that has to be trusted (sending an intro, enforcing the pending-intro cap, expiring stale intros, building the friends-of-friends discovery graph) lives in Supabase Edge Functions rather than the client. SQL migrations under `supabase/sql` track schema and RLS policy changes alongside it.

## Running it locally

Requires a Supabase project with Postgres, Auth, Edge Functions, and Storage enabled, plus the Expo CLI.

```bash
npm install

# .env.local
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

npx expo start
```

Phone auth, push notifications, and the introduction/matchmaker Edge Functions each need their own setup on the Supabase side; see `supabase/functions` and `supabase/sql`.

## Status

In active development, currently tested through Expo Go rather than a store build. Built solo, one screen at a time, with each screen going through a design critique pass before the next one started.
