/**
 * personRailModel.js
 *
 * Pure domain logic and formatting helpers for talent and cast rails (PersonRail).
 * Kept free of React/React Native dependencies so that formatting, accessibility
 * labels, key extraction, and remaining counts are unit-testable under node --test.
 */

/**
 * Derives a stable, collision-free key for a person item in a rail or list.
 *
 * @param {object} person
 * @param {number} [index]
 * @returns {string}
 */
export function personKey(person, index = 0) {
  if (!person) return `person-item-${index}`;
  const role = person.role || 'person';
  const identifier = person.id ?? person.tmdbId ?? person.name ?? 'unknown';
  return `${role}-${identifier}-${index}`;
}

/**
 * Resolves the primary role label for a person (e.g. character name for cast,
 * job title or department for crew).
 *
 * @param {object} person
 * @returns {string}
 */
export function formatPersonRoleLabel(person) {
  if (!person) return '';
  if (person.roleLabel && typeof person.roleLabel === 'string') {
    return person.roleLabel.trim();
  }
  if (person.character && typeof person.character === 'string') {
    return person.character.trim();
  }
  if (person.job && typeof person.job === 'string') {
    return person.job.trim();
  }
  if (person.department && typeof person.department === 'string') {
    return person.department.trim();
  }
  if (person.role === 'cast') return 'Cast';
  if (person.role === 'director') return 'Director';
  if (person.role === 'writer') return 'Writer';
  if (person.role === 'composer') return 'Composer';
  if (person.role === 'creator') return 'Creator';
  return '';
}

/**
 * Generates an accessible description for a talent card, stating their name,
 * role/character, and whether a long-press peek action is available.
 *
 * @param {object} person
 * @param {object} [options]
 * @param {boolean} [options.canPeek=false]
 * @param {string} [options.action='View filmography']
 * @returns {string}
 */
export function formatPersonAccessibilityLabel(person, options = {}) {
  if (!person?.name) return 'Talent card';
  const role = formatPersonRoleLabel(person);
  const action = options.action || 'View filmography';
  const peekHint = options.canPeek ? '. Hold for a quick filmography preview' : '';
  const rolePhrase = role ? `, ${role}` : '';
  return `${person.name}${rolePhrase}. ${action}${peekHint}`;
}

/**
 * Formats the screen reader label for a "See all" header button or trailing action card.
 *
 * @param {string} [title='talent']
 * @param {number|null} [totalCount=null]
 * @returns {string}
 */
export function formatPersonSeeAllAccessibilityLabel(title = 'talent', totalCount = null) {
  const cleanTitle = (title || 'talent').trim().toLowerCase();
  if (typeof totalCount === 'number' && Number.isFinite(totalCount) && totalCount > 0) {
    return `See all ${totalCount} ${cleanTitle}`;
  }
  return `See all ${cleanTitle}`;
}

/**
 * Computes how many unrendered items remain given a total count and visible slice count.
 * Returns null if totalCount is unspecified or not greater than visibleCount.
 *
 * @param {number|null} totalCount
 * @param {number} visibleCount
 * @returns {number|null}
 */
export function calculateRemainingCount(totalCount, visibleCount) {
  if (
    typeof totalCount !== 'number' ||
    !Number.isFinite(totalCount) ||
    typeof visibleCount !== 'number' ||
    !Number.isFinite(visibleCount)
  ) {
    return null;
  }
  const remaining = totalCount - visibleCount;
  return remaining > 0 ? remaining : null;
}

/**
 * Resolves standard configuration properties for a PersonRail instance.
 *
 * @param {object} props
 * @returns {object}
 */
export function resolvePersonRailConfig(props = {}) {
  const {
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
    seeAllTileTitle = 'See all',
  } = props;

  const resolvedTitle = eyebrow || title;
  const items = Array.isArray(data) ? data : [];
  const remaining = calculateRemainingCount(totalCount, items.length);

  // If showSeeAllTile isn't explicitly set, default to true when onSeeAll is passed
  // and there is evidence of remaining items (or hasMore is true).
  const resolvedShowSeeAllTile =
    typeof showSeeAllTile === 'boolean'
      ? showSeeAllTile
      : Boolean(onSeeAll && (hasMore || (remaining !== null && remaining > 0)));

  const defaultSeeAllLabel =
    typeof totalCount === 'number' && totalCount > 0
      ? `See All ${totalCount}`
      : 'See all';

  return {
    title: resolvedTitle,
    items,
    totalCount,
    remainingCount: remaining,
    accent: Boolean(accent),
    bleed: Boolean(bleed),
    gap,
    showHeader: Boolean(showHeader && resolvedTitle),
    showHeaderSeeAll: Boolean(showHeaderSeeAll && onSeeAll),
    showSeeAllTile: resolvedShowSeeAllTile,
    seeAllLabel: seeAllLabel || defaultSeeAllLabel,
    seeAllTileTitle,
  };
}
