import type { ProfilePrompt } from "../profile/mockProfile";

// Feed-level shape — everything IntroPreviewCard/IntroFeed render for a
// pending intro. Real data comes from lib/introductions.ts's
// getIncomingIntroductions.
export interface IntroPreview {
  id: string;
  matchmakerName: string;
  matchmakerAvatarUri?: string;
  note: string;
  matchAvatarName: string;
  matchAvatarUri?: string;
}

// Adds the detail-screen-only fields (TwoPersonHeader + AboutSection). Real
// data comes from lib/introductions.ts's getIntroductionDetail.
export interface IntroDetail extends IntroPreview {
  matchAge: number;
  matchTagline: string;
  // Additional photos shown in the detail screen's expandable "About" section.
  matchPhotos: string[];
  matchPrompts: ProfilePrompt[];
}
