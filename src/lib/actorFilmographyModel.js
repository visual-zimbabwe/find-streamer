/**
 * Domain model and partitioning logic for actor/filmmaker filmography sheets.
 * Partitions TMDB combined credits into horizontal role rails (Acting, Directing, Writing),
 * prioritizing the talent's primary credit role.
 */

export const ROLE_ACTING = 'acting';
export const ROLE_DIRECTING = 'directing';
export const ROLE_WRITING = 'writing';
export const ROLE_MUSIC = 'music';

export const ROLE_CONFIG = {
  [ROLE_ACTING]: {
    id: ROLE_ACTING,
    title: 'Acting',
    eyebrow: 'Acting',
    icon: 'person-outline',
  },
  [ROLE_DIRECTING]: {
    id: ROLE_DIRECTING,
    title: 'Directing',
    eyebrow: 'Directing',
    icon: 'videocam-outline',
  },
  [ROLE_WRITING]: {
    id: ROLE_WRITING,
    title: 'Writing',
    eyebrow: 'Writing',
    icon: 'document-text-outline',
  },
  [ROLE_MUSIC]: {
    id: ROLE_MUSIC,
    title: 'Music & Score',
    eyebrow: 'Music & Score',
    icon: 'musical-notes-outline',
  },
};

export const DIRECTING_JOBS = new Set([
  'Director',
  'Co-Director',
  'Creator',
  'Series Director',
]);

export const WRITING_JOBS = new Set([
  'Writer',
  'Screenplay',
  'Story',
  'Teleplay',
  'Novel',
  'Characters',
  'Author',
  'Story by',
  'Original Story',
  'Head Writer',
  'Co-Writer',
  'Book',
  'Comic Book',
  'Graphic Novel',
]);

export const MUSIC_JOBS = new Set([
  'Original Music Composer',
  'Music',
  'Composer',
  'Original Score',
  'Music Supervisor',
]);

/**
 * Resolves a raw or passed role identifier (e.g. 'movie', 'tv', 'writer', 'cast', 'composer')
 * into one of the canonical role types: 'acting', 'directing', 'writing', or 'music'.
 */
export function resolvePrimaryRoleType(role) {
  if (!role || typeof role !== 'string') return ROLE_ACTING;
  const normalized = role.trim().toLowerCase();

  if (
    normalized === 'movie' ||
    normalized === 'tv' ||
    normalized === 'director' ||
    normalized === 'directing' ||
    normalized === 'creator' ||
    normalized === 'direction'
  ) {
    return ROLE_DIRECTING;
  }

  if (
    normalized === 'writer' ||
    normalized === 'writing' ||
    normalized === 'screenplay' ||
    normalized === 'author' ||
    normalized === 'story'
  ) {
    return ROLE_WRITING;
  }

  if (
    normalized === 'composer' ||
    normalized === 'music' ||
    normalized === 'score'
  ) {
    return ROLE_MUSIC;
  }

  return ROLE_ACTING;
}

/**
 * Orders role keys so that the primary role appears first,
 * followed by standard secondary disciplines.
 */
export function resolveRailOrder(primaryRole) {
  const primaryType = resolvePrimaryRoleType(primaryRole);

  if (primaryType === ROLE_DIRECTING) {
    return [ROLE_DIRECTING, ROLE_ACTING, ROLE_WRITING, ROLE_MUSIC];
  }
  if (primaryType === ROLE_WRITING) {
    return [ROLE_WRITING, ROLE_ACTING, ROLE_DIRECTING, ROLE_MUSIC];
  }
  if (primaryType === ROLE_MUSIC) {
    return [ROLE_MUSIC, ROLE_DIRECTING, ROLE_WRITING, ROLE_ACTING];
  }
  return [ROLE_ACTING, ROLE_DIRECTING, ROLE_WRITING, ROLE_MUSIC];
}

/**
 * Checks whether a crew item represents a directing credit.
 */
export function isDirectingCredit(item) {
  if (!item) return false;
  if (item.job && DIRECTING_JOBS.has(item.job)) return true;
  if (item.department === 'Directing' && (item.job === 'Director' || item.job === 'Co-Director')) {
    return true;
  }
  return false;
}

/**
 * Checks whether a crew item represents a writing credit.
 */
export function isWritingCredit(item) {
  if (!item) return false;
  if (item.job && WRITING_JOBS.has(item.job)) return true;
  if (item.department === 'Writing') return true;
  return false;
}

/**
 * Checks whether a crew item represents a music or score credit.
 */
export function isMusicCredit(item) {
  if (!item) return false;
  if (item.job && MUSIC_JOBS.has(item.job)) return true;
  if (item.department === 'Sound' && item.job === 'Original Music Composer') return true;
  return false;
}

/**
 * Checks whether an item represents an acting credit.
 */
export function isActingCredit(item) {
  if (!item) return false;
  return item.media_type === 'movie' || item.media_type === 'tv' || item.character !== undefined;
}

/**
 * Normalizes a credit item into a unified Trova format.
 */
export function normalizeCreditItem(item, roleType) {
  if (!item) return null;

  const dateValue = item.release_date || item.first_air_date || item.releaseDate || '';
  const mediaType = item.mediaType || item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const year = item.year || (dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A');
  const rawYear = item.rawYear || (dateValue.length >= 4 ? parseInt(dateValue.slice(0, 4), 10) : 0);
  const ratingValue =
    typeof item.ratingValue === 'number'
      ? item.ratingValue
      : typeof item.vote_average === 'number'
        ? item.vote_average
        : 0;
  const rating = item.rating || (ratingValue > 0 ? ratingValue.toFixed(1) : null);
  const character = (item.character || '').trim();
  const job = (item.job || '').trim();

  let roleMeta = item.roleMeta || null;
  if (!roleMeta) {
    if (roleType === ROLE_ACTING) {
      roleMeta = character ? `as ${character}` : null;
    } else if (roleType === ROLE_DIRECTING) {
      roleMeta = job || 'Director';
    } else if (roleType === ROLE_WRITING) {
      roleMeta = job || 'Writer';
    } else if (roleType === ROLE_MUSIC) {
      roleMeta = job || 'Composer';
    }
  }

  const metaText =
    item.metaText || [year !== 'N/A' ? year : null, roleMeta].filter(Boolean).join(' · ');

  const resolvedPosterUrl = item.posterUrl
    ? item.posterUrl
    : item.poster_path
      ? (item.poster_path.startsWith('http')
          ? item.poster_path
          : `https://image.tmdb.org/t/p/w500${item.poster_path}`)
      : null;

  const resolvedBackdropUrl = item.backdropUrl
    ? item.backdropUrl
    : item.backdrop_path
      ? (item.backdrop_path.startsWith('http')
          ? item.backdrop_path
          : `https://image.tmdb.org/t/p/original${item.backdrop_path}`)
      : null;

  const tmdbId = item.tmdbId ?? item.id;

  return {
    id: item.id && String(item.id).includes(':') ? item.id : `${mediaType}:${tmdbId}`,
    tmdbId,
    mediaType,
    title: item.title || item.name || '(Untitled)',
    year,
    rawYear,
    synopsis: (item.overview || item.synopsis || '').trim() || 'No synopsis available.',
    posterUrl: resolvedPosterUrl,
    backdropUrl: resolvedBackdropUrl,
    ratingValue,
    rating,
    voteCount: item.voteCount ?? item.vote_count ?? 0,
    character,
    job,
    department: item.department || '',
    roleType,
    roleMeta,
    metaText,
  };
}

/**
 * Deduplicates and sorts credit items within a role bucket.
 * Drops obscure entries (vote_count < 5) unless the total is small.
 * Sorts primarily by rating descending, then vote count and release year.
 */
export function dedupeAndSortCredits(items, roleType, minVoteCount = 5) {
  if (!Array.isArray(items) || !items.length) return [];

  // Filter to valid movie/tv entries
  const valid = items.filter(
    (item) =>
      item &&
      (item.id || item.tmdbId) &&
      (item.media_type === 'movie' ||
        item.media_type === 'tv' ||
        item.mediaType === 'movie' ||
        item.mediaType === 'tv' ||
        !item.media_type),
  );

  // If filtering by vote_count leaves enough items (>= 3), apply it; otherwise keep all
  const filtered = valid.filter((item) => (item.vote_count ?? item.voteCount ?? 0) >= minVoteCount);
  const pool = filtered.length >= 3 ? filtered : valid;

  // Deduplicate by mediaType:id
  const seen = new Map();
  for (const raw of pool) {
    const rawMediaType = raw.media_type || raw.mediaType || 'media';
    const rawId = raw.tmdbId ?? raw.id;
    const key = `${rawMediaType}:${rawId}`;
    if (!seen.has(key)) {
      seen.set(key, raw);
    } else {
      // If we see duplicate (e.g. two writing credits for same film), prefer one with higher vote_average
      const existing = seen.get(key);
      const rawAvg = raw.vote_average ?? raw.ratingValue ?? 0;
      const existAvg = existing.vote_average ?? existing.ratingValue ?? 0;
      if (rawAvg > existAvg) {
        seen.set(key, raw);
      }
    }
  }

  const unique = Array.from(seen.values());

  // Sort by rating descending, then vote_count descending, then year
  unique.sort((a, b) => {
    const rA = a.vote_average || 0;
    const rB = b.vote_average || 0;
    if (rB !== rA) return rB - rA;

    const vA = a.vote_count || 0;
    const vB = b.vote_count || 0;
    if (vB !== vA) return vB - vA;

    const dateA = a.release_date || a.first_air_date || '';
    const dateB = b.release_date || b.first_air_date || '';
    return dateB.localeCompare(dateA);
  });

  return unique.map((item) => normalizeCreditItem(item, roleType)).filter(Boolean);
}

/**
 * Partitions TMDB combined credits into horizontal role rails (Acting, Directing, Writing, Music).
 *
 * @param {object} combinedData Combined credits payload { cast: [], crew: [] }
 * @param {string} [primaryRole='cast'] Role of the clicked card (used to prioritize ordering)
 * @param {number} [maxPerRail=30] Max credits per horizontal rail
 * @returns {{ rails: Array, totalCreditsCount: number, primaryRoleType: string }}
 */
export function partitionFilmographyCredits(combinedData, primaryRole = 'cast', maxPerRail = 30) {
  const cast = Array.isArray(combinedData?.cast) ? combinedData.cast : [];
  const crew = Array.isArray(combinedData?.crew) ? combinedData.crew : [];

  const primaryRoleType = resolvePrimaryRoleType(primaryRole);
  const railOrder = resolveRailOrder(primaryRole);

  // 1. Acting
  const actingCredits = dedupeAndSortCredits(cast, ROLE_ACTING);

  // 2. Directing
  const directingRaw = crew.filter(isDirectingCredit);
  const directingCredits = dedupeAndSortCredits(directingRaw, ROLE_DIRECTING);

  // 3. Writing
  const writingRaw = crew.filter(isWritingCredit);
  const writingCredits = dedupeAndSortCredits(writingRaw, ROLE_WRITING);

  // 4. Music
  const musicRaw = crew.filter(isMusicCredit);
  const musicCredits = dedupeAndSortCredits(musicRaw, ROLE_MUSIC);

  const bucketMap = {
    [ROLE_ACTING]: actingCredits,
    [ROLE_DIRECTING]: directingCredits,
    [ROLE_WRITING]: writingCredits,
    [ROLE_MUSIC]: musicCredits,
  };

  const rails = [];
  let totalCreditsCount = 0;

  for (const roleKey of railOrder) {
    const credits = bucketMap[roleKey] || [];
    if (credits.length > 0) {
      totalCreditsCount += credits.length;
      rails.push({
        id: roleKey,
        roleType: roleKey,
        title: ROLE_CONFIG[roleKey]?.title || roleKey,
        eyebrow: ROLE_CONFIG[roleKey]?.eyebrow || roleKey,
        icon: ROLE_CONFIG[roleKey]?.icon || 'film-outline',
        count: credits.length,
        totalCount: credits.length,
        data: credits.slice(0, maxPerRail),
      });
    }
  }

  return {
    rails,
    totalCreditsCount,
    primaryRoleType,
  };
}
