import {
  DarkTheme,
  DefaultTheme,
  type Theme,
} from "@react-navigation/native";

export const THEME = {
  light: {
    background: "hsl(214 60% 97%)",        // Soft blue-white page background
    foreground: "hsl(220 20% 10%)",         // Deep navy text
    card: "hsl(0 0% 100%)",                 // Pure white cards
    cardForeground: "hsl(220 20% 10%)",     // Deep navy text on cards
    popover: "hsl(0 0% 100%)",
    popoverForeground: "hsl(220 20% 10%)",
    primary: "hsl(217 91% 60%)",            // #3B82F6 — travel blue
    primaryForeground: "hsl(0 0% 100%)",    // White text on primary
    secondary: "hsl(221 83% 53%)",          // #2563EB — accent blue
    secondaryForeground: "hsl(0 0% 100%)",
    muted: "hsl(214 32% 91%)",              // Pale blue-grey muted areas
    mutedForeground: "hsl(220 9% 46%)",     // #9CA3AF equivalent for light
    accent: "hsl(224 71% 33%)",             // #1E3A8A — deep navy accent
    accentForeground: "hsl(0 0% 100%)",
    destructive: "hsl(0 84% 60%)",          // #EF4444 — danger red
    border: "hsl(214 32% 88%)",             // Light blue-grey border
    input: "hsl(214 32% 88%)",
    ring: "hsl(217 91% 60%)",               // Travel blue focus ring
    radius: "0.625rem",
    chart1: "hsl(217 91% 60%)",             // #3B82F6 — primary blue
    chart2: "hsl(142 71% 45%)",             // #22C55E — success green
    chart3: "hsl(43 93% 62%)",              // #F5C542 — gold
    chart4: "hsl(221 83% 53%)",             // #2563EB — accent blue
    chart5: "hsl(38 92% 50%)",              // #F59E0B — warning amber
  },
  dark: {
    background: "hsl(222 55% 9%)",          // #0B1220 — main dark background
    foreground: "hsl(220 14% 96%)",         // #F3F4F6 — primary white text
    card: "hsl(222 47% 11%)",               // #111827 — card background
    cardForeground: "hsl(220 14% 96%)",     // #F3F4F6
    popover: "hsl(222 47% 11%)",            // #111827
    popoverForeground: "hsl(220 14% 96%)",
    primary: "hsl(217 91% 60%)",            // #3B82F6 — travel blue
    primaryForeground: "hsl(0 0% 100%)",    // White text on primary
    secondary: "hsl(221 83% 53%)",          // #2563EB — accent blue
    secondaryForeground: "hsl(0 0% 100%)",
    muted: "hsl(215 28% 17%)",              // #1F2937 — muted surface
    mutedForeground: "hsl(218 11% 65%)",    // #9CA3AF — secondary text
    accent: "hsl(224 71% 33%)",             // #1E3A8A — deep navy
    accentForeground: "hsl(0 0% 100%)",
    destructive: "hsl(0 84% 60%)",          // #EF4444 — danger red
    border: "hsl(215 28% 17%)",             // #1F2937 — card border
    input: "hsl(215 28% 17%)",
    ring: "hsl(217 91% 60%)",               // Travel blue focus ring
    radius: "0.625rem",
    chart1: "hsl(217 91% 60%)",             // #3B82F6 — primary blue
    chart2: "hsl(142 71% 45%)",             // #22C55E — success green
    chart3: "hsl(43 93% 62%)",              // #F5C542 — gold
    chart4: "hsl(280 65% 60%)",             // Purple for variety
    chart5: "hsl(38 92% 50%)",              // #F59E0B — warning amber
  },
};

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};

// export const THEME = {
//   light: {
//     background: "hsl(0 0% 100%)",
//     foreground: "hsl(0 0% 3.9%)",
//     card: "hsl(0 0% 100%)",
//     cardForeground: "hsl(0 0% 3.9%)",
//     popover: "hsl(0 0% 100%)",
//     popoverForeground: "hsl(0 0% 3.9%)",
//     primary: "hsl(0 0% 9%)",
//     primaryForeground: "hsl(0 0% 98%)",
//     secondary: "hsl(0 0% 96.1%)",
//     secondaryForeground: "hsl(0 0% 9%)",
//     muted: "hsl(0 0% 96.1%)",
//     mutedForeground: "hsl(0 0% 45.1%)",
//     accent: "hsl(0 0% 96.1%)",
//     accentForeground: "hsl(0 0% 9%)",
//     destructive: "hsl(0 84.2% 60.2%)",
//     border: "hsl(0 0% 89.8%)",
//     input: "hsl(0 0% 89.8%)",
//     ring: "hsl(0 0% 63%)",
//     radius: "0.625rem",
//     chart1: "hsl(12 76% 61%)",
//     chart2: "hsl(173 58% 39%)",
//     chart3: "hsl(197 37% 24%)",
//     chart4: "hsl(43 74% 66%)",
//     chart5: "hsl(27 87% 67%)",
//   },
//   dark: {
//     background: "hsl(0 0% 3.9%)",
//     foreground: "hsl(0 0% 98%)",
//     card: "hsl(0 0% 3.9%)",
//     cardForeground: "hsl(0 0% 98%)",
//     popover: "hsl(0 0% 3.9%)",
//     popoverForeground: "hsl(0 0% 98%)",
//     primary: "hsl(0 0% 98%)",
//     primaryForeground: "hsl(0 0% 9%)",
//     secondary: "hsl(0 0% 14.9%)",
//     secondaryForeground: "hsl(0 0% 98%)",
//     muted: "hsl(0 0% 14.9%)",
//     mutedForeground: "hsl(0 0% 63.9%)",
//     accent: "hsl(0 0% 14.9%)",
//     accentForeground: "hsl(0 0% 98%)",
//     destructive: "hsl(0 70.9% 59.4%)",
//     border: "hsl(0 0% 14.9%)",
//     input: "hsl(0 0% 14.9%)",
//     ring: "hsl(300 0% 45%)",
//     radius: "0.625rem",
//     chart1: "hsl(220 70% 50%)",
//     chart2: "hsl(160 60% 45%)",
//     chart3: "hsl(30 80% 55%)",
//     chart4: "hsl(280 65% 60%)",
//     chart5: "hsl(340 75% 55%)",
//   },
// };

// export const NAV_THEME: Record<"light" | "dark", Theme> = {
//   light: {
//     ...DefaultTheme,
//     colors: {
//       ...DefaultTheme.colors,
//       background: THEME.light.background,
//       border: THEME.light.border,
//       card: THEME.light.card,
//       notification: THEME.light.destructive,
//       primary: THEME.light.primary,
//       text: THEME.light.foreground,
//     },
//   },
//   dark: {
//     ...DarkTheme,
//     colors: {
//       ...DarkTheme.colors,
//       background: THEME.dark.background,
//       border: THEME.dark.border,
//       card: THEME.dark.card,
//       notification: THEME.dark.destructive,
//       primary: THEME.dark.primary,
//       text: THEME.dark.foreground,
//     },
//   },
// };
