export interface Prompt {
  id: string;
  text: string;
  keywords: string[];
}

// Hand-written, one shown per calendar day (see getTodaysPrompt below) —
// never AI-generated, same rule as intro notes. Keywords are lowercase and
// matched as whole words against friends' bio prompt text in
// lib/promptMatch.ts.
export const PROMPTS: Prompt[] = [
  { id: "1", text: "Who's the funniest single friend you know?", keywords: ["funny", "comedian", "jokes"] },
  { id: "2", text: "Which friend gives the best relationship advice they never take themselves?", keywords: ["advice", "relationship"] },
  { id: "3", text: "Who's the friend that's way too good at first dates?", keywords: ["dating", "dates"] },
  { id: "4", text: "Who do you know that's secretly a hopeless romantic?", keywords: ["romantic"] },
  { id: "5", text: "Which friend always has the best restaurant recommendations?", keywords: ["food", "restaurant", "foodie"] },
  { id: "6", text: "Who's the friend everyone agrees deserves someone great?", keywords: ["deserves"] },
  { id: "7", text: "Which friend is weirdly competitive about board games?", keywords: ["games", "competitive"] },
  { id: "8", text: "Who's your most outdoorsy single friend?", keywords: ["outdoorsy", "hiking", "outdoors", "ski"] },
  { id: "9", text: "Which friend can talk about music for hours?", keywords: ["music", "concerts"] },
  { id: "10", text: "Who's the friend that makes any road trip better?", keywords: ["road", "travel"] },
  { id: "11", text: "Which friend has the best taste in coffee shops?", keywords: ["coffee"] },
  { id: "12", text: "Who's the friend who always says yes to spontaneous plans?", keywords: ["spontaneous", "adventurous"] },
  { id: "13", text: "Which friend would absolutely crush a trivia night?", keywords: ["trivia"] },
  { id: "14", text: "Who's the friend that's a genuinely amazing cook?", keywords: ["cooking", "cook"] },
  { id: "15", text: "Which friend has the best book recommendations?", keywords: ["books", "reading"] },
  { id: "16", text: "Who's the friend who's low-key hilarious in a group chat?", keywords: ["funny", "hilarious"] },
  { id: "17", text: "Which friend is a genuinely great listener?", keywords: ["listener", "thoughtful"] },
  { id: "18", text: "Who's the friend that's always down for a workout?", keywords: ["gym", "workout", "fitness"] },
  { id: "19", text: "Which friend has surprisingly good karaoke skills?", keywords: ["karaoke", "singing"] },
  { id: "20", text: "Who's the friend that gives the warmest hugs?", keywords: ["warm", "kind"] },
  { id: "21", text: "Which friend is quietly one of the most ambitious people you know?", keywords: ["ambitious", "career"] },
  { id: "22", text: "Who's the friend who remembers literally everyone's birthday?", keywords: ["thoughtful", "birthday"] },
  { id: "23", text: "Which friend has the best pickup-game energy — pickleball, basketball, you name it?", keywords: ["pickleball", "basketball", "sports"] },
  { id: "24", text: "Who's the friend that's a total sucker for a good sunset?", keywords: ["sunset", "outdoors"] },
];

/**
 * One global prompt per calendar day — day-of-year (0-indexed, local time)
 * modulo the bank size. No stored rotation state, no per-user variation.
 */
export function getTodaysPrompt(date: Date = new Date()): Prompt {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  return PROMPTS[dayOfYear % PROMPTS.length];
}
