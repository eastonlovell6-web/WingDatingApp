import { View } from "react-native";
import { EmptySentIntrosState } from "./EmptySentIntrosState";
import { SentIntroRow } from "./SentIntroRow";
import type { SentIntro } from "./mockSentIntros";
import { spacing } from "../../constants/spacing";

interface SentIntroListProps {
  intros: SentIntro[];
  onMakeIntroPress?: () => void;
}

export function SentIntroList({ intros, onMakeIntroPress }: SentIntroListProps) {
  if (intros.length === 0) {
    return <EmptySentIntrosState onMakeIntroPress={onMakeIntroPress} />;
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {intros.map((intro, index) => (
        <SentIntroRow key={intro.id} intro={intro} index={index} />
      ))}
    </View>
  );
}

export default SentIntroList;
