/**
 * Push copy for the message-notification path (not yet wired to a Supabase
 * Edge Function). Wing always names the person, never generic "new message"
 * language — mirrors the intro-note copy rule ("Maya thinks you two should meet").
 */
export function formatMessageNotification(senderFirstName: string) {
  return {
    title: senderFirstName,
    body: `${senderFirstName} sent you a message`,
  };
}

/**
 * Push copy for the Matchmaker send flow (Flow 1, step 3). Simulated with a
 * local notification today since introductions aren't written to Supabase
 * and friends have no real push tokens yet — same fixture-only convention as
 * the rest of the app. Always names the matchmaker, never generic language.
 */
export function formatIntroNotification(matchmakerFirstName: string) {
  return {
    title: matchmakerFirstName,
    body: `${matchmakerFirstName} thinks you two should meet`,
  };
}
