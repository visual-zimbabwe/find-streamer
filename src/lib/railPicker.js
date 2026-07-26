/**
 * Ranking for the two "what next" rails at the foot of the Results screen.
 *
 * Both rails used to be ranked by raw `vote_average`, which on TMDb is an
 * unweighted mean. Measured over 100 popular titles, 51.8% of the cards on
 * screen had fewer than 200 votes and the median card had 168 — The Odyssey
 * led with a film rated 10.0 by one person, Moana with one rated 9.0 by two.
 * A rating is not a ranking until enough people have voted.
 *
 * The second rail was also built by OR-joining ten people into a single
 * `/discover/movie?with_people=a|b|c` query, which cannot report *which*
 * person matched. That is why Avengers: Infinity War surfaced on 11 of those
 * 100 pages and why a horror short recommended 12 Years a Slave with no
 * visible reason. Per-person credits carry the connection inherently, so the
 * card can name it.
 */

/** Preferred minimum community votes before a title may appear on a rail. */
export const MIN_RAIL_VOTES = 200;

/**
 * Hard floor. Backfilling a short rail is worth doing, but not at any price —
 * a film rated 10.0 by one person is the exact thing this module exists to
 * keep off the screen, and it is no more defensible in the fourth slot than
 * the first.
 */
export const ABSOLUTE_MIN_RAIL_VOTES = 50;

/** Below this a rail reads as breakage rather than a rail, so it hides instead. */
export const MIN_RAIL_ITEMS = 2;

/** Cards per rail. */
export const RAIL_SIZE = 5;

/** People to pull filmographies for. One request each — keep it small. */
export const RAIL_PEOPLE_LIMIT = 4;

/**
 * Formats where a shared credit says nothing about taste: documentaries about
 * the industry, talk shows, news and reality. Without this the rails fill with
 * chat-show appearances and "making of" featurettes.
 */
const EXCLUDED_GENRE_IDS = new Set([99, 10763, 10764, 10767]);

/**
 * Episodes a person must have worked on before a series counts as *theirs*.
 *
 * Without this the rail fills with pass-through credits: long-running shows
 * have enormous guest rosters, so almost every working actor has one Simpsons
 * voice or one Grey's Anatomy episode. Measured on the first cut, The Simpsons
 * surfaced on 16 of 100 pages — a worse attractor than the OR-joined discover
 * query it replaced. Five separates "part of the show" from "passed through",
 * while still admitting the lead of a six-part limited series.
 */
const TV_MIN_EPISODES = 5;

/** Crew jobs that constitute authorship. A gaffer credit is not a recommendation. */
const RAIL_CREW_JOBS = new Set([
  'Director',
  'Writer',
  'Screenplay',
  'Story',
  'Teleplay',
  'Original Music Composer',
]);

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

function yearOf(item) {
  const date = item.release_date || item.first_air_date || '';
  return date.length >= 4 ? date.slice(0, 4) : 'N/A';
}

/**
 * Quality that respects notability: a 7.9 from 40k voters outranks an 8.6 from
 * 210. Same shape already used by the Surprise Me pool.
 */
export function railScore(ratingValue, voteCount) {
  return (ratingValue || 0) * Math.log10((voteCount || 0) + 10);
}

function isUsable(item) {
  if (!item || !item.id) return false;
  if (!item.poster_path) return false;
  const genres = item.genre_ids || [];
  return !genres.some((id) => EXCLUDED_GENRE_IDS.has(id));
}

function toRailItem(item, fallbackMediaType) {
  const mediaType = item.media_type === 'tv' || item.media_type === 'movie'
    ? item.media_type
    : fallbackMediaType;
  const ratingValue = item.vote_average || 0;
  return {
    mediaType,
    tmdbId: item.id,
    title: item.title || item.name || '(Untitled)',
    year: yearOf(item),
    posterUrl: `${POSTER_BASE}${item.poster_path}`,
    ratingValue,
    voteCount: item.vote_count || 0,
    rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
  };
}

/**
 * Rank `/recommendations` results for the "More Like This" rail.
 *
 * TMDb already returns these in relevance order, so the job here is to *not*
 * re-sort them — only to drop the ones too thinly voted to trust, and to
 * backfill in relevance order rather than show a short rail when a title's
 * neighbours are all obscure.
 */
export function rankSimilarTitles(results, mediaType, options = {}) {
  const { currentTmdbId = null, size = RAIL_SIZE, minVotes = MIN_RAIL_VOTES } = options;
  if (!Array.isArray(results)) return [];

  const seen = new Set();
  const usable = [];
  results.forEach((raw) => {
    if (!isUsable(raw)) return;
    if (raw.id === currentTmdbId) return;
    const item = toRailItem(raw, mediaType);
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (seen.has(key)) return;
    seen.add(key);
    usable.push(item);
  });

  // Relevance order preserved throughout — the floor only removes, never reorders.
  const trusted = usable.filter((item) => item.voteCount >= minVotes);
  if (trusted.length >= size) return trusted.slice(0, size);

  // Short rail: backfill down to the hard floor, best-supported first, so an
  // obscure title still gets a rail — but never with a one-vote average on it.
  const backfill = usable
    .filter((item) => item.voteCount < minVotes && item.voteCount >= ABSOLUTE_MIN_RAIL_VOTES)
    .sort((a, b) => b.voteCount - a.voteCount);
  const filled = [...trusted, ...backfill].slice(0, size);
  return filled.length >= MIN_RAIL_ITEMS ? filled : [];
}

/**
 * Apply the same two-tier vote floor to a studio catalogue.
 *
 * Shared with the rails deliberately: `fetchProductionCompanyCatalog` carried
 * the identical `vote_average.desc` + tiny-vote-floor defect this module was
 * written to cure, which is how Walt Disney Pictures came to open with "Radio
 * Disney Music Awards" (9.6 from 7 votes). The caller has already ordered by
 * popularity, so as with `rankSimilarTitles` the floor only removes — it never
 * reorders.
 *
 * Unlike a rail there is no `size` cap: this feeds a full-page grid, and a
 * studio with 40 well-supported titles should show all 40.
 */
export function rankCompanyCatalog(items, options = {}) {
  const { minVotes = MIN_RAIL_VOTES } = options;
  if (!Array.isArray(items)) return [];

  const preferred = items.filter((item) => (item?.voteCount || 0) >= minVotes);
  if (preferred.length >= MIN_RAIL_ITEMS) return preferred;

  // Too few well-supported titles to fill a grid — a small studio, not a bug.
  // Drop to the hard floor rather than show an almost-empty page.
  return items.filter((item) => (item?.voteCount || 0) >= ABSOLUTE_MIN_RAIL_VOTES);
}

/**
 * Choose whose filmographies to pull, best signal first. Director carries the
 * strongest "if you liked this" signal, then top billing; writers and the
 * composer are the tail.
 */
export function selectRailPeople(result, limit = RAIL_PEOPLE_LIMIT) {
  const ordered = [
    ...(result?.directorPersons || []).map((p) => ({ ...p, roleLabel: p.job || 'Director' })),
    ...(result?.starringPersons || []).map((p) => ({ ...p, roleLabel: 'Cast' })),
    ...(result?.writerPersons || []).map((p) => ({ ...p, roleLabel: p.job || 'Writer' })),
    ...(result?.composerPersons || []).map((p) => ({ ...p, roleLabel: 'Composer' })),
  ];

  const seen = new Set();
  const people = [];
  ordered.forEach((person) => {
    if (!person?.id || !person.name || seen.has(person.id)) return;
    seen.add(person.id);
    people.push({ id: person.id, name: person.name, roleLabel: person.roleLabel });
  });
  return people.slice(0, limit);
}

/**
 * Flatten one person's `/person/{id}/combined_credits` into rail candidates,
 * each tagged with the person it came from. `order` gates cast credits so a
 * one-scene walk-on doesn't pull a blockbuster onto the rail.
 */
export function creditsForPerson(person, credits, options = {}) {
  const { currentTmdbId = null, minVotes = MIN_RAIL_VOTES, maxBilling = 12 } = options;
  if (!credits) return [];

  const fromCast = (credits.cast || []).filter(
    (item) => item.order == null || item.order <= maxBilling,
  );
  const fromCrew = (credits.crew || []).filter((item) => RAIL_CREW_JOBS.has(item.job));

  // A single guest episode is not a filmography connection worth showing.
  const heldLongEnough = (item) =>
    item.media_type !== 'tv' || (item.episode_count || 0) >= TV_MIN_EPISODES;

  const out = [];
  const seen = new Set();
  [...fromCrew, ...fromCast].forEach((raw) => {
    if (!isUsable(raw)) return;
    if (raw.id === currentTmdbId) return;
    if ((raw.vote_count || 0) < minVotes) return;
    if (!heldLongEnough(raw)) return;
    const item = toRailItem(raw, 'movie');
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      ...item,
      viaPersonId: person.id,
      viaPersonName: person.name,
      // How they're involved in *this* title, not in the one being viewed.
      viaRole: RAIL_CREW_JOBS.has(raw.job) ? raw.job : person.roleLabel || 'Cast',
      score: railScore(item.ratingValue, item.voteCount),
    });
  });
  return out;
}

/**
 * Merge per-person candidate lists into one attributed rail.
 *
 * Interleaves by person rather than taking a global top-N: a global sort lets
 * the most prolific name own every card, which is the same failure the
 * OR-joined discover query had.
 */
export function rankPeopleTitles(groups, options = {}) {
  const { size = RAIL_SIZE, exclude = [] } = options;
  if (!Array.isArray(groups)) return [];

  const blocked = new Set(exclude.map((item) => `${item.mediaType}:${item.tmdbId}`));
  const queues = groups
    .filter((group) => group && Array.isArray(group.items) && group.items.length)
    .map((group) => group.items.slice().sort((a, b) => b.score - a.score));

  const picked = [];
  const seen = new Set(blocked);
  let round = 0;
  while (picked.length < size && queues.some((queue) => round < queue.length)) {
    for (const queue of queues) {
      if (picked.length >= size) break;
      const item = queue[round];
      if (!item) continue;
      const key = `${item.mediaType}:${item.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(item);
    }
    round += 1;
  }
  return picked;
}
