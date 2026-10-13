import React, { useCallback, useMemo } from 'react';
import { Platform, SectionList, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { MediaListRow } from './MediaListRow';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { EmptyState } from './EmptyState';
import { useBottomSheet } from './StackBottomSheet';
import { ActorFilmographySheetContent } from './ActorFilmographySheet';
import { initialsForName } from './PersonCard';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GlassIconButton } from './GlassIconButton';
import { GOLD_ACCENT, GRID_PAD, SCROLL_BOTTOM_PAD } from '../theme/programme';
import { scale } from '../utils/responsive';

const ROW_HEIGHT = scale(76);

function PersonRow({ person, colors, typography, onPress, onLongPress }) {
  const canPeek = Boolean(person.id);

  return (
    <MediaListRow
      item={person}
      title={person.name}
      titleStyle={{ fontWeight: '800', ...typography.bodyLg }}
      meta={person.roleLabel}
      metaStyle={{ fontWeight: '600', marginTop: 3 }}
      imageUri={person.profileUrl}
      imageVariant="avatar-lg"
      fallbackInitials={!person.profileUrl ? initialsForName(person.name) : undefined}
      fallbackIcon="person-outline"
      colors={colors}
      typography={typography}
      onPress={onPress}
      onLongPress={canPeek ? onLongPress : undefined}
      delayLongPress={canPeek ? 400 : undefined}
      showPeekHint={canPeek}
      chevronSize={16}
      chevronColor={colors.onSurfaceVariant}
      chevronOpacity={1}
      minHeight={ROW_HEIGHT}
      paddingHorizontal={0}
      accessibilityRole="button"
      accessibilityLabel={`${person.name}, ${person.roleLabel}. View filmography${
        canPeek ? '. Hold for a quick filmography preview' : ''
      }`}
    />
  );
}

/**
 * Full cast & crew for one title. Deliberately a virtualized SectionList rather
 * than an expanded rail: TMDb returns the complete credit list (often 100+),
 * which is a destination, not a progressive disclosure.
 */
export function FullCastScreen({ title, cast = [], crew = [], onPersonPress, onBack }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const insets = useSafeAreaInsets();
  const bottomNavScroll = useBottomNavScroll();
  const { show: showSheet, dismiss: dismissSheet } = useBottomSheet();

  const sections = useMemo(
    () =>
      [
        { key: 'cast', title: 'Cast', data: cast },
        { key: 'crew', title: 'Crew', data: crew },
      ].filter((section) => section.data.length > 0),
    [cast, crew],
  );

  const handlePeek = useCallback(
    (person) => {
      if (!person.id) return;
      Haptics.selectionAsync();
      let sheetId;
      const content = (
        <ActorFilmographySheetContent
          person={person}
          role={person.filmographyRole}
          onPersonPress={onPersonPress}
          onDismiss={() => dismissSheet(sheetId)}
        />
      );
      sheetId = showSheet(content, {
        title: `⭐ ${person.name}`,
        size: 'large',
        scrollable: false,
        showCloseButton: true,
        dismissOnBackdrop: true,
      });
    },
    [onPersonPress, showSheet, dismissSheet],
  );

  const atmosphereColors = [colors.surfaceContainerHigh, colors.background];

  const renderItem = useCallback(
    ({ item }) => (
      <PersonRow
        person={item}
        colors={colors}
        typography={typography}
        onPress={() => onPersonPress?.(item.id, item.name, item.filmographyRole)}
        onLongPress={() => handlePeek(item)}
      />
    ),
    [colors, typography, onPersonPress, handlePeek],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => (
      // Not sticky, so no opaque fill — it would cut a band through the atmosphere gradient.
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {`${section.title} · ${section.data.length}`}
        </Text>
        <ProgrammeHairline style={styles.sectionHairline} />
      </View>
    ),
    [typography],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />

      {onBack ? (
        <View
          style={[styles.floatingHeader, { top: (insets.top || 0) + 12 }]}
          pointerEvents="box-none"
        >
          <GlassIconButton
            icon="arrow-back"
            iconSize={22}
            onPress={onBack}
            accessibilityLabel="Go back"
          />
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.role}-${item.id || item.name}-${index}`}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (insets.top || 0) + (onBack ? scale(56) : scale(28)),
            paddingBottom: insets.bottom + SCROLL_BOTTOM_PAD,
          },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        ListHeaderComponent={
          <View style={styles.pageHeader}>
            <Text style={[styles.eyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
              Cast &amp; Crew
            </Text>
            <Text
              style={[styles.pageTitle, { color: colors.onSurface, ...typography.titleMd }]}
              numberOfLines={2}
              accessibilityRole="header"
            >
              {title}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            variant="empty"
            title="No credits listed"
            description="We couldn't find cast or crew for this title."
            compact
          />
        }
        {...bottomNavScroll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  atmosphereTop: {
    height: scale(220),
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  floatingHeader: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
  },
  content: {
    paddingHorizontal: GRID_PAD,
  },
  pageHeader: {
    marginBottom: scale(20),
  },
  eyebrow: {
    alignSelf: 'stretch',
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  pageTitle: {
    alignSelf: 'stretch',
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    paddingBottom: scale(10),
    paddingTop: scale(14),
  },
  sectionTitle: {
    alignSelf: 'stretch',
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: scale(10),
    textTransform: 'uppercase',
  },
  sectionHairline: {
    marginBottom: 0,
  },
});
