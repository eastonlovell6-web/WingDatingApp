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
