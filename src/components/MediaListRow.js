import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MediaArtwork } from './MediaArtwork';
import { useTheme } from '../theme/ThemeProvider';
import { theme as defaultTheme } from '../theme/tokens';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { scale } from '../utils/responsive';
import {
  formatMediaRowAccessibilityLabel,
  formatMediaRowMeta,
  initialsForName,
  resolveMediaRowItemProps,
} from '../lib/mediaRowModel';

function useSafeTheme() {
  try {
    const ctx = useTheme();
    return ctx?.theme || defaultTheme;
  } catch {
    return defaultTheme;
  }
}

/**
 * MediaListRow
 *
 * Unified, configurable list row component providing standard layout,
 * touch physics, token styling, and slot props for media items, search candidates,
 * cast & crew, and library entries across the application.
 */
export function MediaListRow({
  // Item (optional convenience for automatic property unpacking)
  item,

  // Row Press & Touch
  onPress,
  onLongPress,
  delayLongPress = 400,
  activeOpacity = 0.78,
  disabled = false,

  // Layout & Styling
  style,
  minHeight = scale(48),
  paddingHorizontal = scale(16),
  paddingVertical = scale(10),
  gap = scale(12),
  showDivider = false,
  dividerColor = GOLD_DIM,

  // Accessibility
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,

  // Direct Slots
  leading,
  leadingStyle,
  body,
  bodyStyle,
  trailing,
  trailingStyle,

  // Pre-configured Leading Props
  rank,
  rankStyle,
  imageUri: propImageUri,
  imageVariant: propImageVariant, // 'poster' | 'avatar' | 'avatar-lg' | 'square' | 'none'
  imageWidth,
  imageHeight,
  imageRadius,
  imageResizeMode = 'cover',
  fallbackIcon: propFallbackIcon,
  fallbackInitials: propFallbackInitials,
  imageStyle,
  imageAccessibilityLabel,

  // Pre-configured Body Props
  title: propTitle,
  titlePrefix,
  titleStyle,
  titleNumberOfLines = 1,
  subtitle: propSubtitle,
  subtitleStyle,
  subtitleNumberOfLines = 1,
  meta: propMeta,
  metaStyle,
  tertiary,
  tertiaryStyle,

  // Pre-configured Trailing Props
  showBookmark = false,
  isBookmarked = false,
  onToggleBookmark,
  bookmarkAccessibilityLabel,

  showPeekHint = false,
  peekHintIcon = 'ellipsis-horizontal',

  showChevron,
  chevronIcon = 'chevron-forward',
  chevronSize = 16,
  chevronColor,
  chevronOpacity = 0.72,

  trailingIcon,
  trailingIconSize = 14,
  trailingIconColor,

  // Theme Overrides
  colors: overrideColors,
  typography: overrideTypography,
  radii: overrideRadii,

  ...restProps
}) {
  const safeTheme = useSafeTheme();
  const colors = overrideColors || safeTheme.colors;
  const typography = overrideTypography || safeTheme.typography;
  const radii = overrideRadii || safeTheme.radii;

  // Unpack item properties if item object is provided
  const itemResolved = item ? resolveMediaRowItemProps(item, { rank, canPeek: showPeekHint }) : {};

  const title = propTitle ?? itemResolved.title ?? '';
  const metaText = propSubtitle ?? propMeta ?? (item ? formatMediaRowMeta(item) : '');
  const imageUri = propImageUri ?? itemResolved.imageUri;
  const imageVariant = propImageVariant ?? itemResolved.imageVariant ?? 'poster';

  // Determine fallback initials
  let effectiveInitials = null;
  if (propFallbackInitials === true && typeof title === 'string') {
    effectiveInitials = initialsForName(title);
  } else if (typeof propFallbackInitials === 'string') {
    effectiveInitials = propFallbackInitials;
  }

  // Predefined image presets
  const presetSizes = {
    poster: {
      width: scale(36),
      height: scale(52),
      radius: radii?.md ?? 6,
      defaultIcon: 'film-outline',
    },
    avatar: {
      width: scale(44),
      height: scale(44),
      radius: scale(22),
      defaultIcon: 'person-outline',
    },
    'avatar-lg': {
      width: scale(52),
      height: scale(52),
      radius: scale(26),
      defaultIcon: 'person-outline',
    },
    square: {
      width: scale(56),
      height: scale(56),
      radius: scale(8),
      defaultIcon: 'musical-notes-outline',
    },
  };

  const preset = presetSizes[imageVariant] || presetSizes.poster;
  const frameWidth = imageWidth ?? preset.width;
  const frameHeight = imageHeight ?? preset.height;
  const frameRadius = imageRadius ?? preset.radius;
  const effectiveFallbackIcon = propFallbackIcon ?? itemResolved.fallbackIcon ?? preset.defaultIcon;

  // Bookmark toggle handler
  const handleToggleBookmark = useCallback(
    (e) => {
      e?.stopPropagation?.();
      onToggleBookmark?.(e);
    },
    [onToggleBookmark],
  );

  // Chevron visibility
  const hasChevron = showChevron !== undefined ? showChevron : Boolean(onPress && !trailing);

  // Accessibility label resolution
  const resolvedAccessibilityLabel =
    accessibilityLabel ||
    (item
      ? formatMediaRowAccessibilityLabel(item, { rank, canPeek: showPeekHint })
      : typeof title === 'string'
        ? `${title}${metaText ? `, ${metaText}` : ''}`
        : undefined);

  // Render Leading Section
  const renderLeading = () => {
    if (leading !== undefined) {
      return leading;
    }

    const hasRank = rank != null;
    const hasImage = Boolean(imageUri);
    const hasInitials = Boolean(effectiveInitials);
    const hasFrame =
      imageVariant !== 'none' && (hasImage || hasInitials || Boolean(effectiveFallbackIcon));

    if (!hasRank && !hasFrame) {
      return null;
    }

    return (
      <View style={[styles.leadingGroup, leadingStyle]}>
        {hasRank && (
          <Text style={[styles.rank, { color: GOLD_ACCENT, ...typography?.labelSm }, rankStyle]}>
            {rank}
          </Text>
        )}
        {hasFrame && (
          <View
            style={[
              styles.thumbFrame,
              {
                width: frameWidth,
                height: frameHeight,
                borderRadius: frameRadius,
                backgroundColor: colors?.surfaceContainerHigh,
              },
            ]}
          >
            {hasImage ? (
              <MediaArtwork
                uri={imageUri}
                style={[
                  {
                    width: frameWidth,
                    height: frameHeight,
                    borderRadius: frameRadius,
                  },
                  imageStyle,
                ]}
                resizeMode={imageResizeMode}
                icon={effectiveFallbackIcon}
                title={typeof title === 'string' ? title : ''}
                compactFallback
                instant
                accessibilityLabel={
                  imageAccessibilityLabel ||
                  (typeof title === 'string' ? `${title} artwork` : undefined)
                }
              />
            ) : hasInitials ? (
              <Text
                style={[
                  styles.avatarInitials,
                  { color: colors?.onSurface, ...typography?.labelSm },
                ]}
              >
                {effectiveInitials}
              </Text>
            ) : (
              <Ionicons
                name={effectiveFallbackIcon}
                size={scale(20)}
                color={colors?.onSurfaceVariant}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  // Render Body Section
  const renderBody = () => {
    if (body !== undefined) {
      return body;
    }

    return (
      <View style={[styles.info, bodyStyle]}>
        <View style={styles.titleRow}>
          {titlePrefix}
          {typeof title === 'string' ? (
            <Text
              style={[
                styles.title,
                { color: colors?.onSurface, ...typography?.bodyMd },
                titleStyle,
              ]}
              numberOfLines={titleNumberOfLines}
            >
              {title}
            </Text>
          ) : (
            title
          )}
        </View>

        {Boolean(metaText) &&
          (typeof metaText === 'string' ? (
            <Text
              style={[
                styles.meta,
                { color: colors?.onSurfaceVariant, ...typography?.labelSm },
                metaStyle ?? subtitleStyle,
              ]}
              numberOfLines={subtitleNumberOfLines}
            >
              {metaText}
            </Text>
          ) : (
            metaText
          ))}

        {Boolean(tertiary) &&
          (typeof tertiary === 'string' ? (
            <Text
              style={[
                styles.tertiary,
                { color: colors?.onSurfaceVariant, ...typography?.labelSm },
                tertiaryStyle,
              ]}
              numberOfLines={1}
            >
              {tertiary}
            </Text>
          ) : (
            tertiary
          ))}
      </View>
    );
  };

  // Render Trailing Section
  const renderTrailing = () => {
    if (trailing !== undefined) {
      return trailing;
    }

    const hasTrailingItems =
      showBookmark ||
      Boolean(onToggleBookmark) ||
      showPeekHint ||
      hasChevron ||
      Boolean(trailingIcon);

    if (!hasTrailingItems) {
      return null;
    }

    return (
      <View style={[styles.trailingGroup, trailingStyle]}>
        {Boolean(trailingIcon) && (
          <Ionicons
            name={trailingIcon}
            size={trailingIconSize}
            color={trailingIconColor || colors?.onSurfaceVariant}
          />
        )}

        {(showBookmark || Boolean(onToggleBookmark)) && (
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={handleToggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={
              bookmarkAccessibilityLabel ||
              (isBookmarked ? `Manage library entry for ${title}` : `Save ${title} to library`)
            }
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isBookmarked ? GOLD_ACCENT : colors?.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}

        {showPeekHint && (
          <Ionicons name={peekHintIcon} size={16} color={GOLD_DIM} style={styles.peekHint} />
        )}

        {hasChevron && (
          <Ionicons
            name={chevronIcon}
            size={chevronSize}
            color={chevronColor || GOLD_ACCENT}
            style={[styles.chevron, { opacity: chevronOpacity }]}
          />
        )}
      </View>
    );
  };

  const isInteractive = Boolean(onPress) || Boolean(onLongPress);
  const containerStyle = [
    styles.row,
    {
      minHeight,
      paddingHorizontal,
      paddingVertical,
      gap,
    },
    showDivider && {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dividerColor,
    },
    style,
  ];

  if (isInteractive) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        activeOpacity={activeOpacity}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityHint={accessibilityHint}
        {...restProps}
      >
        {renderLeading()}
        {renderBody()}
        {renderTrailing()}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={containerStyle}
      accessibilityRole={accessibilityRole === 'button' ? undefined : accessibilityRole}
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityHint={accessibilityHint}
      {...restProps}
    >
      {renderLeading()}
      {renderBody()}
      {renderTrailing()}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  leadingGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(10),
  },
  rank: {
    fontWeight: '800',
    textAlign: 'center',
    width: scale(28),
  },
  thumbFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 2,
  },
  title: {
    flexShrink: 1,
    fontWeight: '600',
  },
  meta: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  tertiary: {
    fontWeight: '400',
    marginTop: 1,
  },
  trailingGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(8),
  },
  bookmarkButton: {
    borderRadius: 999,
    padding: scale(6),
  },
  peekHint: {
    marginRight: scale(2),
  },
  chevron: {
    opacity: 0.72,
  },
});
