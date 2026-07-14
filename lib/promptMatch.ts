import { MOCK_FRIEND_PROFILES } from "../components/friend/mockFriendProfiles";
import type { MatchmakerFriend } from "../components/matchmaker/mockMatchmakerFriends";

function friendBioText(friendId: string): string {
  const profile = MOCK_FRIEND_PROFILES[friendId];
  if (!profile) return "";
  return profile.prompts.map((p) => `${p.question} ${p.answer}`).join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) =>
    new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`).test(lowerText)
  );
}

/**
 * Reorders friends so any whose bio prompts match at least one keyword
 * float to the top. Never filters — every friend passed in is still
 * present in the result, just reordered. Stable: friends within the same
 * match/non-match group keep their original relative order.
 */
export function sortFriendsByPromptMatch(
  friends: MatchmakerFriend[],
  keywords: string[]
): MatchmakerFriend[] {
  return [...friends].sort((a, b) => {
    const aMatches = matchesKeywords(friendBioText(a.id), keywords);
    const bMatches = matchesKeywords(friendBioText(b.id), keywords);
    if (aMatches === bMatches) return 0;
    return aMatches ? -1 : 1;
  });
}
