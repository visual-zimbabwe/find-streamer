const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';

function isEntityUri(val) {
  return typeof val === 'string' && val.startsWith(ENTITY_URI_PREFIX);
}

export function yearFromWikidataDate(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^\+?(-?\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/** Build a stable Commons thumbnail URL from a Wikidata P18 filename. */
export function commonsCoverUrl(filename) {
  if (!filename) return null;
  const clean = String(filename).replace(/^File:/i, '').trim();
  if (!clean) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(clean.replace(/ /g, '_'))}`;
}

export function sortSoundtracks(soundtracks) {
  return [...soundtracks].sort((a, b) => {
    const yearA = a.year ?? Number.POSITIVE_INFINITY;
    const yearB = b.year ?? Number.POSITIVE_INFINITY;
    if (yearA !== yearB) return yearA - yearB;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

/**
 * Extract playable soundtracks (with Spotify album IDs) from Wikidata SPARQL bindings.
 * Dedupes by wikidataId and sorts by year, then title.
 */
export function parseSoundtracksFromBindings(bindings, wikidataIdFromUri) {
  const map = new Map();

  for (const binding of bindings) {
    const soundtrackUri = binding.soundtrack?.value;
    if (!isEntityUri(soundtrackUri)) continue;

    const wikidataId = wikidataIdFromUri(soundtrackUri);
    if (!wikidataId || map.has(wikidataId)) continue;

    const spotifyAlbumId = binding.spotifyAlbumId?.value?.trim();
    if (!spotifyAlbumId) continue;

    const title = binding.soundtrackLabel?.value;
    if (!title || isEntityUri(title)) continue;

    map.set(wikidataId, {
      wikidataId,
      title,
      year: yearFromWikidataDate(binding.releaseDate?.value),
      coverUrl: commonsCoverUrl(binding.cover?.value),
      spotifyAlbumId,
    });
  }

  return sortSoundtracks(Array.from(map.values()));
}
