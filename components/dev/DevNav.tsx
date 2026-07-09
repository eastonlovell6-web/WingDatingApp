import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { plum, coral, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

// Dev-only screen jumper. Mounted once in the root layout (guarded by __DEV__),
// it floats a small "DEV" tab on the right edge that opens a route list so we
// can hop straight to any built screen while building — plus ◀ ▶ steppers to
// walk back and forth through the flow in order. Never ships: the mount site
// is wrapped in `{__DEV__ && ...}`, so this whole tree is stripped in release.

type Route = { label: string; href: string };

// Only screens that actually exist as route files — jumping to an unbuilt
// route would throw. Ordered to mirror the real onboarding → app flow so the
// ◀ ▶ steppers read as "previous / next screen".
const ROUTES: Route[] = [
  { label: "Landing", href: "/" },
  { label: "Phone", href: "/(auth)" },
  { label: "Intent", href: "/(auth)/intent" },
  { label: "Verify", href: "/(auth)/verify" },
  { label: "Onboarding", href: "/(auth)/onboarding" },
  { label: "Home", href: "/(tabs)" },
  { label: "Intro detail", href: "/intro/1" },
  { label: "Chats", href: "/(tabs)/chats" },
  { label: "Chat thread", href: "/chat/1" },
  { label: "Intros", href: "/(tabs)/intros" },
  { label: "Profile", href: "/(tabs)/profile" },
];

export function DevNav() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  // Tracks which screen we last jumped to so the steppers advance predictably,
  // independent of however the app itself navigated.
  const [idx, setIdx] = useState(0);

  const go = (i: number) => {
    const next = (i + ROUTES.length) % ROUTES.length;
    setIdx(next);
    // Cast: expo-router's typed-routes Href doesn't accept a plain string.
    router.push(ROUTES[next].href as never);
  };

  return (
    <>
      {/* Collapsed: a small tab on the right edge, tucked in the safe-area
          strip above screen content so it never sits on top of a card. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: insets.right + spacing[2],
          top: insets.top + spacing[4],
        }}
      >
        <Pressable onPress={() => setOpen(true)} hitSlop={8}>
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderTopLeftRadius: radii.sm,
              borderBottomLeftRadius: radii.sm,
              backgroundColor: plum[600],
              opacity: 0.9,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 11,
                letterSpacing: 1,
                color: "#FFFFFF",
              }}
            >
              DEV
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Scrim — tap anywhere off the panel to dismiss. */}
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(26,20,18,0.45)" }}
        >
          <View
            pointerEvents="box-none"
            style={{
              flex: 1,
              justifyContent: "flex-end",
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            {/* Panel — stop the scrim press so taps inside don't dismiss. */}
            <Pressable onPress={() => {}}>
              <View
                style={{
                  backgroundColor: surface.paper,
                  borderRadius: radii.xl,
                  padding: 16,
                  maxHeight: 480,
                }}
              >
                {/* Header row: label + prev/next steppers + close */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 12,
                      letterSpacing: 1,
                      color: coral[500],
                    }}
                  >
                    DEV · JUMP TO SCREEN
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Stepper label="◀" onPress={() => go(idx - 1)} />
                    <Stepper label="▶" onPress={() => go(idx + 1)} />
                    <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radii.pill,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: ink[100],
                        }}
                      >
                        <Text style={{ fontFamily: fonts.body, fontSize: 16, color: ink[700] }}>
                          ✕
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                <ScrollView>
                  {ROUTES.map((r, i) => {
                    const active = i === idx;
                    return (
                      <Pressable
                        key={r.href}
                        onPress={() => {
                          go(i);
                          setOpen(false);
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            marginBottom: 6,
                            borderRadius: radii.md,
                            backgroundColor: active ? coral[100] : surface.cream,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: fonts.bodyMedium,
                              fontSize: 16,
                              color: ink[900],
                            }}
                          >
                            {r.label}
                          </Text>
                          <Text
                            style={{
                              fontFamily: fonts.mono,
                              fontSize: 12,
                              color: ink[500],
                            }}
                          >
                            {r.href}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radii.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: plum[100],
        }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: plum[600] }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default DevNav;
