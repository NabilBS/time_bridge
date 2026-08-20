import { useMemo, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { FieldError } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from "@/lib/theme";

const ITEM_HEIGHT = touchTarget.minHeight;
const VISIBLE_HEIGHT = ITEM_HEIGHT * 5;

export function YearPicker({
  label,
  minYear,
  maxYear,
  value,
  onChange,
  error,
}: {
  label: string;
  minYear: number;
  maxYear: number;
  value: number | null;
  onChange: (year: number) => void;
  error?: string | null;
}) {
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) list.push(year);
    return list;
  }, [minYear, maxYear]);

  const initialIndex = useMemo(() => {
    const target = value ?? 1955;
    const index = years.indexOf(target);
    return index === -1 ? Math.floor(years.length / 2) : index;
  }, [years, value]);

  const listRef = useRef<FlatList<number>>(null);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.listWrapper, error ? styles.listWrapperError : null]}>
        <FlatList
          ref={listRef}
          data={years}
          keyExtractor={(year) => String(year)}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          style={{ height: VISIBLE_HEIGHT }}
          renderItem={({ item: year }) => {
            const selected = year === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onChange(year)}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{year}</Text>
              </Pressable>
            );
          }}
        />
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  listWrapper: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  listWrapperError: {
    borderColor: colors.error,
  },
  row: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  rowSelected: {
    backgroundColor: colors.primary,
  },
  rowLabel: {
    fontSize: fontSize.bodyLarge,
    color: colors.text,
    textAlign: "center",
  },
  rowLabelSelected: {
    color: colors.onPrimary,
    fontWeight: fontWeight.bold,
  },
});
