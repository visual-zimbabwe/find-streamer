/**
 * Trailer selection for the Results hero "Watch Trailer" button.
 *
 * TMDb's `videos` list is a grab-bag: official trailers sit next to teasers,
 * featurettes, opening credits, DVD promos and fan re-uploads. The old picker
 * ended in "first YouTube video in the list", which is how a button labelled
 * "Watch Trailer" ended up playing *Behind the Scenes: The Designers* on
 * The Mentalist. Measured over 120 popular titles, 6 of the 91 buttons were
 * showing something that wasn't a trailer at all.
 *
 * So: rank into explicit tiers and refuse to fall through. A missing button is
 * honest; a mislabelled one is not.
 */

/** Tier order: official Trailer → official Teaser → any Trailer → any Teaser → nothing. */
const ACCEPTED_TYPES = ['Trailer', 'Teaser'];

/** How many ranked candidates to carry. The player walks these when YouTube rejects one. */
const MAX_CANDIDATES = 5;

/** English first, then language-neutral, then anything (a Tamil trailer beats no trailer). */
function languageRank(video) {
  if (video.iso_639_1 === 'en') return 0;
  if (video.iso_639_1 == null) return 1;
  return 2;
}

function tierRank(video) {
  // official outranks type: an official teaser is a better button than a fan-uploaded trailer.
  return (video.official ? 0 : 2) + (video.type === 'Trailer' ? 0 : 1);
}

function publishedAtMs(video) {
  const t = Date.parse(video.published_at || '');
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Rank TMDb `videos.results` into playable trailer candidates, best first.
 * Returns `[]` rather than guessing — the caller hides the button.
 */
export function rankTrailerCandidates(videos) {
  if (!Array.isArray(videos)) return [];
  const usable = videos.filter(
    (video) => video && video.site === 'YouTube' && video.key && ACCEPTED_TYPES.includes(video.type),
  );
  return usable
    .slice()
    .sort((a, b) => {
      const tier = tierRank(a) - tierRank(b);
      if (tier !== 0) return tier;
      const lang = languageRank(a) - languageRank(b);
      if (lang !== 0) return lang;
      // Newest first — the final trailer is normally the one worth watching.
      const published = publishedAtMs(b) - publishedAtMs(a);
      if (published !== 0) return published;
      return (b.size || 0) - (a.size || 0);
    })
    .slice(0, MAX_CANDIDATES)
    .map((video) => ({
      key: video.key,
      url: `https://www.youtube.com/watch?v=${video.key}`,
      type: video.type,
      official: video.official === true,
      name: video.name || null,
    }));
}
