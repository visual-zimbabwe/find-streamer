import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Bottom-sheet content for a title's soundtrack releases. Rows come from
 * `buildSoundtrackRows`, which supplies `displayTitle` (leading with whatever
 * tells two releases apart) and `showYear` (false when every row shares one).
 */
export function SoundtrackPickerSheetContent({
  soundtracks,
  colors,
  typography,
  onSelect,
  onDismiss,
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      {soundtracks.map((soundtrack, index) => (
        <TouchableOpacity
          key={soundtrack.wikidataId}
          style={[
            styles.row,
            index < soundtracks.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.outlineVariant + '55',
            },
          ]}
          onPress={() => {
            onSelect(soundtrack);
            onDismiss();
          }}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`Play ${soundtrack.displayTitle}${soundtrack.year ? ` from ${soundtrack.year}` : ''} on Spotify`}
        >
          {soundtrack.coverUrl ? (
            <Image
              source={{ uri: soundtrack.coverUrl }}
              style={styles.cover}
              resizeMode="cover"
              accessibilityLabel={`${soundtrack.displayTitle} cover art`}
            />
          ) : (
            <View style={[styles.coverFallback, { backgroundColor: colors.surfaceContainerHigh }]}>
              <Ionicons name="musical-notes-outline" size={22} color={colors.onSurfaceVariant} />
            </View>
          )}
          <View style={styles.meta}>
            <Text
              style={[styles.title, { color: colors.onSurface, ...typography.bodyMd }]}
              numberOfLines={2}
            >
              {soundtrack.displayTitle}
            </Text>
            {soundtrack.showYear ? (
              <Text
                style={[styles.year, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
              >
                {soundtrack.year}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  cover: {
    borderRadius: 8,
    height: 56,
    width: 56,
  },
  coverFallback: {
    alignItems: 'center',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  meta: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontWeight: '700',
  },
  year: {
    fontWeight: '600',
  },
});
