// Mirrors the copy rules in lib/notifications.ts. Edge Functions deploy from
// only the supabase/functions/ directory, so this can't import across that
// boundary — keep these two files hand-synced. Wing always names the
// person; never generic "someone"/"a friend" language.

export function formatIntroNotification(matchmakerFirstName: string) {
  return {
    title: matchmakerFirstName,
    body: `${matchmakerFirstName} thinks you two should meet`,
  };
}

export function formatIntroRequestNotification(requesterFirstName: string) {
  return {
    title: requesterFirstName,
    body: `${requesterFirstName} wants you to introduce them`,
  };
}

export function formatIntroAcceptedNotification() {
  return {
    title: "Wing",
    body: "Your intro was accepted by both",
  };
}

export function formatIntroNudgeNotification(matchmakerFirstName: string) {
  return {
    title: matchmakerFirstName,
    body: `${matchmakerFirstName} is still hoping you'll check out that intro`,
  };
}

export function formatMessageNotification(senderFirstName: string) {
  return {
    title: senderFirstName,
    body: `${senderFirstName} sent you a message`,
  };
}

export function formatIntroMatchedNotification(matchmakerFirstName: string) {
  return {
    title: "You're in!",
    body: `${matchmakerFirstName} introduced you two, and you're both in — say hi`,
  };
}
