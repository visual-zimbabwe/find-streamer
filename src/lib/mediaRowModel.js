/**
 * Model and formatting helpers for media list rows.
 * Pure logic — no React or Native dependencies.
 */

/**
 * Extract up to two uppercase initials from a person or entity name.
 */
export function initialsForName(name = '') {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return initials || '?';
}

/**
 * Format standard secondary metadata line for a media item, person, or credit.
 */
export function formatMediaRowMeta(item = {}) {
  if (!item) return '';

  // 1. Explicit meta string already supplied
  if (typeof item.meta === 'string') return item.meta;

  const isPerson =
    item.resultType === 'person' ||
    Boolean(item.departmentLabel) ||
    Boolean(item.roleLabel) ||
    Boolean(item.character);

  if (isPerson) {
    if (item.departmentLabel) {
      return `${item.departmentLabel}${item.knownFor ? ` · ${item.knownFor}` : ''}`;
    }
    if (item.roleLabel) {
      return item.roleLabel;
    }
    if (item.character) {
      return item.year ? `${item.year} · as ${item.character}` : `as ${item.character}`;
    }
    if (item.knownFor) {
      return item.knownFor;
    }
  }

  // 2. Title with year and/or media type
  const hasYear = item.year && item.year !== 'N/A';
  const mediaLabel =
    item.mediaType === 'tv'
      ? 'TV Show'
      : item.mediaType === 'movie'
        ? 'Movie'
        : item.mediaType === 'series'
          ? 'Series'
          : item.mediaType === 'film'
            ? 'Film'
            : '';

  const segments = [];
  if (hasYear) {
    segments.push(String(item.year));
  }
  if (mediaLabel) {
    segments.push(mediaLabel);
  }

  return segments.join(' · ');
}

/**
 * Format accessible description for screen readers.
 */
export function formatMediaRowAccessibilityLabel(item = {}, options = {}) {
  const { rank, canPeek = false } = options;
  const title = item.title || item.name || 'Title';

  if (rank != null) {
    return `Open details for ${title}, ranked ${rank}`;
  }

  const isPerson =
    item.resultType === 'person' || Boolean(item.departmentLabel) || Boolean(item.roleLabel);
  if (isPerson) {
    const role = item.departmentLabel || item.roleLabel || 'Cast';
    const peekClause = canPeek ? '. Hold for a quick filmography preview' : '';
    return `${title}, ${role}. View filmography${peekClause}`;
  }

  const hasYear = item.year && item.year !== 'N/A';
  return `${title}${hasYear ? `, ${item.year}` : ''}. Open details.`;
}

/**
 * Resolve item into standard MediaListRow slot properties.
 */
export function resolveMediaRowItemProps(item = {}, options = {}) {
  if (!item) return {};

  const isPerson = item.resultType === 'person';
  const title = item.title || item.name || '';
  const imageUri = isPerson ? item.profileUrl || item.posterUrl : item.posterUrl || item.profileUrl;
  const imageVariant = isPerson ? 'avatar' : 'poster';
  const fallbackIcon = isPerson ? 'person-outline' : 'film-outline';
  const meta = formatMediaRowMeta(item);
  const accessibilityLabel = formatMediaRowAccessibilityLabel(item, options);

  return {
    title,
    meta,
    imageUri,
    imageVariant,
    fallbackIcon,
    accessibilityLabel,
    isPerson,
  };
}
