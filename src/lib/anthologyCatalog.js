/**
 * Anthology series registry and episode resolution engine.
 *
 * Maps standalone anthology episodes/installments (e.g., "I Am Helen", "Hang the DJ",
 * "San Junipero") to their overarching parent series (e.g., "I Am...", "Black Mirror"),
 * enriching actor filmographies with episode-level roles and resolving searches.
 */

export const ANTHOLOGY_SERIES_CATALOG = {
  // Dominic Savage's BAFTA-winning anthology series
  91605: {
    id: 91605,
    name: 'I Am...',
    poster_path: '/s1W8U5W85e2zXdDqxWEoP6JFj3j.jpg',
    backdrop_path: '/x7NyKPf4AoNv7McxBenzt0hl2zv.jpg',
    overview:
      'Each film follows a different woman as they experience moments that are emotionally raw, thought-provoking and utterly personal.',
    episodes: [
      {
        title: 'I Am Helen',
        searchAliases: ['i am helen', 'helen'],
        year: '2025',
        rawYear: 2025,
        release_date: '2025-10-01',
        season: 4,
        overview:
          'A two-part drama exploring modern relationships, gender dynamics, and toxic online ideologies, starring Nicola Coughlan and Joe Cole.',
        cast: [
          { personId: 1081875, name: 'Joe Cole', character: 'Steve' },
          { personId: 1267240, name: 'Nicola Coughlan', character: 'Helen' },
        ],
      },
      {
        title: 'I Am Ruth',
        searchAliases: ['i am ruth', 'ruth'],
        year: '2022',
        rawYear: 2022,
        release_date: '2022-12-08',
        season: 3,
        overview:
          'A mother watches helplessly as her teenage daughter retreats into herself under the pressure of social media.',
        cast: [
          { personId: 204, name: 'Kate Winslet', character: 'Ruth' },
          { name: 'Mia Threapleton', character: 'Freya' },
        ],
      },
      {
        title: 'I Am Victoria',
        searchAliases: ['i am victoria', 'victoria'],
        year: '2021',
        rawYear: 2021,
        release_date: '2021-08-05',
        season: 2,
        overview:
          'A woman struggles with severe mental health challenges while appearing to have a perfect family life.',
        cast: [{ personId: 82547, name: 'Suranne Jones', character: 'Victoria' }],
      },
      {
        title: 'I Am Danielle',
        searchAliases: ['i am danielle', 'danielle'],
        year: '2021',
        rawYear: 2021,
        release_date: '2021-08-12',
        season: 2,
        cast: [{ personId: 1030513, name: 'Letitia Wright', character: 'Danielle' }],
      },
      {
        title: 'I Am Maria',
        searchAliases: ['i am maria', 'maria'],
        year: '2021',
        rawYear: 2021,
        season: 2,
        cast: [{ personId: 2038, name: 'Lesley Manville', character: 'Maria' }],
      },
      {
        title: 'I Am Nicola',
        searchAliases: ['i am nicola', 'nicola'],
        year: '2019',
        rawYear: 2019,
        season: 1,
        cast: [{ personId: 19899, name: 'Vicky McClure', character: 'Nicola' }],
      },
      {
        title: 'I Am Kirsty',
        searchAliases: ['i am kirsty', 'kirsty'],
        year: '2019',
        rawYear: 2019,
        season: 1,
        cast: [{ personId: 304, name: 'Samantha Morton', character: 'Kirsty' }],
      },
      {
        title: 'I Am Hannah',
        searchAliases: ['i am hannah', 'hannah'],
        year: '2019',
        rawYear: 2019,
        season: 1,
        cast: [{ personId: 118471, name: 'Gemma Chan', character: 'Hannah' }],
      },
    ],
  },

  // Black Mirror
  42009: {
    id: 42009,
    name: 'Black Mirror',
    episodes: [
      {
        title: 'Hang the DJ',
        searchAliases: ['hang the dj'],
        year: '2017',
        cast: [
          { personId: 1081875, name: 'Joe Cole', character: 'Frank' },
          { name: 'Georgina Campbell', character: 'Amy' },
        ],
      },
      {
        title: 'San Junipero',
        searchAliases: ['san junipero'],
        year: '2016',
        cast: [
          { name: 'Gugu Mbatha-Raw', character: 'Kelly' },
          { name: 'Mackenzie Davis', character: 'Yorkie' },
        ],
      },
      {
        title: 'USS Callister',
        searchAliases: ['uss callister'],
        year: '2017',
        cast: [{ name: 'Jesse Plemons', character: 'Robert Daly' }],
      },
      {
        title: 'Nosedive',
        searchAliases: ['nosedive'],
        year: '2016',
        cast: [{ name: 'Bryce Dallas Howard', character: 'Lacie' }],
      },
    ],
  },
};

/**
 * Returns any known upcoming or anthology-specific credits for a person.
 * Used to ensure upcoming installments (like Joe Cole in "I Am Helen") are
 * populated in combined credits even before TMDb aggregates them at the series level.
 */
export function getAnthologyCreditsForPerson(personId, personName) {
  const credits = [];
  const pId = Number(personId);
  const normalizedName = (personName || '').trim().toLowerCase();

  for (const [seriesIdStr, series] of Object.entries(ANTHOLOGY_SERIES_CATALOG)) {
    const seriesId = Number(seriesIdStr);
    for (const ep of series.episodes || []) {
      const matchedCast = (ep.cast || []).find((c) => {
        if (pId && c.personId && c.personId === pId) return true;
        if (normalizedName && c.name && c.name.toLowerCase() === normalizedName) return true;
        return false;
      });

      if (matchedCast) {
        credits.push({
          id: seriesId,
          tmdbId: seriesId,
          media_type: 'tv',
          mediaType: 'tv',
          title: ep.title,
          seriesTitle: series.name,
          episodeTitle: ep.title,
          character: matchedCast.character || '',
          roleMeta: matchedCast.character ? `as ${matchedCast.character}` : null,
          year: ep.year || 'N/A',
          rawYear: ep.rawYear || (ep.year ? parseInt(ep.year, 10) : 0),
          release_date: ep.release_date || `${ep.year || '2025'}-01-01`,
          first_air_date: ep.release_date || `${ep.year || '2025'}-01-01`,
          poster_path: ep.poster_path || series.poster_path,
          backdrop_path: ep.backdrop_path || series.backdrop_path,
          overview: ep.overview || series.overview,
          vote_average: ep.vote_average ?? 0,
          vote_count: ep.vote_count ?? 0,
          isAnthologyInstallment: true,
        });
      }
    }
  }

  return credits;
}

/**
 * Resolves an episode-level annotation for a known anthology show and character.
 * E.g., for Black Mirror + character "Frank", returns "Hang the DJ".
 */
export function getAnthologyEpisodeMeta(tmdbId, character, personId) {
  const series = ANTHOLOGY_SERIES_CATALOG[Number(tmdbId)];
  if (!series) return null;

  const normalizedChar = (character || '').trim().toLowerCase();
  const pId = Number(personId);

  for (const ep of series.episodes || []) {
    const match = (ep.cast || []).find((c) => {
      if (pId && c.personId && c.personId === pId) return true;
      if (normalizedChar && c.character && c.character.toLowerCase() === normalizedChar) return true;
      return false;
    });
    if (match) {
      return {
        episodeTitle: ep.title,
        seriesTitle: series.name,
        character: match.character,
      };
    }
  }

  return null;
}

/**
 * Checks if a search query matches a known anthology episode title.
 * E.g., "I Am Helen" -> resolves to TV series 91605 (I Am...) candidate.
 */
export function findAnthologyMatchForQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase().replace(/['"]/g, '');
  if (clean.length < 3) return null;

  for (const [seriesIdStr, series] of Object.entries(ANTHOLOGY_SERIES_CATALOG)) {
    const seriesId = Number(seriesIdStr);
    for (const ep of series.episodes || []) {
      const epClean = ep.title.toLowerCase();
      const isExactOrAlias =
        clean === epClean ||
        (ep.searchAliases || []).some((alias) => clean === alias.toLowerCase());

      if (isExactOrAlias) {
        const dateValue = ep.release_date || (ep.year ? `${ep.year}-01-01` : '');
        return {
          resultType: 'media',
          mediaType: 'tv',
          tmdbId: seriesId,
          title: ep.title,
          seriesTitle: series.name,
          episodeTitle: ep.title,
          isAnthologyInstallment: true,
          year: ep.year || (dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A'),
          synopsis: ep.overview || series.overview || '',
          posterUrl: (ep.poster_path || series.poster_path)
            ? `https://image.tmdb.org/t/p/w500${ep.poster_path || series.poster_path}`
            : null,
          backdropUrl: (ep.backdrop_path || series.backdrop_path)
            ? `https://image.tmdb.org/t/p/original${ep.backdrop_path || series.backdrop_path}`
            : null,
          ratingValue: ep.vote_average || 0,
          rating: ep.vote_average ? `${ep.vote_average.toFixed(1)}/10` : 'N/A',
          popularity: 25.0,
        };
      }
    }
  }

  return null;
}
