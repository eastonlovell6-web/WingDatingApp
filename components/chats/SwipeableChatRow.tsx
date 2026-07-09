import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { ChatRow } from "./ChatRow";
import { ArchiveIcon, MuteIcon, TrashIcon } from "./ChatRowActionIcons";
import { butter, coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import type { ChatPreview } from "./mockChats";

const ACTION_WIDTH = 70;
const ACTIONS_TOTAL_WIDTH = ACTION_WIDTH * 3;

interface SwipeableChatRowProps {
  chat: ChatPreview;
  index: number;
  openRowRef: React.MutableRefObject<Swipeable | null>;
  onRemove: (id: string) => void;
}

export function SwipeableChatRow({ chat, index, openRowRef, onRemove }: SwipeableChatRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const [isOpen, setIsOpen] = useState(false);

  function handleWillOpen() {
    if (openRowRef.current && openRowRef.current !== swipeableRef.current) {
      openRowRef.current.close();
    }
    openRowRef.current = swipeableRef.current;
  }

  function handleClose() {
    setIsOpen(false);
    if (openRowRef.current === swipeableRef.current) {
      openRowRef.current = null;
    }
  }

  function handleRowPress() {
    if (isOpen) {
      swipeableRef.current?.close();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${chat.id}` as never);
  }

  function handleMute() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    swipeableRef.current?.close();
  }

  function handleArchive() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (openRowRef.current === swipeableRef.current) {
      openRowRef.current = null;
    }
    onRemove(chat.id);
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (openRowRef.current === swipeableRef.current) {
      openRowRef.current = null;
    }
    onRemove(chat.id);
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={1}
      overshootRight={false}
      rightThreshold={ACTIONS_TOTAL_WIDTH / 2}
      animationOptions={{ speed: 20, bounciness: 0 }}
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableOpen={() => setIsOpen(true)}
      onSwipeableClose={handleClose}
      renderRightActions={() => (
        <View style={{ flexDirection: "row" }}>
          <ActionButton label="Mute" color={butter[700]} onPress={handleMute}>
            <MuteIcon />
          </ActionButton>
          <ActionButton label="Archive" color={ink[700]} onPress={handleArchive}>
            <ArchiveIcon />
          </ActionButton>
          <ActionButton label="Delete" color={coral[600]} onPress={handleDelete}>
            <TrashIcon />
          </ActionButton>
        </View>
      )}
    >
      <ChatRow chat={chat} index={index} onPress={handleRowPress} />
    </Swipeable>
  );
}

function ActionButton({
  label,
  color,
  onPress,
  children,
}: {
  label: string;
  color: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: ACTION_WIDTH,
          height: "100%",
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {children}
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize["2xs"][0], color: "#FFFFFF" }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default SwipeableChatRow;
