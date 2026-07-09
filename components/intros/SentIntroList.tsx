import { View } from "react-native";
import { EmptySentIntrosState } from "./EmptySentIntrosState";
import { SentIntroRow } from "./SentIntroRow";
import type { SentIntro } from "./mockSentIntros";
import { spacing } from "../../constants/spacing";

interface SentIntroListProps {
  intros: SentIntro[];
  onMakeIntroPress?: () => void;
  onNudge?: (intro: SentIntro) => void;
  onWithdraw?: (intro: SentIntro) => void;
}

export function SentIntroList({ intros, onMakeIntroPress, onNudge, onWithdraw }: SentIntroListProps) {
  if (intros.length === 0) {
    return <EmptySentIntrosState onMakeIntroPress={onMakeIntroPress} />;
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {intros.map((intro, index) => (
        <SentIntroRow
          key={intro.id}
          intro={intro}
          index={index}
          onNudge={onNudge}
          onWithdraw={onWithdraw}
        />
      ))}
    </View>
  );
}

export default SentIntroList;
