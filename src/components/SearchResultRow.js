import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MediaListRow } from './MediaListRow';
import { GOLD_ACCENT } from '../theme/programme';

/**
 * One row of a search result — a title or a person.
 *
 * Refactored to delegate to the unified MediaListRow component, ensuring
 * identical touch physics, layout tokens, and accessibility across all list rows.
 */
export function SearchResultRow({ item, showDivider = false, colors, typography, radii, onPress }) {
  const isPerson = item?.resultType === 'person';
  const hasYear = item?.year && item.year !== 'N/A';
  const metaText = isPerson
    ? `${item.departmentLabel || ''}${item.knownFor ? ` · ${item.knownFor}` : ''}`
    : `${hasYear ? item.year : ''}${hasYear && item.mediaType ? ' · ' : ''}${
        item.mediaType === 'tv' ? 'TV Show' : item.mediaType === 'movie' ? 'Movie' : ''
      }`;
  const imageUrl = isPerson ? item.profileUrl : item.posterUrl;

  return (
    <MediaListRow
      item={item}
      title={item?.title}
      meta={metaText}
      imageUri={imageUrl}
      imageVariant={isPerson ? 'avatar' : 'poster'}
      fallbackIcon={isPerson ? 'person-outline' : 'film-outline'}
      showDivider={showDivider}
      colors={colors}
      typography={typography}
      radii={radii}
      onPress={onPress}
      accessibilityRole="button"
      titlePrefix={
        isPerson ? (
          <Ionicons
            name={item.role === 'movie' ? 'camera-outline' : 'star-outline'}
            size={13}
            color={GOLD_ACCENT}
          />
        ) : null
      }
      accessibilityLabel={
        isPerson
          ? `${item.title}, ${item.departmentLabel || 'Person'}. View filmography.`
          : `${item.title}${hasYear ? `, ${item.year}` : ''}. Open details.`
      }
      chevronSize={15}
      chevronColor={GOLD_ACCENT}
      chevronOpacity={0.72}
    />
  );
}
