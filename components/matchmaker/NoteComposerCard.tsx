import { Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";

interface NoteComposerCardProps {
  value: string;
  onChangeText: (text: string) => void;
}

/**
 * Editable twin of IntroNoteCard — same sunset-gradient treatment, but the
 * body is a live TextInput so what the matchmaker types is exactly what
 * recipients will see. Kept separate from IntroNoteCard (read-only display)
 * since the two own different concerns.
 */
export function NoteComposerCard({ value, onChangeText }: NoteComposerCardProps) {
  return (
    <View style={[elevation.sm, { flex: 1 }]}>
      <LinearGradient
        colors={gradients.sunset}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          borderRadius: radii.xl,
          padding: spacing[8],
          overflow: "hidden",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize.xs[0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#FFFFFF",
          }}
        >
          YOUR INTRO NOTE
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Write something that sounds like you…"
          placeholderTextColor="rgba(255,255,255,0.6)"
          multiline
          autoFocus
          cursorColor="#FFFFFF"
          style={{
            marginTop: spacing[4],
            flex: 1,
            fontFamily: fonts.display,
            fontSize: fontSize["2xl"][0],
            lineHeight: fontSize["2xl"][1],
            color: "#FFFFFF",
            textAlignVertical: "top",
          }}
        />
      </LinearGradient>
    </View>
  );
}

export default NoteComposerCard;
