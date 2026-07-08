import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { SentIntro } from "./mockSentIntros";

interface SentIntroStatsProps {
  intros: SentIntro[];
}

const COUNT_UP_DURATION_MS = 500;

// Counts up from 0 to `target` once on mount — a ref (not a dependency)
// holds the target so a later re-render with the same/different number
// (e.g. pull-to-refresh) never replays the animation.
function useCountUp(target: number) {
  const [value, setValue] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    const finalValue = targetRef.current;
    if (finalValue <= 0) {
      setValue(finalValue);
      return;
    }

    let startTime: number | null = null;
    let frame: number;

    function tick(now: number) {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / COUNT_UP_DURATION_MS, 1);
      setValue(Math.round(progress * finalValue));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return value;
}

function StatTile({
  value,
  label,
  color,
  footnote,
}: {
  value: number;
  label: string;
  color?: string;
  footnote?: string;
}) {
  const displayValue = useCountUp(value);

  return (
    <View style={{ gap: 2 }}>
      <Text style={color ? [textStyles.stat, { color }] : textStyles.stat}>{displayValue}</Text>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize["2xs"][0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: ink[500],
        }}
      >
        {label}
      </Text>
      {footnote && (
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize["2xs"][0], color: ink[500] }}>
          {footnote}
        </Text>
      )}
    </View>
  );
}

export function SentIntroStats({ intros }: SentIntroStatsProps) {
  const sentCount = intros.length;
  const matchedCount = intros.filter((intro) => intro.status === "matched").length;

  return (
    <View style={{ flexDirection: "row", gap: spacing[8] }}>
      <StatTile
        value={matchedCount}
        label="Matched"
        color={coral[500]}
        footnote={matchedCount > 0 ? "Not bad, cupid." : undefined}
      />
      <StatTile value={sentCount} label="Intros sent" />
    </View>
  );
}

export default SentIntroStats;
