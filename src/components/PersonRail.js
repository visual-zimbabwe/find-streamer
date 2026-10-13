import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PersonCard } from './PersonCard';
import { ProgrammeEyebrowLabel } from './ProgrammeSectionHeader';
import { GOLD_ACCENT } from '../theme/programme';
import { useTheme } from '../theme/ThemeProvider';
import { theme as defaultTheme } from '../theme/tokens';
import { scale } from '../utils/responsive';
import {
  personKey,
  formatPersonSeeAllAccessibilityLabel,
  resolvePersonRailConfig,
} from '../lib/personRailModel';

function useSafeTheme() {
  try {
    const context = useTheme();
    if (context?.theme?.colors) return context.theme;
  } catch {
    // ThemeProvider not in tree
  }
  return defaultTheme;
}

/**
 * Trailing "See All" circular action card rendered at the end of the PersonRail.
 * Styled with the same geometry and baseline typography as PersonCard.
 */
export function PersonSeeAllCard({
  onPress,
  remainingCount = null,
  totalCount = null,
  title = 'talent',
  seeAllTileTitle = 'See all',
  seeAllTileSubtitle,
  colors: overrideColors,
  typography: overrideTypography,
  accent = false,
  style,
}) {
  const safeTheme = useSafeTheme();
  const colors = overrideColors || safeTheme.colors;
  const typography = overrideTypography || safeTheme.typography;

  const subtitle =
    typeof seeAllTileSubtitle === 'function'
      ? seeAllTileSubtitle(remainingCount, totalCount)
      : seeAllTileSubtitle !== undefined
        ? seeAllTileSubtitle
        : remainingCount !== null && remainingCount > 0
          ? `+${remainingCount} more`
          : totalCount !== null && totalCount > 0
            ? `${totalCount} total`
            : null;

  const a11yLabel = formatPersonSeeAllAccessibilityLabel(title, totalCount);

  const handlePress = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {
      // Ignore if haptics is unsupported
    }
    onPress?.();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={[styles.seeAllCard, style]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      activeOpacity={0.78}
    >
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.seeAllAvatarRing,
            {
              backgroundColor: accent ? GOLD_ACCENT + '18' : colors.surfaceContainerHigh,
            },
          ]}
        >
          <Ionicons name="arrow-forward" size={scale(24)} color={GOLD_ACCENT} />
        </View>
      </View>

      <Text
        style={[
          styles.name,
          { color: colors.onSurface, ...typography.bodyMd },
        ]}
        numberOfLines={2}
      >
        {seeAllTileTitle}
      </Text>

      {subtitle ? (
        <Text
          style={[
            styles.role,
            { color: colors.onSurfaceVariant, ...typography.labelSm },
          ]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : (
        <View style={styles.emptySubtitleSpacer} />
      )}
    </TouchableOpacity>
  );
}

/**
 * PersonRail
 *
 * A unified horizontal talent and cast rail:
 * - Edge-to-edge bleed layout for detail pages with matching horizontal margin/padding
 * - Header row with ProgrammeEyebrowLabel and optional top-right "See all" action
 * - Trailing circular "See all" action card with matching avatar geometry
 * - Backwards-compatible integration with PersonCard and domain models
 */
export function PersonRail({
  title = 'Cast',
  eyebrow,
  data = [],
  totalCount = null,
  hasMore,
  accent = false,
  bleed = true,
  gap = 16,
  showHeader = true,
  showHeaderSeeAll = true,
  showSeeAllTile,
  onSeeAll = null,
  seeAllLabel,
  seeAllAccessibilityLabel,
  seeAllTileTitle = 'See all',
  seeAllTileSubtitle,
  canPeek = true,
  onPersonPress,
  onPersonLongPress,
  renderItem,
  renderHeader,
  renderSeeAllTile,
  keyExtractor: customKeyExtractor,
  emptyMessage,
  renderEmpty,
  colors: overrideColors,
  typography: overrideTypography,
  style,
  contentContainerStyle,
  showsHorizontalScrollIndicator = false,
  decelerationRate = 'fast',
  ...restProps
}) {
  const safeTheme = useSafeTheme();
  const colors = overrideColors || safeTheme.colors;
  const typography = overrideTypography || safeTheme.typography;

  const config = resolvePersonRailConfig({
    title,
    eyebrow,
    data,
    totalCount,
    hasMore,
    accent,
    bleed,
    gap,
    showHeader,
    showHeaderSeeAll,
    showSeeAllTile,
    onSeeAll,
    seeAllLabel,
    seeAllTileTitle,
  });

  const handleHeaderSeeAll = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {
      // Ignore if haptics is unsupported
    }
    onSeeAll?.();
  }, [onSeeAll]);

  const renderHeaderRow = () => {
    if (!config.showHeader || !config.title) return null;

    if (renderHeader) {
      return renderHeader({
        title: config.title,
        onSeeAll,
        seeAllLabel: config.seeAllLabel,
        colors,
        typography,
      });
    }

    return (
      <ProgrammeEyebrowLabel
        eyebrow={config.title}
        actionLabel={config.showHeaderSeeAll ? config.seeAllLabel : null}
        onAction={config.showHeaderSeeAll ? handleHeaderSeeAll : null}
        actionAccessibilityLabel={
          seeAllAccessibilityLabel ||
          formatPersonSeeAllAccessibilityLabel(config.title, config.totalCount)
        }
        style={config.bleed && styles.sectionHeaderBleed}
      />
    );
  };

  const items = config.items;
  if (items.length === 0) {
    if (renderEmpty) return renderEmpty({ colors, typography });
    if (emptyMessage) {
      return (
        <View style={[styles.root, config.bleed && styles.railBleed, style]}>
          {renderHeaderRow()}
          <View
            style={[
              styles.emptyContainer,
              config.bleed && styles.emptyContainerBleed,
            ]}
          >
            <Text
              style={[
                styles.emptyText,
                { color: colors.onSurfaceVariant, ...typography.bodyMd },
              ]}
            >
              {emptyMessage}
            </Text>
          </View>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={[styles.root, config.bleed && styles.railBleed, style]}>
      {renderHeaderRow()}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        decelerationRate={decelerationRate}
        contentContainerStyle={[
          styles.scrollList,
          config.bleed ? styles.scrollListBleed : styles.scrollListNormal,
          { gap: config.gap },
          contentContainerStyle,
        ]}
        {...restProps}
      >
        {items.map((person, index) => {
          const key = customKeyExtractor
            ? customKeyExtractor(person, index)
            : personKey(person, index);
          const isPeekable =
            typeof canPeek === 'function' ? canPeek(person) : Boolean(canPeek && person?.id);

          if (renderItem) {
            return renderItem({
              item: person,
              index,
              colors,
              typography,
              accent: config.accent,
              canPeek: isPeekable,
              onPress: onPersonPress ? () => onPersonPress(person, index) : undefined,
              onLongPress: onPersonLongPress ? () => onPersonLongPress(person, index) : undefined,
            });
          }

          return (
            <PersonCard
              key={key}
              person={person}
              colors={colors}
              typography={typography}
              accent={config.accent}
              canPeek={isPeekable}
              onPress={onPersonPress ? () => onPersonPress(person, index) : undefined}
              onLongPress={onPersonLongPress ? () => onPersonLongPress(person, index) : undefined}
            />
          );
        })}

        {config.showSeeAllTile && onSeeAll ? (
          renderSeeAllTile ? (
            renderSeeAllTile({
              onSeeAll,
              remainingCount: config.remainingCount,
              totalCount: config.totalCount,
              colors,
              typography,
              accent: config.accent,
            })
          ) : (
            <PersonSeeAllCard
              onPress={onSeeAll}
              remainingCount={config.remainingCount}
              totalCount={config.totalCount}
              title={config.title}
              seeAllTileTitle={config.seeAllTileTitle}
              seeAllTileSubtitle={seeAllTileSubtitle}
              colors={colors}
              typography={typography}
              accent={config.accent}
            />
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: scale(32),
  },
  railBleed: {
    marginHorizontal: -24,
  },
  sectionHeaderBleed: {
    paddingHorizontal: 24,
  },
  scrollList: {
    alignItems: 'flex-start',
  },
  scrollListBleed: {
    paddingLeft: 24,
    paddingRight: scale(40),
  },
  scrollListNormal: {
    paddingRight: 24,
  },
  seeAllCard: {
    alignItems: 'center',
    width: scale(92),
  },
  avatarWrap: {
    marginBottom: scale(10),
  },
  seeAllAvatarRing: {
    alignItems: 'center',
    borderRadius: scale(38),
    height: scale(76),
    justifyContent: 'center',
    overflow: 'hidden',
    width: scale(76),
  },
  name: {
    fontWeight: '800',
    minHeight: 40,
    textAlign: 'center',
  },
  role: {
    fontWeight: '700',
    minHeight: 32,
    textAlign: 'center',
  },
  emptySubtitleSpacer: {
    minHeight: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(24),
  },
  emptyContainerBleed: {
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
  },
});
