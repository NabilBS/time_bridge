// Design-Tokens – einzige Quelle für Farben, Abstände und Schriftgrößen.
// Zielgruppe 60+: Touch-Ziele ≥ 48 pt, Basis-Schrift ≥ 17 pt, hoher Kontrast.

export const colors = {
  background: "#FFFDF8",
  surface: "#FFFFFF",
  primary: "#2F6B4F",
  onPrimary: "#FFFFFF",
  primarySoft: "#E8F1EC",
  text: "#1F2933",
  textMuted: "#52606D",
  border: "#C8D2DC",
  borderStrong: "#52606D",
  error: "#B3261E",
  errorSoft: "#FCEEED",
  demoBanner: "#FFF3CD",
  demoBannerText: "#664D03",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSize = {
  body: 17,
  bodyLarge: 19,
  subtitle: 22,
  title: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
} as const;

export const touchTarget = {
  minHeight: 48,
  buttonHeight: 56,
} as const;
