/** @type {import('tailwindcss').Config} */
// Canonical design tokens live in /constants/*.ts (colors.ts, spacing.ts,
// typography.ts). tailwind.config.js cannot import those TS files (it runs in
// plain Node), so the scales below are a hand-mirror for NativeWind className
// usage. KEEP IN SYNC with /constants when tokens change.
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        coral: {
          100: "#FFE0D9",
          300: "#FF9E8C",
          500: "#FF6150",
          600: "#ED4733",
          700: "#C5331F",
        },
        plum: {
          100: "#EBDCEE",
          300: "#B48BC0",
          500: "#6E3F80",
          600: "#573166",
          700: "#43254F",
        },
        ink: {
          100: "#F1ECEA",
          200: "#E4DDDA",
          300: "#C9C0BD",
          500: "#8B7F7B",
          700: "#4A3F3C",
          900: "#1A1412",
        },
        butter: { 100: "#FBF0CE", 500: "#F5C84B", 700: "#C9991F" },
        mint: { 100: "#D8EFE2", 500: "#5FB389", 700: "#2F8F5B" },
        blush: { 100: "#F9DCE5", 300: "#F4A9C0", 500: "#ED7BA0" },
        // Surfaces + semantic aliases
        cream: "#FBF8F5",
        "cream-deep": "#F4EBE2",
        paper: "#FFFFFF",
      },
      // Design 4px step scale. Steps 8/10/12 override Tailwind defaults
      // (which would be 32/40/48) to the design's 40/64/96.
      spacing: {
        2: 8,
        4: 16,
        6: 24,
        8: 40,
        10: 64,
        12: 96,
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "22px",
        xl: "28px",
        "2xl": "36px",
        pill: "999px",
      },
      // One family per weight — custom fonts can't switch weight via fontWeight
      // on native. Mirrors constants/typography.ts `fonts` + the _layout useFonts keys.
      fontFamily: {
        display: ["BricolageGrotesque"],
        "display-semibold": ["BricolageGrotesque-SemiBold"],
        body: ["DMSans"],
        "body-medium": ["DMSans-Medium"],
        "body-bold": ["DMSans-Bold"],
        mono: ["DMMono"],
        "mono-medium": ["DMMono-Medium"],
      },
      fontSize: {
        "2xs": ["11px", "14px"],
        xs: ["12px", "16px"],
        sm: ["14px", "20px"],
        base: ["16px", "24px"],
        lg: ["18px", "26px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "30px"],
        "3xl": ["30px", "36px"],
        "4xl": ["36px", "40px"],
        "5xl": ["44px", "48px"],
        "6xl": ["52px", "54px"],
      },
    },
  },
  plugins: [],
};
