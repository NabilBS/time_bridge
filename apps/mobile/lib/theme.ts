// Design-Tokens – einzige Quelle für Farben, Abstände, Schriften, Radien und Maße.
//
// Zielgruppe 60+ (siehe CLAUDE.md): Touch-Ziele ≥ 48 pt, Basis-Schrift ≥ 17 pt,
// hoher Kontrast. Alle textführenden Farbpaare erreichen WCAG AAA (≥ 7:1),
// Bedienelement-Umrisse und bedeutungstragende Grafiken mindestens 3:1 (WCAG 1.4.11).
// Die Kontrastwerte in den Kommentaren beziehen sich auf `background` (#FFFDF8)
// bzw. auf die genannte Fläche.
//
// Regel: keine hartkodierten Farben oder Maße in Screens – ausschließlich diese Tokens.

export const colors = {
  // ---- Flächen ----------------------------------------------------------
  /** App-Hintergrund: warmes Papierweiß. */
  background: "#FFFDF8",
  /** Karten, Eingabefelder, Listenzeilen. */
  surface: "#FFFFFF",

  // ---- Marke („Fichte") -------------------------------------------------
  /** Hauptaktion, Links, aktive Tabs. 7.2:1 auf background, 7.3:1 mit onPrimary. */
  primary: "#2A6047",
  /** Gedrückte/aktive Fläche und Text auf primarySoft. 9.9:1 mit onPrimary. */
  primaryStrong: "#1F4B35",
  /** Ruhige Markenfläche: Hinweiskästen, ausgewählte Karten, Badges. */
  primarySoft: "#E8F1EC",
  /** Text/Icons auf primary bzw. primaryStrong. */
  onPrimary: "#FFFFFF",

  // ---- Text -------------------------------------------------------------
  /** Fließtext und Überschriften. 14.5:1 */
  text: "#1F2933",
  /** Sekundärtext, Hilfetexte, Zähler. 7.3:1 – bewusst AAA, nicht „grau light". */
  textMuted: "#4B5763",

  // ---- Linien -----------------------------------------------------------
  /** Rein dekorative Trennlinien innerhalb einer Liste (keine Bedeutung). */
  divider: "#DDE3E9",
  /** Umriss von Karten und nicht ausgewählten Bedienelementen. 3.3:1 */
  border: "#828E9B",
  /** Umriss von Eingabefeldern und antippbaren Chips. 7.4:1 */
  borderStrong: "#4B5763",

  // ---- Status: bestätigt (Vertrauensstufe, geprüfter Nachweis, Treffen) --
  /** „Bestätigt", „Geprüft", abgeschlossenes Treffen. 7.8:1 */
  success: "#1B5C3B",
  /** Fläche hinter success-Text. 7.0:1 mit success. */
  successSoft: "#EAF3EE",

  // ---- Status: in Prüfung / abgelaufen / Demo ---------------------------
  /** „Wird geprüft", „Bitte erneuern", Demo-Hinweis. 8.3:1 */
  warning: "#6B4700",
  /** Fläche hinter warning-Text. 7.5:1 mit warning. */
  warningSoft: "#FFF3CD",

  // ---- Status: Fehler / Absage / Ablehnung ------------------------------
  /** Feldfehler, Absage, abgelehnter Nachweis. 8.1:1 auf background, 8.2:1 auf surface. */
  error: "#9B1B14",
  /** Fläche hinter error-Text (Fehlerfeld, Absage-Karte). 7.3:1 mit error. */
  errorSoft: "#FCEEED",

  // ---- Bewertung --------------------------------------------------------
  /** Gefüllter Stern (★). 3.8:1 – Bedeutung zusätzlich über die Sternform. */
  rating: "#A67C00",
  /** Leerer Stern (☆). 3.6:1 */
  ratingEmpty: "#7B8794",

  // ---- Überlagerungen ---------------------------------------------------
  /** Schleier über dem eigenen Foto, solange es geprüft wird. */
  overlayVeil: "rgba(255, 253, 248, 0.55)",
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
  /** Ausnahme: nur Tab-Beschriftungen direkt unter einem Icon. */
  caption: 15,
  /** Basisgröße – Minimum für alle Inhaltstexte (Zielgruppe 60+). */
  body: 17,
  bodyLarge: 19,
  subtitle: 22,
  title: 28,
} as const;

/** Zeilenhöhen als Faktor der Schriftgröße: `fontSize.body * lineHeight.normal`. */
export const lineHeight = {
  /** Überschriften und kurze Labels. */
  tight: 1.3,
  /** Fließtext – großzügig, damit Zeilen leicht wiedergefunden werden. */
  normal: 1.5,
} as const;

export const fontWeight = {
  regular: "400",
  /** Labels, Chips, Zwischenüberschriften. */
  semibold: "600",
  /** Titel und Button-Beschriftungen. */
  bold: "700",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  /** Vollrund: Chips, Badges, Statuspillen. */
  pill: 999,
} as const;

export const touchTarget = {
  /** Absolutes Minimum für alles Antippbare. */
  minHeight: 48,
  /** Buttons und Eingabefelder – bewusst über dem Minimum. */
  buttonHeight: 56,
} as const;

/** Deckkraft für Zustände – nie eigene Werte in Screens. */
export const opacity = {
  pressed: 0.85,
  /** Noch nicht bestätigt gesendete Nachricht. */
  pending: 0.6,
  disabled: 0.4,
} as const;

/** Feste Maße einzelner Bausteine. */
export const size = {
  /** Kästchen der Einwilligungs-Checkbox (Trefferfläche ist die ganze Zeile). */
  checkbox: 28,
  /** Mindesthöhe mehrzeiliger Eingabefelder. */
  multilineInput: 140,
  /** Stern in der Bewertung. */
  star: 44,
} as const;

/** Profilbilder – vier feste Stufen statt freier Pixelwerte. */
export const avatarSize = {
  /** Listenzeile Anfragen. */
  sm: 48,
  /** Listenzeile Chats, Karte Entdecken. */
  md: 56,
  /** Profil-Tab und Profildetail. */
  lg: 88,
  /** Foto-Screen. */
  xl: 112,
} as const;

/** Tab-Leiste (expo-router `Tabs`). */
export const tabBar = {
  height: 68,
  paddingTop: 6,
  paddingBottom: 8,
} as const;
