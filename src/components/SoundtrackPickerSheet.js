import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { MediaListRow } from './MediaListRow';

/**
 * Bottom-sheet content for a title's soundtrack releases. Rows come from
 * `buildSoundtrackRows`, which supplies `displayTitle` (leading with whatever
 * tells two releases apart) and `showYear` (false when every row shares one).
 * Standardized on MediaListRow for consistent layout, touch physics, and tokens.
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
        <MediaListRow
          key={soundtrack.wikidataId}
          showDivider={index < soundtracks.length - 1}
          dividerColor={colors.outlineVariant + '55'}
          colors={colors}
          typography={typography}
          onPress={() => {
            onSelect(soundtrack);
            onDismiss();
          }}
          accessibilityLabel={`Play ${soundtrack.displayTitle}${soundtrack.year ? ` from ${soundtrack.year}` : ''} on Spotify`}
          imageUri={soundtrack.coverUrl}
          imageVariant="square"
          fallbackIcon="musical-notes-outline"
          title={soundtrack.displayTitle}
          titleNumberOfLines={2}
          titleStyle={{ fontWeight: '700' }}
          meta={soundtrack.showYear ? soundtrack.year : null}
          metaStyle={{ fontWeight: '600' }}
          chevronSize={18}
          chevronColor={colors.onSurfaceVariant}
          chevronOpacity={1}
          paddingHorizontal={0}
          paddingVertical={12}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
});
