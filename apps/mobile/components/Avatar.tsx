import { Image, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { avatarSize, colors, fontWeight } from "@/lib/theme";

/** Initialen aus dem Anzeigenamen, z. B. „Helga R." → „HR". */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Pfad im avatars-Bucket → öffentliche URL; lokale Demo-URIs unverändert. */
export function resolveAvatarUri(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("file:") || photoPath.startsWith("http")) return photoPath;
  if (!supabase) return null;
  return supabase.storage.from("avatars").getPublicUrl(photoPath).data.publicUrl;
}

export function Avatar({
  name,
  photoPath,
  size = avatarSize.md,
  pending = false,
}: {
  name: string;
  photoPath: string | null | undefined;
  size?: number;
  /** Eigene Ansicht während der Prüfung: Foto mit Schleier. */
  pending?: boolean;
}) {
  const uri = resolveAvatarUri(photoPath);
  const radiusStyle = { width: size, height: size, borderRadius: size / 2 };

  if (!uri) {
    return (
      <View style={[styles.fallback, radiusStyle]} accessibilityLabel={`Profilbild von ${name}`}>
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
      </View>
    );
  }

  return (
    <View style={radiusStyle} accessibilityLabel={`Profilbild von ${name}`}>
      <Image source={{ uri }} style={[styles.image, radiusStyle]} />
      {pending ? <View style={[styles.veil, radiusStyle]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.onPrimary,
    fontWeight: fontWeight.bold,
    // Basis-Schriftgröße wird über size skaliert; nie unter Tokens-Minimum nötig,
    // da Initialen dekorativ sind (Name steht immer daneben).
    lineHeight: undefined,
  },
  image: {
    resizeMode: "cover",
  },
  veil: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: colors.overlayVeil,
  },
});
